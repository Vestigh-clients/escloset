import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
      <h1 className="font-display text-[36px] italic text-[#1A1A1A]">Welcome back, {firstName}.</h1>

      <div className="mt-10 grid gap-8 md:grid-cols-3">
        <div className="border-b-2 border-[#C4A882] pb-4">
          <p className="font-display text-[32px] text-[#1A1A1A]">{totalOrders}</p>
          <p className="mt-1 font-body text-[10px] uppercase tracking-[0.12em] text-[#aaaaaa]">Total Orders</p>
        </div>

        <div className="border-b-2 border-[#C4A882] pb-4">
          <p className="font-display text-[32px] text-[#1A1A1A]">{formatPrice(totalSpent)}</p>
          <p className="mt-1 font-body text-[10px] uppercase tracking-[0.12em] text-[#aaaaaa]">
            Total Spent (GH&#8373;)
          </p>
        </div>

        <div className="border-b-2 border-[#C4A882] pb-4">
          <p className="font-display text-[32px] text-[#1A1A1A]">{formatMemberSince(profile?.created_at)}</p>
          <p className="mt-1 font-body text-[10px] uppercase tracking-[0.12em] text-[#aaaaaa]">Member Since</p>
        </div>
      </div>

      <section className="mt-14">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-[30px] italic text-[#1A1A1A]">Recent Orders</h2>
          <Link
            to="/account/orders"
            className="font-body text-[10px] uppercase tracking-[0.12em] text-[#1A1A1A] transition-colors hover:text-[#C4A882]"
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
          <p className="font-body text-[12px] text-[#C0392B]">{ordersError}</p>
        ) : recentOrders.length === 0 ? (
          <div className="border-t border-[#d4ccc2] pt-8">
            <p className="font-display text-[24px] italic text-[#888888]">You haven't placed any orders yet.</p>
            <Link
              to="/shop"
              className="mt-5 inline-block font-body text-[10px] uppercase tracking-[0.12em] text-[#C4A882] transition-colors hover:text-[#1A1A1A]"
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

