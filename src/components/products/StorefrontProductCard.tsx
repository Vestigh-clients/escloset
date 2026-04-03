import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ProductImagePlaceholder from "@/components/products/ProductImagePlaceholder";
import { getCategoryLabel } from "@/lib/categories";
import { formatPrice } from "@/lib/price";
import { getPrimaryImage, isInStock, type Product } from "@/types/product";

interface StorefrontProductCardProps {
  product: Product;
  actionLabel?: string;
  actionHref?: string;
  onAction?: (product: Product) => void;
}

const StorefrontProductCard = ({
  product,
  actionLabel = "Add to Cart",
  actionHref,
  onAction,
}: StorefrontProductCardProps) => {
  const [hasImageError, setHasImageError] = useState(false);

  const imageUrl = getPrimaryImage(product);
  const categoryLabel = product.categories?.name?.trim() || getCategoryLabel(product.categories?.slug);
  const productHref = useMemo(() => actionHref || `/shop/${product.slug}`, [actionHref, product.slug]);

  const outOfStock = !isInStock(product);
  const actionText = outOfStock && onAction ? "Out of Stock" : actionLabel;

  useEffect(() => {
    setHasImageError(false);
  }, [imageUrl, product.id]);

  return (
    <article className="group">
      <div className="relative mb-4 overflow-hidden bg-[#F3F3F4]">
        <Link to={productHref}>
          {imageUrl && !hasImageError ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="aspect-[4/5] h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              onError={() => setHasImageError(true)}
            />
          ) : (
            <ProductImagePlaceholder className="aspect-[4/5] h-full w-full" />
          )}
        </Link>

        {onAction ? (
          <button
            type="button"
            onClick={() => onAction(product)}
            disabled={outOfStock}
            className="absolute bottom-4 left-4 right-4 flex translate-y-12 items-center justify-center gap-2 bg-[#D81B60] py-3 font-manrope text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all duration-300 group-hover:translate-y-0 group-hover:-translate-y-1 group-hover:bg-[#B0004A] disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-[#8f6e78]"
          >
            <span className="material-symbols-outlined text-sm">
              {outOfStock ? "block" : "add_shopping_cart"}
            </span>
            {actionText}
          </button>
        ) : (
          <Link
            to={productHref}
            className="absolute bottom-4 left-4 right-4 flex translate-y-12 items-center justify-center gap-2 bg-[#D81B60] py-3 font-manrope text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all duration-300 group-hover:translate-y-0 group-hover:-translate-y-1 group-hover:bg-[#B0004A]"
          >
            <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
            {actionLabel}
          </Link>
        )}
      </div>

      <h4 className="font-notoSerif text-lg font-bold text-[#1A1C1C] transition-colors group-hover:text-[#D81B60]">
        {product.name}
      </h4>
      <p className="mt-1 font-manrope text-xs uppercase tracking-[0.1em] text-[#5E5E5E]">{categoryLabel}</p>
      <p className="mt-1 font-manrope text-xs font-semibold uppercase tracking-[0.08em] text-[#B0004A]">
        {formatPrice(product.price)}
      </p>
    </article>
  );
};

export default StorefrontProductCard;
