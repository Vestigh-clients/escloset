import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import OrderSummaryDetails from "@/components/orders/OrderSummaryDetails";
import { useAuth } from "@/contexts/AuthContext";
import { buildLiveStatusSteps, formatStatusLabel, getDeliveryWindow } from "@/lib/orderPresentation";
import { lookupOrderTrackingDetails, type OrderDetails } from "@/services/orderService";

const TrackingSkeleton = () => (
  <div className="bg-[#F5F0E8] px-6 py-[80px] sm:px-6">
    <div className="mx-auto max-w-[640px]">
      <div className="lux-order-pulse h-3 w-[130px]" />
      <div className="lux-order-pulse mt-4 h-12 w-[320px] max-w-full" />
      <div className="lux-order-pulse mt-4 h-4 w-[340px] max-w-full" />
      <div className="my-12 border-b border-[#d4ccc2]" />
      <div className="lux-order-pulse mb-6 h-3 w-[120px]" />
      <div className="space-y-3">
        <div className="lux-order-pulse h-20 w-full" />
        <div className="lux-order-pulse h-20 w-full" />
      </div>
    </div>
  </div>
);

const formatChangedAt = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getStepCircleClass = (state: "completed" | "current" | "upcoming"): string => {
  if (state === "completed") {
    return "border-[#C4A882] bg-[#C4A882] text-[#F5F0E8]";
  }

  if (state === "current") {
    return "border-[#1A1A1A] bg-[#1A1A1A] text-[#F5F0E8]";
  }

  return "border-[#d4ccc2] bg-transparent text-[#888888]";
};

const getConnectorClass = (
  state: "completed" | "current" | "upcoming",
  nextState: "completed" | "current" | "upcoming" | null,
): string => {
  if (state === "completed" && (nextState === "completed" || nextState === "current")) {
    return "border-[#C4A882]";
  }

  return "border-[#d4ccc2] border-dashed";
};

