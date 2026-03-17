import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import OrderSummaryDetails from "@/components/orders/OrderSummaryDetails";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { buildLiveStatusSteps, formatStatusLabel, getDeliveryWindow } from "@/lib/orderPresentation";
import { lookupOrderTrackingDetails, type OrderDetails } from "@/services/orderService";

const ORDER_NOT_FOUND_CODE = "PGRST116";

const ORDER_TRACKING_SELECT = `
  id,
  order_number,
  status,
  subtotal,
  shipping_fee,
  discount_amount,
  total,
  payment_method,
  mobile_money_number,
  shipping_address_snapshot,
  created_at,
  updated_at,
  confirmation_email_sent,
  customer_id,
  customers!orders_customer_id_fkey (
    id,
    first_name,
    last_name,
    email
  ),
  order_items (
    id,
    order_id,
    product_id,
    product_name,
    product_sku,
    product_image_url,
    unit_price,
    compare_at_price,
    quantity,
    subtotal,
    variant_id,
    variant_label,
    variant_sku,
    created_at
  ),
  order_status_history (
    new_status,
    note,
    changed_at
  )
`;

const TrackingSkeleton = () => (
  <div className="bg-[var(--color-secondary)] px-6 py-[80px] sm:px-6">
    <div className="mx-auto max-w-[640px]">
      <div className="lux-order-pulse h-3 w-[130px]" />
      <div className="lux-order-pulse mt-4 h-12 w-[320px] max-w-full" />
      <div className="lux-order-pulse mt-4 h-4 w-[340px] max-w-full" />
      <div className="my-12 border-b border-[var(--color-border)]" />
      <div className="lux-order-pulse mb-6 h-3 w-[120px]" />
      <div className="space-y-3">
        <div className="lux-order-pulse h-20 w-full" />
        <div className="lux-order-pulse h-20 w-full" />
      </div>
    </div>
  </div>
);

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: unknown): string => (typeof value === "string" ? value : "");
const readNumber = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const toCustomerEmail = (value: unknown): string => {
  if (Array.isArray(value)) {
    const first = value[0];
    if (isPlainRecord(first)) {
      return readString(first.email).trim().toLowerCase();
    }
    return "";
  }

  if (isPlainRecord(value)) {
    return readString(value.email).trim().toLowerCase();
  }

  return "";
};

const mapOrderRowToOrderDetails = (value: unknown): OrderDetails | null => {
  if (!isPlainRecord(value)) {
    return null;
  }

  const customerRaw = Array.isArray(value.customers) ? value.customers[0] : value.customers;
  if (!isPlainRecord(customerRaw)) {
    return null;
  }

  const orderItems = Array.isArray(value.order_items)
    ? value.order_items
        .filter((entry): entry is Record<string, unknown> => isPlainRecord(entry))
        .map((entry) => ({
          id: readString(entry.id),
          order_id: readString(entry.order_id),
          product_id: readString(entry.product_id),
          product_name: readString(entry.product_name),
          product_sku: readString(entry.product_sku) || null,
          product_image_url: readString(entry.product_image_url) || null,
          unit_price: readNumber(entry.unit_price),
          compare_at_price:
            typeof entry.compare_at_price === "number" && Number.isFinite(entry.compare_at_price)
              ? entry.compare_at_price
              : null,
          quantity: readNumber(entry.quantity),
          subtotal: readNumber(entry.subtotal),
          variant_id: readString(entry.variant_id) || null,
          variant_label: readString(entry.variant_label) || null,
          variant_sku: readString(entry.variant_sku) || null,
          created_at: readString(entry.created_at),
        }))
    : [];

  const statusHistory = Array.isArray(value.order_status_history)
    ? value.order_status_history
        .filter((entry): entry is Record<string, unknown> => isPlainRecord(entry))
        .map((entry) => ({
          status: readString(entry.new_status),
          note: readString(entry.note) || null,
          changed_at: readString(entry.changed_at),
        }))
        .filter((entry) => entry.status.length > 0)
        .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())
    : [];

  return {
    id: readString(value.id),
    order_number: readString(value.order_number),
    status: readString(value.status),
    subtotal: readNumber(value.subtotal),
    shipping_fee: readNumber(value.shipping_fee),
    discount_amount:
      typeof value.discount_amount === "number" && Number.isFinite(value.discount_amount) ? value.discount_amount : 0,
    total: readNumber(value.total),
    payment_method: readString(value.payment_method) || null,
    mobile_money_number: readString(value.mobile_money_number) || null,
    shipping_address_snapshot: value.shipping_address_snapshot ?? {},
    created_at: readString(value.created_at),
    updated_at: readString(value.updated_at) || null,
    confirmation_email_sent: Boolean(value.confirmation_email_sent),
    customer: {
      id: readString(customerRaw.id),
      first_name: readString(customerRaw.first_name),
      last_name: readString(customerRaw.last_name),
      email: readString(customerRaw.email),
    },
    order_items: orderItems,
    order_status_history: statusHistory,
  };
};

