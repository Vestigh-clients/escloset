import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Phone } from "lucide-react";
import { Link, useParams } from "react-router";
import {
  buildStatusLabel,
  cancelAdminOrder,
  fetchAdminOrderDetail,
  updateAdminOrderStatus,
  type AdminOrderDetail,
} from "@/services/adminService";
import { storeConfig } from "@/config/store.config";
import { formatCurrency, formatDateLong } from "@/lib/adminFormatting";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";

type FlowStage = Extract<AdminOrderDetail["status"], "processing" | "shipped" | "delivered">;
type ConfirmationAction =
  | { type: "status"; stage: FlowStage }
  | { type: "cancel" };

const FLOW_STAGES: FlowStage[] = ["processing", "shipped", "delivered"];
const OUT_OF_FLOW_STATUSES = new Set<AdminOrderDetail["status"]>(["pending_payment", "pending", "confirmed"]);
const DESKTOP_BREAKPOINT = 1024;
const DEFAULT_CANCEL_REASON = "Cancelled by store owner";

const getPaymentBadgeConfig = (paymentStatus: AdminOrderDetail["payment_status"]) => {
  if (paymentStatus === "paid") {
    return {
      label: "Paid",
      state: "paid" as const,
      className: "border border-[rgba(var(--color-success-rgb),0.22)] bg-[rgba(var(--color-success-rgb),0.08)] text-[var(--color-success)]",
    };
  }

  return {
    label: "Pending Payment",
    state: "pending" as const,
    className: "border border-[rgba(var(--color-primary-rgb),0.12)] bg-[rgba(var(--color-primary-rgb),0.05)] text-[var(--color-muted)]",
  };
};

const parseSnapshot = (snapshot: Json) => {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  return snapshot as Record<string, unknown>;
};

const formatAddressLines = (snapshot: Json) => {
  const record = parseSnapshot(snapshot);
  if (!record) {
    return [];
  }

  const cityState = [record.city, record.state]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .map((value) => String(value).trim())
    .join(", ");

  return [record.address_line1, record.address_line2, cityState, record.country]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .map((value) => String(value).trim());
};

const getFlowIndex = (status: AdminOrderDetail["status"]): number => {
  return FLOW_STAGES.indexOf(status as FlowStage);
};

const getStatusPath = (currentStatus: AdminOrderDetail["status"], targetStage: FlowStage): FlowStage[] => {
  if (targetStage === "processing") {
    return OUT_OF_FLOW_STATUSES.has(currentStatus) ? ["processing"] : [];
  }

  if (targetStage === "shipped") {
    if (currentStatus === "processing") {
      return ["shipped"];
    }

    return OUT_OF_FLOW_STATUSES.has(currentStatus) ? ["processing", "shipped"] : [];
  }

  if (currentStatus === "shipped") {
    return ["delivered"];
  }

  if (currentStatus === "processing") {
    return ["shipped", "delivered"];
  }

  return OUT_OF_FLOW_STATUSES.has(currentStatus) ? ["processing", "shipped", "delivered"] : [];
};

const isStageHighlighted = (currentStatus: AdminOrderDetail["status"], stage: FlowStage): boolean => {
  const currentIndex = getFlowIndex(currentStatus);
  if (currentIndex < 0) {
    return false;
  }

  return FLOW_STAGES.indexOf(stage) <= currentIndex;
};

const buildCustomerName = (order: AdminOrderDetail): string => {
  const fullName = `${order.customer.first_name} ${order.customer.last_name}`.trim();
  return fullName || "Customer";
};

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const update = () => {
      setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    };

    mediaQuery.addEventListener("change", update);
    update();

    return () => {
      mediaQuery.removeEventListener("change", update);
    };
  }, []);

  return !!isDesktop;
};

