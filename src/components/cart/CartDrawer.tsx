import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { getSession } from "@/services/authService";
import ProductImagePlaceholder from "@/components/products/ProductImagePlaceholder";
import { formatPrice } from "@/lib/price";

const FREE_DELIVERY_THRESHOLD = 50000;

const CartItemThumbnail = ({ src, alt }: { src: string; alt: string }) => {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [src]);

  if (!src || hasImageError) {
    return <ProductImagePlaceholder className="h-full w-full" />;
  }

  return <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" onError={() => setHasImageError(true)} />;
};

const CartDrawer = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const {
    items,
    totalItems,
    subtotal,
    savings,
    isCartOpen,
    isValidating,
    closeCart,
    updateQuantity,
    removeFromCart,
    validateCart,
  } = useCart();

  const [isCheckoutPending, setIsCheckoutPending] = useState(false);

  const isVerifying = isValidating || isCheckoutPending;

  const handleProceedToCheckout = async () => {
    if (items.length === 0 || isCheckoutPending) {
      return;
    }

    setIsCheckoutPending(true);

    try {
      const validation = await validateCart();

      if (validation.state.items.length === 0) {
        return;
      }

      closeCart();

      if (isAuthenticated) {
        navigate("/checkout/contact");
        return;
      }

      if (isAuthLoading) {
        const session = await getSession();
        if (session?.user) {
          navigate("/checkout/contact");
          return;
        }
      }

      navigate("/checkout");
    } finally {
      setIsCheckoutPending(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[80] ${isCartOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
      <button
        type="button"
        aria-label="Close cart"
        onClick={closeCart}
        className={`absolute inset-0 bg-black transition-opacity ease-out [transition-duration:250ms] ${isCartOpen ? "opacity-30" : "opacity-0"}`}
      />

      <aside
        aria-label="Cart drawer"
        className={`absolute right-0 top-0 h-full w-full max-w-[420px] bg-[var(--color-secondary)] px-8 py-10 transition-transform [transition-duration:350ms] [transition-timing-function:cubic-bezier(0.77,0,0.175,1)] ${
          isCartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <button
          type="button"
          aria-label="Close cart drawer"
          onClick={closeCart}
          className="absolute right-8 top-8 text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
        >
          <X size={18} strokeWidth={1.5} />
        </button>

        <div className="flex h-full flex-col">
          <div className="mb-6 border-b border-[var(--color-border)] pb-4 pr-8">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-display text-[28px] italic text-[var(--color-primary)]">Your Cart</h2>
              <p className="font-body text-[11px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                {totalItems} {totalItems === 1 ? "ITEM" : "ITEMS"}
              </p>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
              <ShoppingBag size={40} strokeWidth={1.35} className="mb-4 text-[var(--color-border)]" />
              <p className="mb-2 font-display text-[24px] italic text-[var(--color-muted)]">Your cart is empty</p>
              <p className="mb-6 font-body text-[13px] font-light text-[var(--color-muted-soft)]">
                Looks like you haven&apos;t added anything yet.
              </p>
              <Link
                to="/shop"
                onClick={closeCart}
                className="font-body text-[11px] uppercase tracking-[0.15em] text-[var(--color-accent)] transition-colors hover:text-[var(--color-primary)]"
              >
                Continue Shopping
              </Link>
            </div>
          ) : (
            <>
              <div className="lux-cart-scroll flex-1 overflow-y-auto pr-1 [max-height:calc(100vh-320px)]">
                {items.map((item) => (
                  <div key={`${item.product_id}-${item.variant_id ?? "base"}`} className="border-b border-[var(--color-border)] py-4 first:pt-0">
                    <div className="flex gap-4">
                      <Link to={`/shop/${item.slug}`} onClick={closeCart} className="h-[80px] w-[60px] flex-shrink-0">
                        <CartItemThumbnail src={item.image_url} alt={item.image_alt} />
                      </Link>

                      <div className="min-w-0 flex-1">
                        <Link to={`/shop/${item.slug}`} onClick={closeCart}>
                          <p className="font-display text-[15px] italic leading-snug text-[var(--color-primary)]">{item.name}</p>
                        </Link>

                        <p className="mt-1 font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-accent)]">{item.category}</p>
                        {item.variant_label ? (
                          <p className="mt-[3px] mb-[6px] font-body text-[10px] tracking-[0.05em] text-[var(--color-muted)]">
                            {item.variant_label}
                          </p>
                        ) : null}

                        <div className="mt-2 flex items-center gap-2 font-body text-[12px] text-[var(--color-muted)]">
                          {item.compare_at_price !== null && item.compare_at_price > item.price ? (
                            <>
                              <span className="text-[var(--color-muted-soft)] line-through">{formatPrice(item.compare_at_price)}</span>
                              <span>{formatPrice(item.price)}</span>
                            </>
                          ) : (
                            <span>{formatPrice(item.price)}</span>
                          )}
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="inline-flex items-center border border-[var(--color-border)] px-3 py-1 font-body text-[12px] text-[var(--color-primary)]">
                            <button
                              type="button"
                              aria-label={`Decrease quantity for ${item.name}`}
                              onClick={() => updateQuantity(item.product_id, item.quantity - 1, item.variant_id)}
                              disabled={item.quantity <= 1}
                              className="px-2 transition-colors disabled:text-[var(--color-border)]"
                            >
                              -
                            </button>
                            <span className="min-w-[28px] text-center">{item.quantity}</span>
                            <button
                              type="button"
                              aria-label={`Increase quantity for ${item.name}`}
                              onClick={() => updateQuantity(item.product_id, item.quantity + 1, item.variant_id)}
                              disabled={item.quantity >= item.stock_quantity}
                              className="px-2 transition-colors disabled:text-[var(--color-border)]"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product_id, item.variant_id)}
                            className="font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)] transition-colors hover:text-[var(--color-danger)]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                {savings > 0 ? (
                  <p className="mb-2 text-right font-body text-[11px] text-[var(--color-accent)]">You save {formatPrice(savings)}</p>
                ) : null}

                <div className="mb-1 flex items-center justify-between font-body text-[13px] font-medium text-[var(--color-muted)]">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>

                <div className="mb-6 flex items-center justify-between font-body text-[11px] text-[var(--color-muted-soft)]">
                  <span>Shipping</span>
                  <span>Calculated at checkout</span>
                </div>

                <button
                  type="button"
                  onClick={handleProceedToCheckout}
                  disabled={isVerifying || items.length === 0}
                  className="w-full rounded-[var(--border-radius)] bg-[var(--color-primary)] px-4 py-[18px] font-body text-[11px] uppercase tracking-[0.18em] text-[var(--color-secondary)] transition-colors duration-300 hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isVerifying ? "Verifying..." : "Proceed to Checkout"}
                </button>

                <p className="mt-3 text-center font-body text-[11px] text-[var(--color-muted-soft)]">
                  Free delivery on orders over {formatPrice(FREE_DELIVERY_THRESHOLD)}
                </p>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
};

export default CartDrawer;