const formatChangedAt = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getStepCircleClass = (state: "completed" | "current" | "upcoming"): string => {
  if (state === "completed") {
    return "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-secondary)]";
  }

  if (state === "current") {
    return "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-secondary)]";
  }

  return "border-[var(--color-border)] bg-transparent text-[var(--color-muted)]";
};

const getConnectorClass = (
  state: "completed" | "current" | "upcoming",
  nextState: "completed" | "current" | "upcoming" | null,
): string => {
  if (state === "completed" && (nextState === "completed" || nextState === "current")) {
    return "border-[var(--color-accent)]";
  }

  return "border-[var(--color-border)] border-dashed";
};

const OrderTracking = () => {
  const { orderNumber: rawOrderNumber } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const orderNumberFromPath = (rawOrderNumber ?? "").trim();
  const [isLoading, setIsLoading] = useState(true);
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [lookupOrderNumber, setLookupOrderNumber] = useState(orderNumberFromPath);
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isSubmittingLookup, setIsSubmittingLookup] = useState(false);
  const [isNotFoundForUser, setIsNotFoundForUser] = useState(false);

  useEffect(() => {
    setLookupOrderNumber(orderNumberFromPath);
  }, [orderNumberFromPath]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!isAuthenticated) {
      setIsLoading(false);
      setIsNotFoundForUser(false);
      setOrder(null);
      return;
    }

    if (!orderNumberFromPath || !user?.id) {
      setOrder(null);
      setIsNotFoundForUser(true);
      setLookupError(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadAuthenticatedOrder = async () => {
      setIsLoading(true);
      setLookupError(null);
      setIsNotFoundForUser(false);

      try {
        const { data, error } = await supabase
          .from("orders")
          .select(ORDER_TRACKING_SELECT)
          .eq("order_number", orderNumberFromPath)
          .eq("customer_id", user.id)
          .maybeSingle();

        if (!isMounted) {
          return;
        }

        if (error) {
          throw error;
        }

        const mapped = mapOrderRowToOrderDetails(data);
        if (!mapped) {
          setOrder(null);
          setIsNotFoundForUser(true);
          return;
        }

        setOrder(mapped);
      } catch (lookupFailure) {
        if (import.meta.env.DEV) {
          console.error("Failed to load tracked order for authenticated user", lookupFailure);
        }

        if (!isMounted) {
          return;
        }

        setOrder(null);
        setIsNotFoundForUser(true);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadAuthenticatedOrder();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isAuthLoading, orderNumberFromPath, user?.id]);

  const handleGuestLookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedOrderNumber = lookupOrderNumber.trim().toUpperCase();
    const normalizedEmail = lookupEmail.trim().toLowerCase();

    if (!normalizedOrderNumber || !normalizedEmail) {
      setLookupError("No order found with these details. Please check and try again.");
      return;
    }

    setLookupError(null);
    setIsSubmittingLookup(true);

    try {
      const { data: directData, error: directError } = await supabase
        .from("orders")
        .select(ORDER_TRACKING_SELECT)
        .eq("order_number", normalizedOrderNumber)
        .maybeSingle();

      let trackedOrder: OrderDetails | null = null;

      if (!directError && directData) {
        const customerEmail = toCustomerEmail((directData as Record<string, unknown>).customers);
        if (customerEmail === normalizedEmail) {
          trackedOrder = mapOrderRowToOrderDetails(directData);
        }
      }

      if (!trackedOrder) {
        const fallbackOrder = await lookupOrderTrackingDetails(normalizedOrderNumber, normalizedEmail);
        trackedOrder = fallbackOrder;
      }

      if (!trackedOrder) {
        setLookupError("No order found with these details. Please check and try again.");
        setOrder(null);
        return;
      }

      setOrder(trackedOrder);
      setIsNotFoundForUser(false);

      if (normalizedOrderNumber !== orderNumberFromPath) {
        navigate(`/orders/${encodeURIComponent(normalizedOrderNumber)}`, { replace: true });
      }
    } catch (lookupFailure) {
      if (import.meta.env.DEV) {
        console.error("Guest order lookup failed", lookupFailure);
      }

      const code = (lookupFailure as { code?: string }).code;
      if (code === ORDER_NOT_FOUND_CODE) {
        setLookupError("No order found with these details. Please check and try again.");
      } else {
        setLookupError("No order found with these details. Please check and try again.");
      }
      setOrder(null);
    } finally {
      setIsSubmittingLookup(false);
    }
  };

  const deliveryWindow = useMemo(
    () => (order ? getDeliveryWindow(order.shipping_address_snapshot) : { minDays: 3, maxDays: 5 }),
    [order],
  );

  const liveStatusSteps = useMemo(
    () => (order ? buildLiveStatusSteps(order.status, order.order_status_history) : []),
    [order],
  );

  if (isAuthLoading || isLoading) {
    return <TrackingSkeleton />;
  }

  if (!order && !isAuthenticated) {
    return (
      <div className="bg-[var(--color-secondary)] px-6 py-[80px] sm:px-6">
        <div className="mx-auto max-w-[640px]">
          <h1 className="font-display text-[38px] italic font-light text-[var(--color-primary)] sm:text-[48px]">Track Your Order</h1>

          <form onSubmit={handleGuestLookup} className="mt-8">
            <div className="mb-5">
              <label
                htmlFor="order-tracking-order-number"
                className="mb-2 block font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted)]"
              >
                Order Number
              </label>
              <input
                id="order-tracking-order-number"
                type="text"
                value={lookupOrderNumber}
                onChange={(event) => setLookupOrderNumber(event.target.value)}
                placeholder="LUX-2026-00001"
                className="w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-[10px] font-body text-[14px] text-[var(--color-primary)] placeholder:text-[var(--color-muted-soft)] outline-none transition-colors focus:border-[var(--color-primary)]"
                autoComplete="off"
              />
            </div>

            <div>
              <label
                htmlFor="order-tracking-email"
                className="mb-2 block font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted)]"
              >
                Email Address
              </label>
              <input
                id="order-tracking-email"
                type="email"
                value={lookupEmail}
                onChange={(event) => setLookupEmail(event.target.value)}
                placeholder="Email used at checkout"
                className="w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-[10px] font-body text-[14px] text-[var(--color-primary)] placeholder:text-[var(--color-muted-soft)] outline-none transition-colors focus:border-[var(--color-primary)]"
                autoComplete="email"
              />
            </div>

            {lookupError ? <p className="mt-4 font-body text-[12px] text-[var(--color-danger)]">{lookupError}</p> : null}

            <button
              type="submit"
              disabled={isSubmittingLookup}
              className="mt-7 w-full rounded-[var(--border-radius)] bg-[var(--color-primary)] px-6 py-4 font-body text-[11px] uppercase tracking-[0.15em] text-[var(--color-secondary)] transition-colors duration-200 hover:bg-[var(--color-accent)] hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmittingLookup ? "Finding..." : "Find Order"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!order && isAuthenticated && isNotFoundForUser) {
    return (
      <div className="bg-[var(--color-secondary)] px-6 py-[80px] sm:px-6">
        <div className="mx-auto max-w-[640px] text-center">
          <p className="font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">404</p>
          <h1 className="mt-3 font-display text-[38px] italic font-light text-[var(--color-primary)] sm:text-[48px]">Order not found</h1>
          <p className="mt-4 font-body text-[13px] font-light text-[var(--color-muted)]">
            We could not find this order under your account.
          </p>
          <Link
            to="/shop"
            className="mt-8 inline-block font-body text-[11px] uppercase tracking-[0.15em] text-[var(--color-primary)] transition-colors duration-200 hover:text-[var(--color-accent)]"
          >
            Go to Shop
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-[var(--color-secondary)] px-6 py-[80px] sm:px-6">
        <div className="mx-auto max-w-[640px] text-center">
          <p className="font-body text-[13px] text-[var(--color-muted)]">{lookupError || "We couldn't load your order details right now."}</p>
          <Link
            to="/shop"
            className="mt-6 inline-block font-body text-[11px] uppercase tracking-[0.15em] text-[var(--color-primary)] transition-colors duration-200 hover:text-[var(--color-accent)]"
          >
            Go to Shop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-secondary)] px-6 py-[80px] sm:px-6">
      <div className="mx-auto max-w-[640px]">
        <section>
          <p className="font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Order Tracking</p>
          <h1 className="mt-3 font-display text-[38px] italic font-light text-[var(--color-primary)] sm:text-[48px]">
            Order {order.order_number}
          </h1>
          <p className="mt-3 font-body text-[13px] font-light text-[var(--color-muted)]">
            Current status: <span className="text-[var(--color-primary)]">{formatStatusLabel(order.status)}</span>
          </p>
          <div className="my-12 border-b border-[var(--color-border)]" />
        </section>

        <OrderSummaryDetails order={order} deliveryWindow={deliveryWindow} />

        <section>
          <p className="mb-6 font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Order Status</p>

          <div>
            {liveStatusSteps.map((step, index) => {
              const nextStep = liveStatusSteps[index + 1];
              const labelColor =
                step.state === "upcoming"
                  ? "text-[var(--color-muted-soft)]"
                  : step.state === "current"
                    ? "font-medium text-[var(--color-primary)]"
                    : "text-[var(--color-primary)]";

              return (
                <div key={step.key}>
                  <div className="flex items-start gap-4">
                    <span
                      className={`mt-[1px] flex h-[20px] w-[20px] items-center justify-center rounded-full border font-body text-[10px] ${getStepCircleClass(step.state)}`}
                    >
                      {index + 1}
                    </span>

                    <div className="pt-[1px]">
                      <p className={`font-body text-[13px] ${labelColor}`}>{step.label}</p>
                      <p
                        className={`mt-1 font-body text-[11px] font-light ${
                          step.state === "upcoming" ? "text-[var(--color-muted-soft)]" : "text-[var(--color-muted)]"
                        }`}
                      >
                        {step.note || step.description}
                      </p>
                      {step.changedAt ? (
                        <p className="mt-1 font-body text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted-soft)]">
                          {formatChangedAt(step.changedAt)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {index < liveStatusSteps.length - 1 ? (
                    <div className={`ml-[9px] h-[24px] border-l ${getConnectorClass(step.state, nextStep?.state ?? null)}`} />
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="my-8 border-b border-[var(--color-border)]" />
        </section>

        <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/shop"
            className="font-body text-[11px] uppercase tracking-[0.15em] text-[var(--color-primary)] transition-colors duration-200 hover:text-[var(--color-accent)]"
          >
            &larr; Continue Shopping
          </Link>
          <Link
            to="/checkout/confirmation"
            className="font-body text-[11px] uppercase tracking-[0.15em] text-[var(--color-primary)] transition-colors duration-200 hover:text-[var(--color-accent)]"
          >
            Back to Confirmation &rarr;
          </Link>
        </section>
      </div>
    </div>
  );
};

export default OrderTracking;


