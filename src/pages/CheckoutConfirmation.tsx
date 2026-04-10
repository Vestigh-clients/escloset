import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router";
import OrderSummaryDetails from "@/components/orders/OrderSummaryDetails";
import { storeConfig, storeKeyPrefix } from "@/config/store.config";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { getDeliveryWindow } from "@/lib/orderPresentation";
import {
  fetchOrderConfirmationDetails,
  type OrderDetails,
} from "@/services/orderService";

const LAST_ORDER_STORAGE_KEY = `${storeKeyPrefix}_last_order`;
const CUSTOMER_NOT_FOUND_CODE = "PGRST116";

const AnimatedCheckmark = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 64 64"
    fill="none"
    aria-hidden="true"
    className="mx-auto"
    role="img"
  >
    <circle
      cx="32"
      cy="32"
      r="30"
      stroke="var(--color-accent)"
      strokeWidth="1.5"
      className="lux-check-circle"
      strokeLinecap="round"
    />
    <path
      d="M20 33L28.5 41.5L45 24"
      stroke="var(--color-accent)"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lux-check-path"
    />
  </svg>
);

const ConfirmationSkeleton = () => (
  <div className="bg-[var(--color-secondary)] px-6 py-[80px] sm:px-6">
    <div className="mx-auto max-w-[640px]">
      <div className="flex flex-col items-center">
        <div className="lux-order-pulse h-[64px] w-[64px] rounded-full" />
        <div className="lux-order-pulse mt-6 h-3 w-[120px]" />
        <div className="lux-order-pulse mt-4 h-12 w-[300px] max-w-full" />
        <div className="lux-order-pulse mt-3 h-4 w-[320px] max-w-full" />
        <div className="lux-order-pulse mt-3 h-4 w-[260px] max-w-full" />
      </div>

      <div className="my-12 border-b border-[var(--color-border)]" />

      <div>
        <div className="lux-order-pulse mb-6 h-3 w-[120px]" />

        <div className="space-y-4 border-b border-[var(--color-border)] pb-5">
          {[0, 1].map((entry) => (
            <div key={entry} className="flex items-start gap-4">
              <div className="lux-order-pulse h-[64px] w-[48px] flex-shrink-0 sm:h-[86px] sm:w-[64px]" />
              <div className="min-w-0 flex-1">
                <div className="lux-order-pulse h-4 w-[200px] max-w-full" />
                <div className="lux-order-pulse mt-2 h-3 w-[100px]" />
                <div className="lux-order-pulse mt-2 h-3 w-[72px]" />
              </div>
              <div className="lux-order-pulse h-3 w-[84px]" />
            </div>
          ))}
        </div>

        <div className="space-y-3 py-6">
          <div className="lux-order-pulse h-3 w-full" />
          <div className="lux-order-pulse h-3 w-full" />
          <div className="lux-order-pulse h-4 w-full" />
        </div>
      </div>
    </div>
  </div>
);

const hasUppercaseLetter = (value: string) => /[A-Z]/.test(value);
const hasNumber = (value: string) => /[0-9]/.test(value);

const resolveOrderEmail = (order: OrderDetails): string => {
  const payloadEmail = typeof order.contact_email === "string" ? order.contact_email.trim().toLowerCase() : "";
  if (payloadEmail) {
    return payloadEmail;
  }

  if (
    order.shipping_address_snapshot &&
    typeof order.shipping_address_snapshot === "object" &&
    !Array.isArray(order.shipping_address_snapshot)
  ) {
    const snapshot = order.shipping_address_snapshot as Record<string, unknown>;
    const snapshotEmailCandidate =
      (typeof snapshot.email === "string" ? snapshot.email : null) ??
      (typeof snapshot.contact_email === "string" ? snapshot.contact_email : null) ??
      (typeof snapshot.recipient_email === "string" ? snapshot.recipient_email : null);
    const snapshotEmail = snapshotEmailCandidate?.trim().toLowerCase() ?? "";
    if (snapshotEmail) {
      return snapshotEmail;
    }
  }

  return order.customer.email.trim().toLowerCase();
};

