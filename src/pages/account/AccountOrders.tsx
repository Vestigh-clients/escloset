import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AccountOrderList from "@/components/account/AccountOrderList";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAccountOrderSummaries, type AccountOrderSummary, type AccountOrderStatus } from "@/services/accountService";

type OrdersFilter = "all" | "pending" | "processing" | "shipped" | "delivered" | "cancelled";

const filterTabs: Array<{ label: string; value: OrdersFilter }> = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Processing", value: "processing" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

const statusMatchesFilter = (status: AccountOrderStatus, filter: OrdersFilter): boolean => {
  if (filter === "all") {
    return true;
  }

  if (filter === "processing") {
    return status === "processing" || status === "confirmed";
  }

  return status === filter;
};

const AccountOrders = () => {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<OrdersFilter>("all");
  const [orders, setOrders] = useState<AccountOrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadOrders = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const nextOrders = await fetchAccountOrderSummaries(user.id);
        if (!isMounted) {
          return;
        }
        setOrders(nextOrders);
      } catch {
        if (!isMounted) {
          return;
        }
        setOrders([]);
        setLoadError("We couldn't load your orders right now.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadOrders();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const filteredOrders = useMemo(
    () => orders.filter((order) => statusMatchesFilter(order.status, activeFilter)),
    [orders, activeFilter],
  );

  return (
    <div>
      <h1 className="font-display text-[42px] italic text-[#1A1A1A]">My Orders</h1>

      <div className="mt-7 border-b border-[#d4ccc2] pb-5">
        <div className="flex flex-wrap gap-2.5">
          {filterTabs.map((filter) => {
            const isActive = activeFilter === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={`rounded-[2px] border px-5 py-2.5 font-body text-[11px] font-light uppercase tracking-[0.1em] transition-colors duration-300 ${
                  isActive
                    ? "border-[#1A1A1A] bg-[#1A1A1A] text-[#F5F0E8]"
                    : "border-[#d4ccc2] text-[#1A1A1A] hover:border-[#1A1A1A]"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="mt-8 space-y-3">
          <div className="lux-order-pulse h-[96px] w-full" />
          <div className="lux-order-pulse h-[96px] w-full" />
          <div className="lux-order-pulse h-[96px] w-full" />
        </div>
      ) : loadError ? (
        <p className="mt-8 font-body text-[12px] text-[#C0392B]">{loadError}</p>
      ) : filteredOrders.length === 0 ? (
        <div className="mt-10">
          <p className="font-display text-[24px] italic text-[#555555]">You haven't placed any orders yet.</p>
          <Link
            to="/shop"
            className="mt-5 inline-block font-body text-[10px] uppercase tracking-[0.12em] text-[#C4A882] transition-colors hover:text-[#1A1A1A]"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="mt-3">
          <AccountOrderList orders={filteredOrders} />
        </div>
      )}
    </div>
  );
};

export default AccountOrders;

