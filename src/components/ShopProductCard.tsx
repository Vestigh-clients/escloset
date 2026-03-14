import { Link } from "react-router-dom";
import { productImages } from "@/data/images";
import { type Product, formatPrice } from "@/data/products";

interface ShopProductCardProps {
  product: Product;
  size?: "regular" | "large" | "small";
}

const imageSizeClass: Record<NonNullable<ShopProductCardProps["size"]>, string> = {
  regular: "aspect-[4/5]",
  large: "h-[430px] md:h-[620px]",
  small: "h-[220px] md:h-[294px]",
};

const ShopProductCard = ({ product, size = "regular" }: ShopProductCardProps) => {
  const image = productImages[product.id];

  return (
    <article className="group">
      <div className={`relative overflow-hidden ${imageSizeClass[size]}`}>
        <Link to={`/product/${product.id}`} className="block h-full">
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform ease-out [transition-duration:400ms] group-hover:scale-[1.04]"
            loading="lazy"
          />
        </Link>

      </div>

      <div className="mt-3 text-left">
        <Link to={`/product/${product.id}`}>
          <h3 className="font-display text-[15px] font-normal leading-snug">{product.name}</h3>
        </Link>
        <p className="mt-1 font-body text-[12px] font-light text-[#888888]">{formatPrice(product.price)}</p>
      </div>
    </article>
  );
};

export default ShopProductCard;
