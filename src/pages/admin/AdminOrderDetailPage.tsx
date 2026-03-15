import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  buildStatusLabel,
  cancelAdminOrder,
  fetchAdminOrderDetail,
  updateAdminOrderStatus,
  updateAdminPaymentStatus,
  type AdminOrderDetail,
} from "@/services/adminService";
import { formatCurrency, formatDateLong, formatRelativeDate } from "@/lib/adminFormatting";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";

const statusBadgeClass: Record<string, string> = {
  pending: "border border-[#d4ccc2] text-[#555555]",
  confirmed: "border border-[#1A1A1A] text-[#1A1A1A]",
  processing: "border border-[#C4A882] text-[#C4A882]",
  shipped: "bg-[#C4A882] text-[#1A1A1A]",
  delivered: "bg-[#1A1A1A] text-[#F5F0E8]",
  cancelled: "border border-[#C0392B] text-[#C0392B]",
};

const paymentBadgeClass: Record<string, string> = {
  unpaid: "border border-[#d4ccc2] text-[#777777]",
  paid: "border border-[#27AE60] text-[#27AE60]",
  refunded: "border border-[#C0392B] text-[#C0392B]",
  partially_refunded: "border border-[#C4A882] text-[#C4A882]",
};

const paymentStatuses = [
  { label: "Unpaid", value: "unpaid" },
  { label: "Paid", value: "paid" },
  { label: "Refunded", value: "refunded" },
  { label: "Partially Refunded", value: "partially_refunded" },
] as const;

const nextStatusMap: Record<string, Array<string>> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

const toTitleCase = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

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

  return [record.recipient_name, record.address_line1, record.address_line2, cityState, record.country]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .map((value) => String(value).trim());
};

