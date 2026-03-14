import { Link } from "react-router-dom";
import { formatPrice } from "@/data/products";
import { formatStatusLabel } from "@/lib/orderPresentation";
import type { AccountOrderStatus, AccountOrderSummary } from "@/services/accountService";

interface AccountOrderListProps {
  orders: AccountOrderSummary[];
}

const formatOrderDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getStatusClassName = (status: AccountOrderStatus): string => {
  if (status === "delivered") {
    return "border-[#1A1A1A] bg-[#1A1A1A] text-[#F5F0E8]";
  }

  if (status === "shipped") {
    return "border-[#C4A882] text-[#C4A882]";
  }

  if (status === "cancelled") {
    return "border-[#C0392B] text-[#C0392B]";
  }

  if (status === "confirmed" || status === "processing") {
    return "border-[#1A1A1A] text-[#1A1A1A]";
  }

  return "border-[#d4ccc2] bg-[#f5f0e8] text-[#888888]";
};

const getItemsSummaryText = (order: AccountOrderSummary): string => {
  if (order.item_count <= 1) {
    return order.first_item_name;
  }

  return `${order.first_item_name} + [${order.item_count - 1}] more items`;
};

const AccountOrderList = ({ orders }: AccountOrderListProps) => {
  return (
    <div>
      {orders.map((order, index) => (
        <article
          key={order.id}
          className={`py-6 ${index < orders.length - 1 ? "border-b border-[#d4ccc2]" : ""}`}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="font-body text-[12px] uppercase tracking-[0.1em] text-[#C4A882]">{order.order_number}</p>
              <p className="mt-1 font-body text-[11px] text-[#aaaaaa]">{formatOrderDate(order.created_at)}</p>

              <span
                className={`mt-4 inline-flex rounded-[2px] border px-3 py-[4px] font-body text-[9px] uppercase tracking-[0.15em] ${getStatusClassName(order.status)}`}
              >
                {formatStatusLabel(order.status)}
              </span>

              <p className="mt-4 truncate font-body text-[12px] text-[#888888]">{getItemsSummaryText(order)}</p>

              <Link
                to={`/orders/${order.order_number}`}
                className="mt-4 inline-block font-body text-[10px] uppercase tracking-[0.12em] text-[#C4A882] transition-colors hover:text-[#1A1A1A]"
              >
                View Order
              </Link>
            </div>

            <div className="md:text-right">
              <p className="font-body text-[10px] uppercase tracking-[0.12em] text-[#aaaaaa]">Order Total</p>
              <p className="mt-1 font-body text-[13px] text-[#1A1A1A]">{formatPrice(order.total)}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
};

export default AccountOrderList;
