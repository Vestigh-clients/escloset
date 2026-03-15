import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import ProductImagePlaceholder from "@/components/products/ProductImagePlaceholder";
import { getCategoryLabel } from "@/lib/categories";
import { formatPrice } from "@/lib/price";
import { getPrimaryImage, type Product } from "@/types/product";

interface ShopProductCardProps {
  product: Product;
  size?: "regular" | "banner";
}

const ShopProductCard = ({ product, size = "regular" }: ShopProductCardProps) => {
  const { addToCart } = useCart();
  const imageUrl = getPrimaryImage(product);
  const [hasImageError, setHasImageError] = useState(false);
  const categoryLabel = product.categories?.name || getCategoryLabel(product.categories?.slug);
  const isOutOfStock = !product.is_available || product.stock_quantity < 1;

  useEffect(() => {
    setHasImageError(false);
  }, [imageUrl, product.id]);

  const handleAddToCart = () => {
    if (isOutOfStock) {
      return;
    }

    addToCart({
      product_id: product.id,
      name: product.name,
      slug: product.slug,
      category: categoryLabel,
      price: product.price,
      compare_at_price: product.compare_at_price ?? null,
      image_url: imageUrl,
      image_alt: product.name,
      sku: product.sku ?? null,
      stock_quantity: product.stock_quantity,
    });
  };

  const imageHoverOverlay = (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-12 translate-y-full items-center justify-center bg-[rgba(26,26,26,0.88)] transition-transform duration-300 ease-in-out group-hover:translate-y-0">
      <span className="font-body text-[11px] uppercase tracking-[0.15em] text-[#F5F0E8]">Add to Cart</span>
    </div>
  );

  if (size === "banner") {
    return (
      <article className="group bg-transparent">
        <div className="grid h-[400px] w-full grid-cols-[55fr_45fr]">
          <div className="relative overflow-hidden">
            <Link to={`/shop/${product.slug}`} className="block h-full">
              {imageUrl && !hasImageError ? (
                <img
                  src={imageUrl}
                  alt={product.name}
                  className="h-full w-full object-cover object-center transition-transform ease-out [transition-duration:400ms] group-hover:scale-[1.04]"
                  loading="lazy"
                  onError={() => setHasImageError(true)}
                />
              ) : (
                <ProductImagePlaceholder className="h-full w-full" />
              )}
            </Link>
          </div>

          <div className="flex h-full flex-col justify-center bg-[#F5F0E8] p-12">
            <p className="mb-3 font-body text-[10px] font-light uppercase tracking-[0.2em] text-[#C4A882]">
              {categoryLabel}
            </p>

            <Link to={`/shop/${product.slug}`} className="mb-2 block">
              <h3 className="font-display text-[24px] font-normal italic leading-[1.2] text-[#1A1A1A]">{product.name}</h3>
            </Link>

            <p className="mb-7 font-body text-[13px] font-light text-[#888888]">{formatPrice(product.price)}</p>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className="w-fit rounded-[2px] bg-[#1A1A1A] px-8 py-[14px] font-body text-[11px] uppercase tracking-[0.15em] text-[#F5F0E8] transition-colors duration-300 hover:bg-[#C4A882] hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:bg-[#d4ccc2] disabled:text-[#888888]"
            >
              {isOutOfStock ? "Out of Stock" : "Add to Cart"}
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group bg-transparent">
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <Link to={`/shop/${product.slug}`} className="block h-full">
          {imageUrl && !hasImageError ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="h-full w-full object-cover object-center transition-transform ease-out [transition-duration:400ms] group-hover:scale-[1.04]"
              loading="lazy"
              onError={() => setHasImageError(true)}
            />
          ) : (
            <ProductImagePlaceholder className="h-full w-full" />
          )}
          {imageHoverOverlay}
        </Link>
      </div>

      <div className="mt-3 text-left">
        <Link to={`/shop/${product.slug}`}>
          <h3 className="font-display text-[15px] font-normal italic leading-snug text-[#1A1A1A]">{product.name}</h3>
        </Link>
        <p className="mt-1 font-body text-[12px] font-light text-[#888888]">{formatPrice(product.price)}</p>
      </div>
    </article>
  );
};

export default ShopProductCard;
