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

  return (
    <section>
      <p className="mb-6 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Order Summary</p>

      <div className="border-b border-[#d4ccc2]">
        {order.order_items.map((item, index) => (
          <div
            key={item.id}
            className={`py-4 ${index < order.order_items.length - 1 ? "border-b border-[#e3ddd4]" : ""}`}
          >
            <div className="flex items-start gap-3 sm:gap-4">
              <img
                src={item.product_image_url || "/placeholder.svg"}
                alt={item.product_name}
                className="h-[64px] w-[48px] flex-shrink-0 object-cover sm:h-[86px] sm:w-[64px]"
                loading="lazy"
              />

              <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-[16px] italic text-[#1A1A1A]">{item.product_name}</p>
                  {item.variant_label ? (
                    <p className="mt-[3px] mb-[6px] font-body text-[10px] tracking-[0.05em] text-[#555555]">
                      {item.variant_label}
                    </p>
                  ) : null}
                  <p className="mt-1 font-body text-[10px] uppercase tracking-[0.1em] text-[#C4A882]">
                    {getItemCategoryLabel(item)}
                  </p>
                  <p className="mt-1 font-body text-[11px] text-[#555555]">Qty: {item.quantity}</p>
                </div>

                <p className="whitespace-nowrap text-right font-body text-[13px] text-[#1A1A1A]">
                  {formatPrice(item.subtotal)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-b border-[#d4ccc2] py-6">
        <div className="flex items-center justify-between font-body text-[12px] text-[#555555]">
          <span>Subtotal</span>
          <span>{formatPrice(order.subtotal)}</span>
        </div>

        <div className="flex items-center justify-between font-body text-[12px] text-[#555555]">
          <span>Shipping</span>
          <span>{formatPrice(order.shipping_fee)}</span>
        </div>

        {discountAmount > 0 ? (
          <div className="flex items-center justify-between font-body text-[12px] text-[#C4A882]">
            <span>Discount</span>
            <span>- {formatPrice(discountAmount)}</span>
          </div>
        ) : null}

        <div className="border-t border-[#d4ccc2] pt-2">
          <div className="flex items-center justify-between font-body text-[15px] font-medium text-[#1A1A1A]">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="my-8 border-b border-[#d4ccc2]" />

      <div className="space-y-7">
        <div>
          <p className="mb-3 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Delivering To</p>
          <div className="space-y-[2px] font-body text-[13px] font-light leading-[1.8] text-[#555555]">
            {addressLines.length > 0 ? (
              addressLines.map((line) => <p key={line}>{line}</p>)
            ) : (
              <p>Address not available.</p>
            )}
          </div>
          <p className="mt-2 font-body text-[11px] text-[#777777]">
            {deliveryWindow.minDays}-{deliveryWindow.maxDays} business days
          </p>
        </div>

        <div>
          <p className="mb-3 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Payment</p>
          <p className="font-body text-[13px] font-light text-[#555555]">{paymentLabel}</p>
          {order.payment_method === "mobile_money" && order.mobile_money_number ? (
            <p className="mt-1 font-body text-[12px] text-[#777777]">{order.mobile_money_number}</p>
          ) : null}
        </div>
      </div>

      <div className="my-8 border-b border-[#d4ccc2]" />
    </section>
  );
};

export default OrderSummaryDetails;


