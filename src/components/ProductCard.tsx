import { Link } from "react-router-dom";
import { type Product, formatPrice } from "@/data/products";
import { productImages } from "@/data/images";

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const image = productImages[product.id];

  return (
    <div className="group bg-card rounded-[4px] overflow-hidden transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(26,26,26,0.12)]">
      <Link to={`/product/${product.id}`} className="block">
        <div className="aspect-[4/5] overflow-hidden bg-muted/20">
          <img
            src={image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            loading="lazy"
          />
        </div>
      </Link>

      <div className="pt-5 pb-1 text-left">
        <Link to={`/product/${product.id}`}>
          <h3 className="font-display text-[1.35rem] md:text-[1.5rem] font-normal italic leading-tight">{product.name}</h3>
        </Link>
        <p className="font-body font-light text-lg mt-3">{formatPrice(product.price)}</p>

      </div>
    </div>
  );
};

export default ProductCard;
