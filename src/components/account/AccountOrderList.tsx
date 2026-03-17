import { Link } from "react-router-dom";
import { formatPrice } from "@/lib/price";
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

  return parsed.toLocaleDateString("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getStatusClassName = (status: AccountOrderStatus): string => {
  if (status === "delivered") {
    return "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-secondary)]";
  }

  if (status === "shipped") {
    return "border-[var(--color-accent)] text-[var(--color-accent)]";
  }

  if (status === "cancelled") {
    return "border-[var(--color-danger)] text-[var(--color-danger)]";
  }

  if (status === "confirmed" || status === "processing") {
    return "border-[var(--color-primary)] text-[var(--color-primary)]";
  }

  return "border-[var(--color-border)] bg-[var(--color-secondary)] text-[var(--color-muted)]";
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
          className={`py-6 ${index < orders.length - 1 ? "border-b border-[var(--color-border)]" : ""}`}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="font-body text-[12px] uppercase tracking-[0.1em] text-[var(--color-accent)]">{order.order_number}</p>
              <p className="mt-1 font-body text-[11px] text-[var(--color-muted-soft)]">{formatOrderDate(order.created_at)}</p>

              <span
                className={`mt-4 inline-flex rounded-[var(--border-radius)] border px-3 py-[4px] font-body text-[9px] uppercase tracking-[0.15em] ${getStatusClassName(order.status)}`}
              >
                {formatStatusLabel(order.status)}
              </span>

              <p className="mt-4 truncate font-body text-[12px] text-[var(--color-muted)]">{getItemsSummaryText(order)}</p>

              <Link
                to={`/orders/${order.order_number}`}
                className="mt-4 inline-block font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-accent)] transition-colors hover:text-[var(--color-primary)]"
              >
                View Order
              </Link>
            </div>

            <div className="md:text-right">
              <p className="font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted-soft)]">Order Total</p>
              <p className="mt-1 font-body text-[13px] text-[var(--color-primary)]">{formatPrice(order.total)}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
};

export default AccountOrderList;



