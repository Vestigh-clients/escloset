import { formatPrice } from "@/lib/price";
import { getAddressLines, getItemCategoryLabel, getPaymentMethodLabel, type DeliveryWindow } from "@/lib/orderPresentation";
import type { OrderDetails } from "@/services/orderService";

interface OrderSummaryDetailsProps {
  order: OrderDetails;
  deliveryWindow: DeliveryWindow;
}

const OrderSummaryDetails = ({ order, deliveryWindow }: OrderSummaryDetailsProps) => {
  const addressLines = getAddressLines(order.shipping_address_snapshot);
  const discountAmount = Math.max(0, Number(order.discount_amount ?? 0));
  const paymentLabel = getPaymentMethodLabel(order.payment_method);
  const totalUnits = order.order_items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section className="min-w-0">
      <div className="mb-6 flex min-w-0 flex-wrap items-end justify-between gap-2 sm:gap-3">
        <p className="font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Order Summary</p>
        <p className="w-full font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)] [overflow-wrap:anywhere] sm:w-auto">
          {order.order_items.length} {order.order_items.length === 1 ? "product" : "products"} {"\u00B7"} {totalUnits}{" "}
          {totalUnits === 1 ? "unit" : "units"}
        </p>
      </div>

      <div className="rounded-[var(--border-radius)] border border-[var(--color-border)]">
        {order.order_items.map((item, index) => (
          <div
            key={item.id}
            className={`px-4 py-4 sm:px-5 ${index < order.order_items.length - 1 ? "border-b border-[var(--color-border)]" : ""}`}
          >
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <img
                src={item.product_image_url || "/placeholder.svg"}
                alt={item.product_name}
                className="h-[64px] w-[48px] flex-shrink-0 rounded-[var(--border-radius)] object-cover sm:h-[86px] sm:w-[64px]"
                loading="lazy"
              />

              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0 sm:max-w-[75%]">
                  <p className="font-display text-[16px] italic leading-[1.25] text-[var(--color-primary)] [overflow-wrap:anywhere]">
                    {item.product_name}
                  </p>
                  {item.variant_label ? (
                    <p className="mt-[3px] mb-[6px] font-body text-[10px] tracking-[0.05em] text-[var(--color-muted)] [overflow-wrap:anywhere]">
                      {item.variant_label}
                    </p>
                  ) : null}
                  <p className="mt-1 font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-accent)]">
                    {getItemCategoryLabel(item)}
                  </p>
                  <p className="mt-1 font-body text-[11px] text-[var(--color-muted)]">Qty: {item.quantity}</p>
                </div>

                <p className="whitespace-nowrap text-left font-body text-[13px] text-[var(--color-primary)] sm:text-right">
                  {formatPrice(item.subtotal)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-[var(--border-radius)] border border-[var(--color-border)] px-4 py-4 sm:px-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between font-body text-[12px] text-[var(--color-muted)]">
            <span>Subtotal</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>

          <div className="flex items-center justify-between font-body text-[12px] text-[var(--color-muted)]">
            <span>Shipping</span>
            <span>{formatPrice(order.shipping_fee)}</span>
          </div>

          {discountAmount > 0 ? (
            <div className="flex items-center justify-between font-body text-[12px] text-[var(--color-accent)]">
              <span>Discount</span>
              <span>- {formatPrice(discountAmount)}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-3 border-t border-[var(--color-border)] pt-3">
          <div className="flex items-center justify-between font-body text-[15px] font-medium text-[var(--color-primary)]">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-[var(--border-radius)] border border-[var(--color-border)] px-4 py-4 sm:px-5">
          <p className="mb-3 font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Delivering To</p>
          <div className="space-y-[2px] font-body text-[13px] font-light leading-[1.8] text-[var(--color-muted)] [overflow-wrap:anywhere]">
            {addressLines.length > 0 ? (
              addressLines.map((line) => <p key={line}>{line}</p>)
            ) : (
              <p>Address not available.</p>
            )}
          </div>
          <p className="mt-2 font-body text-[11px] text-[var(--color-muted-soft)]">
            {deliveryWindow.minDays}-{deliveryWindow.maxDays} business days
          </p>
        </div>

        <div className="rounded-[var(--border-radius)] border border-[var(--color-border)] px-4 py-4 sm:px-5">
          <p className="mb-3 font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Payment</p>
          <p className="font-body text-[13px] font-light text-[var(--color-muted)]">{paymentLabel}</p>
          {order.payment_method === "mobile_money" && order.mobile_money_number ? (
            <p className="mt-1 font-body text-[12px] text-[var(--color-muted-soft)]">{order.mobile_money_number}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default OrderSummaryDetails;