const AdminOrderDetailPage = () => {
  const { orderNumber } = useParams();
  const { user } = useAuth();
  const isDesktop = useIsDesktop();

  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmationAction, setConfirmationAction] = useState<ConfirmationAction | null>(null);
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSuccess, setStatusSuccess] = useState(false);

  const fetchOrderRecord = useCallback(async () => {
    if (!orderNumber) {
      return null;
    }

    return fetchAdminOrderDetail(orderNumber);
  }, [orderNumber]);

  const loadOrder = useCallback(async () => {
    if (!orderNumber) {
      setOrder(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await fetchOrderRecord();
      setOrder(data);
    } catch {
      setOrder(null);
      setLoadError("Unable to load order details.");
    } finally {
      setIsLoading(false);
    }
  }, [fetchOrderRecord, orderNumber]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!statusSuccess) {
      return;
    }

    const timeout = window.setTimeout(() => setStatusSuccess(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [statusSuccess]);

  const addressLines = useMemo(() => {
    return order ? formatAddressLines(order.shipping_address_snapshot) : [];
  }, [order]);

  const customerName = useMemo(() => {
    return order ? buildCustomerName(order) : "Customer";
  }, [order]);

  const customerPhoneHref = useMemo(() => {
    const phone = order?.customer.phone?.trim();
    if (!phone) {
      return null;
    }

    return `tel:${phone.replace(/\s+/g, "")}`;
  }, [order?.customer.phone]);

  const paymentBadge = useMemo(() => {
    return order ? getPaymentBadgeConfig(order.payment_status) : null;
  }, [order]);

  const openStatusConfirmation = (targetStage: FlowStage) => {
    if (!order || isStatusSubmitting) {
      return;
    }

    if (getStatusPath(order.status, targetStage).length === 0) {
      return;
    }

    setConfirmationAction({ type: "status", stage: targetStage });
    setStatusError(null);
    setStatusSuccess(false);
  };

  const openCancelConfirmation = () => {
    if (!order || isStatusSubmitting || order.status === "cancelled") {
      return;
    }

    setConfirmationAction({ type: "cancel" });
    setStatusError(null);
    setStatusSuccess(false);
  };

  const closeConfirmation = () => {
    if (isStatusSubmitting) {
      return;
    }

    setConfirmationAction(null);
    setStatusError(null);
  };

  const confirmStatusChange = async () => {
    if (!order || !confirmationAction || confirmationAction.type !== "status") {
      return;
    }

    const statusPath = getStatusPath(order.status, confirmationAction.stage);
    if (statusPath.length === 0) {
      return;
    }

    setIsStatusSubmitting(true);
    setStatusError(null);

    try {
      let currentOrder = order;

      for (const nextStatus of statusPath) {
        await updateAdminOrderStatus({
          order: currentOrder,
          nextStatus,
          note: "",
          notifyCustomer: true,
          adminEmail: user?.email ?? storeConfig.contact.email,
        });

        currentOrder = { ...currentOrder, status: nextStatus };
      }

      setOrder(currentOrder);
      setConfirmationAction(null);
      setStatusSuccess(true);
      setLoadError(null);

      try {
        const refreshedOrder = await fetchOrderRecord();
        if (refreshedOrder) {
          setOrder(refreshedOrder);
        }
      } catch {
        // Keep the optimistic status if the refresh fails.
      }
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Unable to update order status.");

      try {
        const refreshedOrder = await fetchOrderRecord();
        if (refreshedOrder) {
          setOrder(refreshedOrder);
          setLoadError(null);
        }
      } catch {
        // Leave the current view untouched if the refresh fails.
      }
    } finally {
      setIsStatusSubmitting(false);
    }
  };

  const confirmCancellation = async () => {
    if (!order || !confirmationAction || confirmationAction.type !== "cancel") {
      return;
    }

    setIsStatusSubmitting(true);
    setStatusError(null);

    try {
      await cancelAdminOrder({
        order,
        reason: DEFAULT_CANCEL_REASON,
        adminEmail: user?.email ?? storeConfig.contact.email,
      });

      setOrder({
        ...order,
        status: "cancelled",
        cancel_reason: DEFAULT_CANCEL_REASON,
        cancelled_at: new Date().toISOString(),
      });
      setConfirmationAction(null);
      setStatusSuccess(true);
      setLoadError(null);

      try {
        const refreshedOrder = await fetchOrderRecord();
        if (refreshedOrder) {
          setOrder(refreshedOrder);
        }
      } catch {
        // Keep the optimistic status if the refresh fails.
      }
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Unable to cancel order.");

      try {
        const refreshedOrder = await fetchOrderRecord();
        if (refreshedOrder) {
          setOrder(refreshedOrder);
          setLoadError(null);
        }
      } catch {
        // Leave the current view untouched if the refresh fails.
      }
    } finally {
      setIsStatusSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="admin-page bg-white font-body text-[12px] text-[var(--color-muted)]">Loading order...</div>;
  }

  if (loadError || !order) {
    return (
      <div className="admin-page bg-white">
        <p className="font-body text-[12px] text-[var(--color-danger)]">{loadError || "Order not found."}</p>
      </div>
    );
  }

  const isCancelled = order.status === "cancelled";
  const confirmationTitle = confirmationAction
    ? confirmationAction.type === "status"
      ? `Mark this order as ${buildStatusLabel(confirmationAction.stage)}?`
      : "Cancel this order?"
    : "";
  const confirmationDescription = confirmationAction
    ? confirmationAction.type === "status"
      ? "The customer will be notified automatically when you confirm."
      : "This order will be marked as cancelled and removed from the fulfillment flow."
    : "";
  const confirmationDismissLabel = confirmationAction?.type === "cancel" ? "Keep Order" : "Cancel";
  const confirmationConfirmLabel = confirmationAction?.type === "cancel"
    ? isStatusSubmitting
      ? "Cancelling..."
      : "Cancel Order"
    : isStatusSubmitting
      ? "Confirming..."
      : "Confirm";

  const renderStatusButtons = (buttonClassName: string) => (
    <div className="flex items-center gap-2">
      {FLOW_STAGES.map((stage) => {
        const isHighlighted = isStageHighlighted(order.status, stage);
        const isDisabled = isStatusSubmitting || getStatusPath(order.status, stage).length === 0;

        return (
          <button
            key={stage}
            type="button"
            data-stage-state={isHighlighted ? "active" : "inactive"}
            onClick={() => openStatusConfirmation(stage)}
            disabled={isDisabled}
            className={`${buttonClassName} ${
              isHighlighted
                ? "bg-[var(--color-primary)] text-[var(--color-secondary)]"
                : "bg-[rgba(var(--color-primary-rgb),0.06)] text-[var(--color-muted)]"
            } ${isDisabled ? "cursor-not-allowed opacity-100" : "hover:bg-[var(--color-primary)] hover:text-[var(--color-secondary)]"}`}
          >
            {buildStatusLabel(stage)}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="admin-page bg-white pb-36 pt-6 md:pb-40 lg:pb-10">
      <div className="mx-auto max-w-[1180px]">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)] lg:items-start lg:gap-6 xl:gap-8">
          <div className="space-y-4 lg:space-y-5">
            <header className="rounded-[28px] border border-[rgba(var(--color-primary-rgb),0.08)] bg-white p-5 shadow-[0_10px_24px_rgba(var(--color-navbar-solid-foreground-rgb),0.05)] lg:p-6">
              <Link
                to="/admin/orders"
                className="mb-4 inline-flex items-center gap-2 rounded-full border border-[rgba(var(--color-primary-rgb),0.12)] px-4 py-2 font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-primary)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.05)]"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
                Back to Orders
              </Link>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="font-body text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted-soft)]">Order</p>
                  <h1 className="font-display text-[32px] italic text-[var(--color-primary)] md:text-[36px]">{order.order_number}</h1>
                  <p className="font-body text-[14px] text-[var(--color-muted)]">{formatDateLong(order.created_at)}</p>
                </div>

                {paymentBadge ? (
                  <span
                    data-testid="payment-status-badge"
                    data-payment-state={paymentBadge.state}
                    className={`inline-flex w-fit rounded-full px-3 py-1.5 font-body text-[10px] font-semibold uppercase tracking-[0.14em] ${paymentBadge.className}`}
                  >
                    {paymentBadge.label}
                  </span>
                ) : null}
              </div>
            </header>

            <section className="space-y-3" aria-label="Order items">
              {order.order_items.map((item) => (
                <article
                  key={item.id}
                  className="flex items-start gap-4 rounded-[24px] border border-[rgba(var(--color-primary-rgb),0.08)] bg-white p-4 shadow-[0_10px_24px_rgba(var(--color-navbar-solid-foreground-rgb),0.05)] lg:p-5"
                >
                  <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-[rgba(var(--color-primary-rgb),0.06)] lg:h-24 lg:w-24">
                    {item.product_image_url ? (
                      <img src={item.product_image_url} alt={item.product_name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-[rgba(var(--color-primary-rgb),0.08)]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="font-body text-[17px] font-semibold leading-snug text-[var(--color-primary)] lg:text-[18px]">{item.product_name}</h2>
                    <p className="mt-2 font-body text-[13px] text-[var(--color-muted)]">Color: {item.variant_label || "Not specified"}</p>
                    <p className="mt-1 font-body text-[13px] text-[var(--color-muted)]">Qty: {item.quantity}</p>
                    <p className="mt-2 font-body text-[16px] font-semibold text-[var(--color-primary)]">{formatCurrency(item.subtotal)}</p>
                  </div>
                </article>
              ))}
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start lg:space-y-5">
            {isDesktop ? (
              <section
                data-testid="desktop-status-card"
                className="rounded-[24px] border border-[rgba(var(--color-primary-rgb),0.08)] bg-white p-5 shadow-[0_14px_32px_rgba(var(--color-navbar-solid-foreground-rgb),0.06)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-body text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted-soft)]">Order Status</p>
                    <p className="mt-2 font-body text-[18px] font-semibold text-[var(--color-primary)]">{buildStatusLabel(order.status)}</p>
                  </div>
                  {statusSuccess ? (
                    <span className="rounded-full border border-[rgba(var(--color-success-rgb),0.18)] bg-[rgba(var(--color-success-rgb),0.07)] px-3 py-1 font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-success)]">
                      Updated
                    </span>
                  ) : null}
                </div>

                {statusError ? <p className="mt-3 font-body text-[12px] text-[var(--color-danger)]">{statusError}</p> : null}

                {isCancelled ? (
                  <p className="mt-3 font-body text-[13px] leading-relaxed text-[var(--color-muted)]">
                    This order has been cancelled. No further processing is needed.
                  </p>
                ) : (
                  <>
                    <p className="mt-3 font-body text-[13px] leading-relaxed text-[var(--color-muted)]">
                      Confirm the next step below. Customers are notified automatically.
                    </p>

                    <div className="mt-4">
                      {renderStatusButtons("flex-1 rounded-2xl px-3 py-3.5 font-body text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors")}
                    </div>

                    <button
                      type="button"
                      onClick={openCancelConfirmation}
                      disabled={isStatusSubmitting}
                      className="mt-3 w-full rounded-2xl border border-[rgba(var(--color-danger-rgb),0.18)] px-4 py-3 font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-danger)] transition-colors hover:bg-[rgba(var(--color-danger-rgb),0.05)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancel Order
                    </button>
                  </>
                )}
              </section>
            ) : null}

            <section className="rounded-[24px] border border-[rgba(var(--color-primary-rgb),0.08)] bg-white p-4 shadow-[0_10px_24px_rgba(var(--color-navbar-solid-foreground-rgb),0.05)] lg:p-5">
              <p className="font-body text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted-soft)]">Customer</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-body text-[18px] font-semibold text-[var(--color-primary)]">{customerName}</p>
                  {order.customer.phone ? (
                    <p className="mt-1 font-body text-[15px] text-[var(--color-muted)]">{order.customer.phone}</p>
                  ) : (
                    <p className="mt-1 font-body text-[15px] text-[var(--color-muted)]">No phone number</p>
                  )}
                </div>

                {customerPhoneHref ? (
                  <a
                    href={customerPhoneHref}
                    aria-label={`Call ${customerName}`}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-[rgba(var(--color-primary-rgb),0.12)] text-[var(--color-primary)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.06)]"
                  >
                    <Phone className="h-4 w-4" strokeWidth={1.8} />
                  </a>
                ) : null}
              </div>
            </section>

            <section className="rounded-[24px] border border-[rgba(var(--color-primary-rgb),0.08)] bg-white p-4 shadow-[0_10px_24px_rgba(var(--color-navbar-solid-foreground-rgb),0.05)] lg:p-5">
              <p className="font-body text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted-soft)]">Delivery</p>
              {addressLines.length > 0 ? (
                <div className="mt-3 space-y-1.5 font-body text-[15px] leading-relaxed text-[var(--color-primary)]">
                  {addressLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              ) : (
                <p className="mt-3 font-body text-[15px] text-[var(--color-muted)]">No delivery address captured.</p>
              )}
            </section>
          </aside>
        </div>
      </div>

      {!isDesktop ? (
      <div
        data-testid="mobile-status-bar"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[rgba(var(--color-primary-rgb),0.08)] bg-white shadow-[0_-12px_30px_rgba(var(--color-navbar-solid-foreground-rgb),0.08)]"
      >
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 lg:px-6 xl:px-8">
          {statusSuccess ? (
            <p className="font-body text-[12px] text-[var(--color-accent)]">Order status updated.</p>
          ) : null}

          {!confirmationAction && statusError ? (
            <p className="font-body text-[12px] text-[var(--color-danger)]">{statusError}</p>
          ) : null}

          {isCancelled ? (
            <p className="font-body text-[13px] font-semibold text-[var(--color-danger)]">Order cancelled. No further processing needed.</p>
          ) : (
            <>
              {renderStatusButtons("flex-1 rounded-2xl px-3 py-4 font-body text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors")}
              <button
                type="button"
                onClick={openCancelConfirmation}
                disabled={isStatusSubmitting}
                className="w-full rounded-2xl border border-[rgba(var(--color-danger-rgb),0.18)] px-4 py-3 font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-danger)] transition-colors hover:bg-[rgba(var(--color-danger-rgb),0.05)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel Order
              </button>
            </>
          )}
        </div>
      </div>
      ) : null}

      {confirmationAction ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.45)] px-4"
          role="dialog"
          aria-modal="true"
          aria-label={confirmationTitle.replace(/\?$/, "")}
        >
          <div className="w-full max-w-[360px] rounded-[28px] bg-white p-5 shadow-[0_24px_60px_rgba(var(--color-navbar-solid-foreground-rgb),0.18)]">
            <h2 className="font-body text-[18px] font-semibold text-[var(--color-primary)]">{confirmationTitle}</h2>
            <p className="mt-2 font-body text-[14px] leading-relaxed text-[var(--color-muted)]">
              {confirmationDescription}
            </p>

            {statusError ? <p className="mt-3 font-body text-[12px] text-[var(--color-danger)]">{statusError}</p> : null}

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={closeConfirmation}
                disabled={isStatusSubmitting}
                className="flex-1 rounded-2xl border border-[rgba(var(--color-primary-rgb),0.14)] px-4 py-3 font-body text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-primary)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.04)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {confirmationDismissLabel}
              </button>
              <button
                type="button"
                onClick={() => void (confirmationAction.type === "cancel" ? confirmCancellation() : confirmStatusChange())}
                disabled={isStatusSubmitting}
                className={`flex-1 rounded-2xl px-4 py-3 font-body text-[12px] font-semibold uppercase tracking-[0.1em] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  confirmationAction.type === "cancel"
                    ? "bg-[var(--color-danger)] text-white hover:opacity-90"
                    : "bg-[var(--color-primary)] text-[var(--color-secondary)] hover:bg-[var(--color-accent)]"
                }`}
              >
                {confirmationConfirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminOrderDetailPage;