const OrderTracking = () => {
  const { orderNumber: rawOrderNumber } = useParams();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const orderNumber = (rawOrderNumber ?? "").trim();
  const [isLoading, setIsLoading] = useState(true);
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isSubmittingLookup, setIsSubmittingLookup] = useState(false);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!orderNumber) {
      setIsLoading(false);
      setLookupError("Invalid order number.");
      return;
    }

    let isMounted = true;

    const initialize = async () => {
      setIsLoading(true);
      setLookupError(null);
      if (!isAuthenticated) {
        if (isMounted) {
          setOrder(null);
          setLookupError(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const trackedOrder = await lookupOrderTrackingDetails(orderNumber, null);
        if (!isMounted) {
          return;
        }

        if (!trackedOrder) {
          setLookupError("We couldn't verify this order under your account.");
          setOrder(null);
        } else {
          setOrder(trackedOrder);
        }
      } catch (lookupFailure) {
        if (import.meta.env.DEV) {
          console.error("Failed to load tracked order for authenticated user", lookupFailure);
        }
        if (isMounted) {
          setLookupError("We couldn't verify this order under your account.");
          setOrder(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isAuthLoading, orderNumber]);

  const handleGuestLookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = lookupEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setLookupError("Enter the email used when placing this order.");
      return;
    }

    setLookupError(null);
    setIsSubmittingLookup(true);

    try {
      const trackedOrder = await lookupOrderTrackingDetails(orderNumber, normalizedEmail);
      if (!trackedOrder) {
        setLookupError("No order found for this order number and email combination.");
        setOrder(null);
        setIsLoading(false);
        return;
      }

      setOrder(trackedOrder);
    } catch (lookupFailure) {
      if (import.meta.env.DEV) {
        console.error("Guest order lookup failed", lookupFailure);
      }
      setLookupError("We couldn't verify your order right now. Please try again.");
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
      <div className="bg-[#F5F0E8] px-6 py-[80px] sm:px-6">
        <div className="mx-auto max-w-[640px]">
          <p className="font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Order Tracking</p>
          <h1 className="mt-3 font-display text-[38px] italic font-light text-[#1A1A1A] sm:text-[48px]">
            Track your order
          </h1>
          <p className="mt-3 font-body text-[13px] font-light text-[#888888]">
            Enter the email used for order <span className="text-[#1A1A1A]">{orderNumber || "-"}</span> to view status.
          </p>

          <form onSubmit={handleGuestLookup} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="order-tracking-email"
                className="mb-2 block font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]"
              >
                Email
              </label>
              <input
                id="order-tracking-email"
                type="email"
                value={lookupEmail}
                onChange={(event) => setLookupEmail(event.target.value)}
                placeholder="you@example.com"
                className="h-[48px] w-full border border-[#d4ccc2] bg-transparent px-4 font-body text-[14px] text-[#1A1A1A] outline-none transition-colors focus:border-[#1A1A1A]"
                autoComplete="email"
                required
              />
            </div>

            {lookupError ? <p className="font-body text-[12px] text-[#C0392B]">{lookupError}</p> : null}

            <button
              type="submit"
              disabled={isSubmittingLookup}
              className="h-[48px] w-full bg-[#1A1A1A] px-6 font-body text-[11px] uppercase tracking-[0.15em] text-[#F5F0E8] transition-colors duration-200 hover:bg-[#C4A882] hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmittingLookup ? "Checking..." : "View Order"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-[#F5F0E8] px-6 py-[80px] sm:px-6">
        <div className="mx-auto max-w-[640px] text-center">
          <p className="font-body text-[13px] text-[#888888]">
            {lookupError || "We couldn't load your order details right now."}
          </p>
          <Link
            to="/shop"
            className="mt-6 inline-block font-body text-[11px] uppercase tracking-[0.15em] text-[#1A1A1A] transition-colors duration-200 hover:text-[#C4A882]"
          >
            Go to Shop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F5F0E8] px-6 py-[80px] sm:px-6">
      <div className="mx-auto max-w-[640px]">
        <section>
          <p className="font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Order Tracking</p>
          <h1 className="mt-3 font-display text-[38px] italic font-light text-[#1A1A1A] sm:text-[48px]">
            Order {order.order_number}
          </h1>
          <p className="mt-3 font-body text-[13px] font-light text-[#888888]">
            Current status: <span className="text-[#1A1A1A]">{formatStatusLabel(order.status)}</span>
          </p>
          <div className="my-12 border-b border-[#d4ccc2]" />
        </section>

        <OrderSummaryDetails order={order} deliveryWindow={deliveryWindow} />

        <section>
          <p className="mb-6 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Order Status</p>

          <div>
            {liveStatusSteps.map((step, index) => {
              const nextStep = liveStatusSteps[index + 1];
              const labelColor =
                step.state === "upcoming"
                  ? "text-[#aaaaaa]"
                  : step.state === "current"
                    ? "font-medium text-[#1A1A1A]"
                    : "text-[#1A1A1A]";

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
                      <p className={`mt-1 font-body text-[11px] font-light ${step.state === "upcoming" ? "text-[#aaaaaa]" : "text-[#888888]"}`}>
                        {step.note || step.description}
                      </p>
                      {step.changedAt ? (
                        <p className="mt-1 font-body text-[10px] uppercase tracking-[0.08em] text-[#aaaaaa]">
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

          <div className="my-8 border-b border-[#d4ccc2]" />
        </section>

        <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/shop"
            className="font-body text-[11px] uppercase tracking-[0.15em] text-[#1A1A1A] transition-colors duration-200 hover:text-[#C4A882]"
          >
            &larr; Continue Shopping
          </Link>
          <Link
            to="/checkout/confirmation"
            className="font-body text-[11px] uppercase tracking-[0.15em] text-[#1A1A1A] transition-colors duration-200 hover:text-[#C4A882]"
          >
            Back to Confirmation &rarr;
          </Link>
        </section>
      </div>
    </div>
  );
};

export default OrderTracking;