const AdminOrderDetailPage = () => {
  const { orderNumber } = useParams();
  const { user } = useAuth();

  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [nextStatus, setNextStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [notifyCustomer, setNotifyCustomer] = useState(false);
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false);
  const [statusSuccess, setStatusSuccess] = useState(false);

  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [paymentReference, setPaymentReference] = useState("");
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  const loadOrder = async () => {
    if (!orderNumber) {
      setOrder(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await fetchAdminOrderDetail(orderNumber);
      setOrder(data);
      setPaymentStatus(data.payment_status);
      setPaymentReference(data.payment_reference || "");
    } catch {
      setOrder(null);
      setLoadError("Unable to load order details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber]);

  const availableNextStatuses = useMemo(() => {
    if (!order) return [];
    return nextStatusMap[order.status] ?? [];
  }, [order]);

  useEffect(() => {
    if (!nextStatus) return;
    if (nextStatus === "shipped" || nextStatus === "delivered") {
      setNotifyCustomer(true);
      return;
    }

    setNotifyCustomer(false);
  }, [nextStatus]);

  useEffect(() => {
    if (!statusSuccess) return;
    const timeout = window.setTimeout(() => setStatusSuccess(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [statusSuccess]);

  useEffect(() => {
    if (!paymentSuccess) return;
    const timeout = window.setTimeout(() => setPaymentSuccess(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [paymentSuccess]);

  useEffect(() => {
    if (!cancelSuccess) return;
    const timeout = window.setTimeout(() => setCancelSuccess(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [cancelSuccess]);

  if (isLoading) {
    return <div className="admin-page font-body text-[12px] text-[#555555]">Loading order...</div>;
  }

  if (loadError || !order) {
    return (
      <div className="admin-page">
        <p className="font-body text-[12px] text-[#C0392B]">{loadError || "Order not found."}</p>
      </div>
    );
  }

  const addressLines = formatAddressLines(order.shipping_address_snapshot);
  const canCancel = order.status !== "delivered" && order.status !== "cancelled";

  const onUpdateStatus = async () => {
    if (!nextStatus || !order) return;
    setIsStatusSubmitting(true);
    try {
      await updateAdminOrderStatus({
        order,
        nextStatus: nextStatus as AdminOrderDetail["status"],
        note: statusNote,
        notifyCustomer,
        adminEmail: user?.email ?? "admin@luxuriant.com",
      });
      setStatusSuccess(true);
      setNextStatus("");
      setStatusNote("");
      await loadOrder();
    } finally {
      setIsStatusSubmitting(false);
    }
  };

  const onUpdatePayment = async () => {
    if (!order) return;
    setIsPaymentSubmitting(true);
    try {
      await updateAdminPaymentStatus({
        order,
        paymentStatus: paymentStatus as AdminOrderDetail["payment_status"],
        paymentReference,
      });
      setPaymentSuccess(true);
      await loadOrder();
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  const onConfirmCancellation = async () => {
    if (!order) return;
    if (cancelReason.trim().length < 10) return;

    setIsCancelling(true);
    try {
      await cancelAdminOrder({
        order,
        reason: cancelReason,
        adminEmail: user?.email ?? "admin@luxuriant.com",
      });
      setCancelSuccess(true);
      setIsCancelOpen(false);
      setCancelReason("");
      await loadOrder();
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="order-detail-layout grid gap-10 lg:grid-cols-[65%_35%]">
        <div className="order-detail-left">
          <header>
            <h1 className="admin-page-title font-display text-[32px] italic text-[#1A1A1A]">{order.order_number}</h1>
            <p className="mt-1 font-body text-[11px] text-[#777777]">{formatDateLong(order.created_at)}</p>
            <div className="mt-4 flex items-center gap-2">
              <span
                className={`rounded-[2px] px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${
                  statusBadgeClass[order.status] ?? "border border-[#d4ccc2] text-[#555555]"
                }`}
              >
                {buildStatusLabel(order.status)}
              </span>
              <span
                className={`rounded-[2px] px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${
                  paymentBadgeClass[order.payment_status] ?? "border border-[#d4ccc2] text-[#777777]"
                }`}
              >
                {toTitleCase(order.payment_status)}
              </span>
            </div>
          </header>

          <div className="my-8 border-b border-[#d4ccc2]" />

          <section>
            <p className="mb-5 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Order Items</p>
            <div>
              {order.order_items.map((item) => (
                <div key={item.id} className="flex gap-4 border-b border-[#d4ccc2] py-4">
                  <div className="h-[75px] w-[56px] overflow-hidden bg-[#ede5db]">
                    {item.product_image_url ? (
                      <img src={item.product_image_url} alt={item.product_name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-[#e2d9cf]" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-display text-[16px] italic text-[#1A1A1A]">{item.product_name}</p>
                    <p className="font-body text-[10px] text-[#777777]">{item.product_sku || "No SKU"}</p>
                    {item.variant_label ? (
                      <p className="mt-[2px] font-body text-[11px] text-[#555555]">
                        {item.variant_label}
                      </p>
                    ) : null}
                    <p className="mt-1 font-body text-[12px] text-[#555555]">{formatCurrency(item.unit_price)} each</p>
                    <p className="font-body text-[11px] text-[#555555]">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-body text-[13px] text-[#1A1A1A]">{formatCurrency(item.subtotal)}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="ml-auto mt-6 w-full max-w-[280px]">
            <div className="flex items-center justify-between py-1 font-body text-[12px] text-[#555555]">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between py-1 font-body text-[12px] text-[#555555]">
              <span>Shipping</span>
              <span>{formatCurrency(order.shipping_fee)}</span>
            </div>
            {order.discount_amount ? (
              <div className="flex items-center justify-between py-1 font-body text-[12px] text-[#C4A882]">
                <span>Discount</span>
                <span>- {formatCurrency(order.discount_amount)}</span>
              </div>
            ) : null}
            <div className="my-2 border-b border-[#d4ccc2]" />
            <div className="flex items-center justify-between py-1 font-body text-[15px] font-medium text-[#1A1A1A]">
              <span>Total</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>

          <div className="my-8 border-b border-[#d4ccc2]" />

          <section>
            <p className="mb-3 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Delivering To</p>
            {addressLines.length > 0 ? (
              <div className="space-y-1 font-body text-[13px] text-[#555555]">
                {addressLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : (
              <p className="font-body text-[13px] text-[#555555]">No delivery address captured.</p>
            )}
            {parseSnapshot(order.shipping_address_snapshot)?.delivery_instructions ? (
              <p className="mt-2 font-body text-[12px] italic text-[#777777]">
                {String(parseSnapshot(order.shipping_address_snapshot)?.delivery_instructions)}
              </p>
            ) : null}
          </section>

          <div className="my-8 border-b border-[#d4ccc2]" />

          <section>
            <p className="mb-3 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Payment</p>
            <p className="font-body text-[13px] text-[#555555]">{toTitleCase(order.payment_method || "not specified")}</p>
            {order.payment_reference ? <p className="mt-1 font-body text-[11px] text-[#777777]">Ref: {order.payment_reference}</p> : null}
            {order.mobile_money_number ? (
              <p className="mt-1 font-body text-[11px] text-[#777777]">Mobile Money: {order.mobile_money_number}</p>
            ) : null}
          </section>

          {order.notes ? (
            <>
              <div className="my-8 border-b border-[#d4ccc2]" />
              <section>
                <p className="mb-3 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Customer Notes</p>
                <p className="font-body text-[13px] italic text-[#555555]">{order.notes}</p>
              </section>
            </>
          ) : null}

          <div className="my-8 border-b border-[#d4ccc2]" />

          <section>
            <p className="mb-5 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Order History</p>
            <div>
              {order.order_status_history.map((entry, index) => {
                const isLatest = index === 0;
                return (
                  <div key={`${entry.new_status}-${entry.changed_at}`} className="relative flex gap-4 pb-6">
                    <div className="relative flex w-4 justify-center">
                      <span className={`mt-1 h-[10px] w-[10px] rounded-full ${isLatest ? "bg-[#1A1A1A]" : "bg-[#C4A882]"}`} />
                      {index < order.order_status_history.length - 1 ? (
                        <span className="absolute top-[16px] left-[7px] h-[32px] border-l border-[#d4ccc2]" />
                      ) : null}
                    </div>
                    <div>
                      <p className="font-body text-[12px] uppercase tracking-[0.08em] text-[#1A1A1A]">
                        {buildStatusLabel(entry.new_status)}
                      </p>
                      {entry.note ? <p className="mt-0.5 font-body text-[11px] font-light text-[#555555]">{entry.note}</p> : null}
                      <p className="mt-0.5 font-body text-[10px] text-[#777777]">
                        {entry.changed_by || "System"} {"\u00B7"} {formatRelativeDate(entry.changed_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="order-detail-right border-l border-[#d4ccc2] pl-0 lg:sticky lg:top-20 lg:h-fit lg:pl-10">
          <section>
            <p className="mb-4 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Update Status</p>
            <select
              value={nextStatus}
              onChange={(event) => setNextStatus(event.target.value)}
              className="w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
            >
              <option value="">Select next status</option>
              {availableNextStatuses.map((status) => (
                <option key={status} value={status}>
                  {buildStatusLabel(status)}
                </option>
              ))}
            </select>

            <textarea
              value={statusNote}
              onChange={(event) => setStatusNote(event.target.value)}
              placeholder="Note about this status change..."
              className="mt-4 min-h-20 w-full resize-none border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none placeholder:text-[#999999] focus:border-[#1A1A1A]"
            />

            <label className="mt-4 flex items-center gap-2 font-body text-[12px] text-[#555555]">
              <input
                type="checkbox"
                checked={notifyCustomer}
                onChange={(event) => setNotifyCustomer(event.target.checked)}
                className="h-3.5 w-3.5 accent-[#1A1A1A]"
              />
              Notify customer
            </label>

            <button
              type="button"
              onClick={() => void onUpdateStatus()}
              disabled={!nextStatus || isStatusSubmitting}
              className="mt-4 w-full rounded-[2px] bg-[#1A1A1A] px-4 py-3 font-body text-[11px] uppercase tracking-[0.12em] text-[#F5F0E8] transition-colors hover:bg-[#C4A882] hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isStatusSubmitting ? "Updating..." : "Update Status"}
            </button>
            {statusSuccess ? <p className="mt-2 font-body text-[12px] text-[#C4A882]">Status updated.</p> : null}
          </section>

          <div className="my-7 border-b border-[#d4ccc2]" />

          <section>
            <p className="mb-4 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Payment Status</p>
            <select
              value={paymentStatus}
              onChange={(event) => setPaymentStatus(event.target.value)}
              className="w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
            >
              {paymentStatuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

            <input
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
              placeholder="Transaction reference (optional)"
              className="mt-3 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none placeholder:text-[#999999] focus:border-[#1A1A1A]"
            />

            <button
              type="button"
              onClick={() => void onUpdatePayment()}
              disabled={isPaymentSubmitting}
              className="mt-4 w-full rounded-[2px] bg-[#1A1A1A] px-4 py-3 font-body text-[11px] uppercase tracking-[0.12em] text-[#F5F0E8] transition-colors hover:bg-[#C4A882] hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPaymentSubmitting ? "Updating..." : "Update Payment"}
            </button>
            {paymentSuccess ? <p className="mt-2 font-body text-[12px] text-[#C4A882]">Payment status updated.</p> : null}
          </section>

          <div className="my-7 border-b border-[#d4ccc2]" />

          <section>
            <p className="mb-4 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Customer</p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1A1A1A] font-body text-[16px] text-[#F5F0E8]">
                {(order.customer.first_name.slice(0, 1) || "C").toUpperCase()}
              </div>
              <div>
                <p className="font-body text-[13px] text-[#1A1A1A]">{`${order.customer.first_name} ${order.customer.last_name}`.trim()}</p>
                <p className="font-body text-[11px] text-[#777777]">{order.customer.email}</p>
                {order.customer.phone ? <p className="font-body text-[11px] text-[#777777]">{order.customer.phone}</p> : null}
              </div>
            </div>

            <Link
              to={`/admin/customers/${order.customer.id}`}
              className="mt-3 inline-block font-body text-[10px] uppercase tracking-[0.1em] text-[#C4A882] transition-colors hover:text-[#1A1A1A]"
            >
              View Customer &rarr;
            </Link>
            <p className="mt-2 font-body text-[11px] text-[#777777]">
              {(order.customer.total_orders ?? 0).toLocaleString("en-GH")} orders {"\u00B7"}{" "}
              {formatCurrency(order.customer.total_spent ?? 0)} total spent
            </p>
          </section>

          {canCancel ? (
            <>
              <div className="my-7 border-b border-[#d4ccc2]" />
              <section>
                {!isCancelOpen ? (
                  <button
                    type="button"
                    onClick={() => setIsCancelOpen(true)}
                    className="font-body text-[10px] uppercase tracking-[0.1em] text-[#777777] transition-colors hover:text-[#C0392B]"
                  >
                    Cancel Order
                  </button>
                ) : (
                  <div>
                    <textarea
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      placeholder="Reason for cancellation"
                      className="min-h-20 w-full resize-none border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none placeholder:text-[#999999] focus:border-[#1A1A1A]"
                    />
                    <button
                      type="button"
                      onClick={() => void onConfirmCancellation()}
                      disabled={cancelReason.trim().length < 10 || isCancelling}
                      className="mt-3 w-full rounded-[2px] bg-[#C0392B] px-4 py-3 font-body text-[11px] uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCancelOpen(false);
                        setCancelReason("");
                      }}
                      className="mt-2 font-body text-[10px] text-[#777777]"
                    >
                      Never mind
                    </button>
                  </div>
                )}
                {cancelSuccess ? <p className="mt-2 font-body text-[12px] text-[#C4A882]">Order cancelled.</p> : null}
              </section>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
};

export default AdminOrderDetailPage;

