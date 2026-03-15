import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductImagePlaceholder from "@/components/products/ProductImagePlaceholder";
import { formatPrice } from "@/lib/price";
import { getPrimaryImage, type Product } from "@/types/product";

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const imageUrl = getPrimaryImage(product);
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [imageUrl, product.id]);

  return (
    <div className="group bg-card rounded-[4px] overflow-hidden transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(26,26,26,0.12)]">
      <Link to={`/shop/${product.slug}`} className="block">
        <div className="aspect-[4/5] overflow-hidden bg-muted/20">
          {imageUrl && !hasImageError ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              loading="lazy"
              onError={() => setHasImageError(true)}
            />
          ) : (
            <ProductImagePlaceholder className="h-full w-full" />
          )}
        </div>
      </Link>

      <div className="pt-5 pb-1 text-left">
        <Link to={`/shop/${product.slug}`}>
          <h3 className="font-display text-[1.35rem] md:text-[1.5rem] font-normal italic leading-tight">{product.name}</h3>
        </Link>
        <p className="font-body font-light text-lg mt-3">{formatPrice(product.price)}</p>

      </div>
    </div>
  );
};

export default ProductCard;