const CheckoutConfirmation = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { clearCart } = useCart();

  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accountCreateError, setAccountCreateError] = useState<string | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isAccountCreated, setIsAccountCreated] = useState(false);
  const [isPromptDismissed, setIsPromptDismissed] = useState(false);

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  useEffect(() => {
    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    const storedOrderNumber = window.sessionStorage.getItem(LAST_ORDER_STORAGE_KEY)?.trim() ?? "";
    if (!storedOrderNumber) {
      navigate("/shop", { replace: true });
      return;
    }

    setOrderNumber(storedOrderNumber);
  }, [navigate]);

  useEffect(() => {
    if (!orderNumber) {
      return;
    }

    let isMounted = true;

    const loadOrder = async () => {
      setIsLoading(true);
      setLoadError(false);

      try {
        const data = await fetchOrderConfirmationDetails(orderNumber);
        if (!isMounted) {
          return;
        }
        setOrder(data);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Failed to load order confirmation details", error);
        }
        if (isMounted) {
          setLoadError(true);
          setOrder(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadOrder();

    return () => {
      isMounted = false;
    };
  }, [orderNumber]);

  useEffect(
    () => () => {
      if (typeof window === "undefined") {
        return;
      }

      if (window.location.pathname !== "/checkout/confirmation") {
        window.sessionStorage.removeItem(LAST_ORDER_STORAGE_KEY);
      }
    },
    [],
  );

  const deliveryWindow = useMemo(
    () => (order ? getDeliveryWindow(order.shipping_address_snapshot) : { minDays: 3, maxDays: 5 }),
    [order],
  );

  const passwordRules = useMemo(
    () => ({
      minLength: password.length >= 8,
      uppercase: hasUppercaseLetter(password),
      number: hasNumber(password),
    }),
    [password],
  );

  const canSubmitPassword = passwordRules.minLength && passwordRules.uppercase && passwordRules.number;
  const shouldShowGuestAccountPrompt = !isAuthenticated && !isPromptDismissed;
  const orderContactEmail = order ? resolveOrderEmail(order) : "";

  const handleCreateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!order || !canSubmitPassword || isCreatingAccount) {
      return;
    }

    setAccountCreateError(null);
    setIsCreatingAccount(true);

    try {
      const orderEmail = resolveOrderEmail(order);
      const orderFirstName = order.customer.first_name.trim();
      const orderLastName = order.customer.last_name.trim();

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: orderEmail,
        password,
        options: {
          data: {
            first_name: orderFirstName,
            last_name: orderLastName,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      const newAuthUser = signUpData.user;
      if (!newAuthUser?.id) {
        throw new Error("Account creation did not return a user.");
      }

      const { data: existingCustomer, error: existingError } = await supabase
        .from("customers")
        .select("id")
        .eq("email", orderEmail)
        .single();

      if (existingError) {
        const code = (existingError as { code?: string }).code;
        if (code !== CUSTOMER_NOT_FOUND_CODE) {
          throw existingError;
        }
      } else if (existingCustomer?.id && existingCustomer.id !== newAuthUser.id) {
        const { error: linkError } = await supabase
          .from("customers")
          .update({
            id: newAuthUser.id,
            updated_at: new Date().toISOString(),
          })
          .eq("email", orderEmail);

        if (linkError && import.meta.env.DEV) {
          console.warn("Could not link guest customer row after account creation", linkError);
        }
      }

      setIsAccountCreated(true);
      setPassword("");
      setAccountCreateError(null);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Guest account creation failed", error);
      }

      const message =
        (error as { message?: string }).message?.trim() ||
        "We could not create your account right now. Please try again.";
      setAccountCreateError(message);
    } finally {
      setIsCreatingAccount(false);
    }
  };

  if (isLoading) {
    return <ConfirmationSkeleton />;
  }

  if (!order || loadError) {
    return (
      <div className="bg-[var(--color-secondary)] px-6 py-[80px] sm:px-6">
        <div className="mx-auto max-w-[640px] text-center">
          <p className="font-body text-[13px] text-[var(--color-muted)]">
            We couldn&apos;t load your order details. Your order was placed successfully. Check your email for
            confirmation.
          </p>
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
        <section className="text-center">
          <AnimatedCheckmark />
          <p className="mt-6 font-body text-[10px] uppercase tracking-[0.25em] text-[var(--color-accent)]">Order Confirmed</p>
          <h1 className="mt-3 font-display text-[40px] italic font-light leading-none text-[var(--color-primary)] sm:text-[52px]">
            Thank you, {order.customer.first_name}.
          </h1>
          <p className="mt-4 font-body text-[14px] font-light leading-[1.8] text-[var(--color-muted)]">
            Your order <span className="text-[var(--color-primary)]">{order.order_number}</span> is confirmed.
          </p>
          <p className="mt-2 font-body text-[13px] font-light text-[var(--color-muted-soft)]">
            We&apos;ll send updates to {orderContactEmail || order.customer.email}
          </p>
          <div className="my-12 border-b border-[var(--color-border)]" />
        </section>

        <OrderSummaryDetails order={order} deliveryWindow={deliveryWindow} />

        <section>
          <p className="mb-6 font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">What Happens Next</p>

          <div className="space-y-0">
            <div className="flex items-start gap-4">
              <span className="flex h-[20px] w-[20px] items-center justify-center rounded-full border border-[var(--color-border)] font-body text-[10px] text-[var(--color-muted)]">
                1
              </span>
              <div className="pt-[1px]">
                <p className="font-body text-[13px] text-[var(--color-primary)]">Order Confirmed</p>
                <p className="mt-1 font-body text-[11px] font-light text-[var(--color-muted)]">
                  We&apos;ve received your order and are preparing it for dispatch.
                </p>
              </div>
            </div>

            <div className="ml-[9px] h-[24px] border-l border-[var(--color-border)]" />

            <div className="flex items-start gap-4">
              <span className="flex h-[20px] w-[20px] items-center justify-center rounded-full border border-[var(--color-border)] font-body text-[10px] text-[var(--color-muted)]">
                2
              </span>
              <div className="pt-[1px]">
                <p className="font-body text-[13px] text-[var(--color-primary)]">Out for Delivery</p>
                <p className="mt-1 font-body text-[11px] font-light text-[var(--color-muted)]">
                  You&apos;ll receive an update when your order is on its way.
                </p>
              </div>
            </div>

            <div className="ml-[9px] h-[24px] border-l border-[var(--color-border)]" />

            <div className="flex items-start gap-4">
              <span className="flex h-[20px] w-[20px] items-center justify-center rounded-full border border-[var(--color-border)] font-body text-[10px] text-[var(--color-muted)]">
                3
              </span>
              <div className="pt-[1px]">
                <p className="font-body text-[13px] text-[var(--color-primary)]">Delivered</p>
                <p className="mt-1 font-body text-[11px] font-light text-[var(--color-muted)]">
                  Your order arrives within {deliveryWindow.minDays}-{deliveryWindow.maxDays} business days.
                </p>
              </div>
            </div>
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

          {storeConfig.features.orderTracking ? (
            <Link
              to={`/orders/${encodeURIComponent(order.order_number)}`}
              className="font-body text-[11px] uppercase tracking-[0.15em] text-[var(--color-primary)] transition-colors duration-200 hover:text-[var(--color-accent)]"
            >
              View Order Status &rarr;
            </Link>
          ) : null}
        </section>

        {shouldShowGuestAccountPrompt ? (
          <section className="mt-10 border-t border-[var(--color-border)] pt-10">
            {isAccountCreated ? (
              <div>
                <Check size={32} strokeWidth={1.2} className="text-[var(--color-accent)]" />
                <h2 className="mt-4 font-display text-[22px] italic text-[var(--color-primary)]">Account created successfully.</h2>
                <p className="mt-2 max-w-[420px] font-body text-[12px] font-light leading-[1.7] text-[var(--color-muted)]">
                  You can now track all your orders and checkout faster next time.
                </p>
              </div>
            ) : (
              <form onSubmit={handleCreateAccount}>
                <h2 className="font-display text-[24px] italic text-[var(--color-primary)]">Save your details for next time</h2>
                <p className="mb-6 mt-2 max-w-[460px] font-body text-[12px] font-light leading-[1.7] text-[var(--color-muted)]">
                  Create an account to track orders, save addresses and checkout faster.
                </p>

                <label
                  htmlFor="guest-create-password"
                  className="mb-2 block font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted)]"
                >
                  Create a Password
                </label>
                <div className="relative border-b border-[var(--color-border)] pb-[10px] pt-[2px]">
                  <input
                    id="guest-create-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    className="w-full bg-transparent pr-10 font-body text-[14px] text-[var(--color-primary)] placeholder:text-[var(--color-muted-soft)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} strokeWidth={1.35} /> : <Eye size={16} strokeWidth={1.35} />}
                  </button>
                </div>

                <div className="mt-3 space-y-1 font-body text-[10px] text-[var(--color-muted)]">
                  <p className={passwordRules.minLength ? "text-[var(--color-success)]" : "text-[var(--color-muted)]"}>
                    {passwordRules.minLength ? "OK" : "X"} 8+ characters
                  </p>
                  <p className={passwordRules.uppercase ? "text-[var(--color-success)]" : "text-[var(--color-muted)]"}>
                    {passwordRules.uppercase ? "OK" : "X"} One uppercase letter
                  </p>
                  <p className={passwordRules.number ? "text-[var(--color-success)]" : "text-[var(--color-muted)]"}>
                    {passwordRules.number ? "OK" : "X"} One number
                  </p>
                </div>

                {accountCreateError ? <p className="mt-3 font-body text-[12px] text-[var(--color-danger)]">{accountCreateError}</p> : null}

                <button
                  type="submit"
                  disabled={!canSubmitPassword || isCreatingAccount}
                  className="mt-6 w-full rounded-[var(--border-radius)] bg-[var(--color-primary)] px-4 py-4 font-body text-[11px] uppercase tracking-[0.18em] text-[var(--color-secondary)] transition-colors duration-300 hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreatingAccount ? "Creating..." : "Create Account"}
                </button>

                <button
                  type="button"
                  onClick={() => setIsPromptDismissed(true)}
                  className="mt-4 block w-full text-center font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted-soft)] transition-colors hover:text-[var(--color-primary)]"
                >
                  No thanks, maybe later
                </button>
              </form>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default CheckoutConfirmation;


