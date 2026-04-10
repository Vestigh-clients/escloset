import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router";
import ProductImagePlaceholder from "@/components/products/ProductImagePlaceholder";
import { getCategoryLabel } from "@/lib/categories";
import { formatPrice } from "@/lib/price";
import { toast } from "@/components/ui/sonner";
import { addProductToFavorites, isProductFavorited, subscribeToFavoriteChanges } from "@/services/favoritesService";
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
  const navigate = useNavigate();
  const [hasImageError, setHasImageError] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

  const imageUrl = getPrimaryImage(product);
  const categoryLabel = product.categories?.name?.trim() || getCategoryLabel(product.categories?.slug);

  const outOfStock = !isInStock(product);
  const actionText = outOfStock && onAction ? "Out of Stock" : actionLabel;
  const productRoute = useMemo(() => actionHref || `/shop/${product.slug}`, [actionHref, product.slug]);

  useEffect(() => {
    setHasImageError(false);
  }, [imageUrl, product.id]);

  useEffect(() => {
    setIsFavorited(isProductFavorited(product.id));
  }, [product.id]);

  useEffect(() => {
    return subscribeToFavoriteChanges(() => {
      setIsFavorited(isProductFavorited(product.id));
    });
  }, [product.id]);

  const openProduct = () => {
    navigate(productRoute);
  };

  const handleFavoriteClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const added = addProductToFavorites(product.id);
    if (added) {
      toast(`${product.name} added to favorites`, {
        duration: 2200,
      });
    } else {
      toast(`${product.name} is already in favorites`, {
        duration: 2200,
      });
    }

    setIsFavorited(true);
  };

  const handleActionClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (onAction) {
      onAction(product);
      return;
    }

    openProduct();
  };

  return (
    <article
      className="group cursor-pointer"
      role="link"
      tabIndex={0}
      onClick={openProduct}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openProduct();
        }
      }}
      aria-label={`Open ${product.name}`}
    >
      <div className="relative mb-4 overflow-hidden bg-[#F3F3F4]">
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

        <button
          type="button"
          onClick={handleFavoriteClick}
          className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border bg-white/90 text-sm backdrop-blur transition-colors ${
            isFavorited
              ? "border-[#D81B60] text-[#D81B60]"
              : "border-outline-variant/50 text-[#5E5E5E] hover:border-[#D81B60] hover:text-[#D81B60]"
          }`}
          aria-label={isFavorited ? "Saved to favorites" : "Add to favorites"}
          title={isFavorited ? "Saved to favorites" : "Add to favorites"}
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: isFavorited ? "'FILL' 1" : "'FILL' 0" }}>
            favorite
          </span>
        </button>

        {onAction ? (
          <button
            type="button"
            onClick={handleActionClick}
            disabled={outOfStock}
            className="absolute bottom-4 left-4 right-4 flex translate-y-0 items-center justify-center gap-2 bg-[#D81B60] py-3 font-manrope text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all duration-300 md:translate-y-12 md:group-hover:translate-y-0 md:group-hover:-translate-y-1 md:group-hover:bg-[#B0004A] disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-[#8f6e78]"
          >
            <span className="material-symbols-outlined text-sm">
              {outOfStock ? "block" : "add_shopping_cart"}
            </span>
            {actionText}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleActionClick}
            className="absolute bottom-4 left-4 right-4 flex translate-y-0 items-center justify-center gap-2 bg-[#D81B60] py-3 font-manrope text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all duration-300 md:translate-y-12 md:group-hover:translate-y-0 md:group-hover:-translate-y-1 md:group-hover:bg-[#B0004A]"
          >
            <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
            {actionLabel}
          </button>
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
