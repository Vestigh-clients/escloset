import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import AccountOrderList from "@/components/account/AccountOrderList";
import { formatPrice } from "@/lib/price";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAccountOrderSummaries, type AccountOrderSummary } from "@/services/accountService";
import { useAccountLayoutContext } from "./AccountLayout";

const formatMemberSince = (value: string | null | undefined): string => {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return parsed.toLocaleDateString("en-GH", {
    month: "long",
    year: "numeric",
  });
};

const AccountOverview = () => {
  const { user } = useAuth();
  const { profile, firstName } = useAccountLayoutContext();

  const [recentOrders, setRecentOrders] = useState<AccountOrderSummary[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setRecentOrders([]);
      setIsOrdersLoading(false);
      return;
    }

    let isMounted = true;

    const loadOrders = async () => {
      setIsOrdersLoading(true);
      setOrdersError(null);

      try {
        const orders = await fetchAccountOrderSummaries(user.id, { limit: 3 });
        if (!isMounted) {
          return;
        }
        setRecentOrders(orders);
      } catch {
        if (!isMounted) {
          return;
        }
        setRecentOrders([]);
        setOrdersError("We couldn't load your recent orders.");
      } finally {
        if (isMounted) {
          setIsOrdersLoading(false);
        }
      }
    };

    void loadOrders();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const totalOrders = useMemo(() => {
    const value = Number(profile?.total_orders ?? 0);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }

    return recentOrders.length;
  }, [profile?.total_orders, recentOrders.length]);

  const totalSpent = useMemo(() => {
    const value = Number(profile?.total_spent ?? 0);
    return Number.isFinite(value) ? value : 0;
  }, [profile?.total_spent]);

  return (
    <div>
      <h1 className="font-display text-[36px] italic text-[var(--color-primary)]">Welcome back, {firstName}.</h1>

      <div className="mt-10 grid gap-8 md:grid-cols-3">
        <div className="border-b-2 border-[var(--color-accent)] pb-4">
          <p className="font-display text-[32px] text-[var(--color-primary)]">{totalOrders}</p>
          <p className="mt-1 font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted-soft)]">Total Orders</p>
        </div>

        <div className="border-b-2 border-[var(--color-accent)] pb-4">
          <p className="font-display text-[32px] text-[var(--color-primary)]">{formatPrice(totalSpent)}</p>
          <p className="mt-1 font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted-soft)]">
            Total Spent (GH&#8373;)
          </p>
        </div>

        <div className="border-b-2 border-[var(--color-accent)] pb-4">
          <p className="font-display text-[32px] text-[var(--color-primary)]">{formatMemberSince(profile?.created_at)}</p>
          <p className="mt-1 font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted-soft)]">Member Since</p>
        </div>
      </div>

      <section className="mt-14">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-[30px] italic text-[var(--color-primary)]">Recent Orders</h2>
          <Link
            to="/account/orders"
            className="font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-primary)] transition-colors hover:text-[var(--color-accent)]"
          >
            View All Orders
          </Link>
        </div>

        {isOrdersLoading ? (
          <div className="space-y-3">
            <div className="lux-order-pulse h-[92px] w-full" />
            <div className="lux-order-pulse h-[92px] w-full" />
            <div className="lux-order-pulse h-[92px] w-full" />
          </div>
        ) : ordersError ? (
          <p className="font-body text-[12px] text-[var(--color-danger)]">{ordersError}</p>
        ) : recentOrders.length === 0 ? (
          <div className="border-t border-[var(--color-border)] pt-8">
            <p className="font-display text-[24px] italic text-[var(--color-muted)]">You haven't placed any orders yet.</p>
            <Link
              to="/shop"
              className="mt-5 inline-block font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-accent)] transition-colors hover:text-[var(--color-primary)]"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <AccountOrderList orders={recentOrders} />
        )}
      </section>
    </div>
  );
};

export default AccountOverview;



