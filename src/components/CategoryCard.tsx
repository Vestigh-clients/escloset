import { Link } from "react-router-dom";

interface CategoryCardProps {
  name: string;
  slug: string;
  imageUrl: string;
}

const CategoryCard = ({ name, slug, imageUrl }: CategoryCardProps) => {
  const normalizedImageUrl = imageUrl.trim();
  const hasImage = normalizedImageUrl.length > 0;

  return (
    <Link to={`/category/${encodeURIComponent(slug)}`} className="group block">
      <div className="overflow-hidden rounded-[var(--border-radius)]">
        {hasImage ? (
          <img
            src={normalizedImageUrl}
            alt={name}
            className="aspect-[3/4] w-full object-cover grayscale-[20%] transition-all ease-in-out [transition-duration:400ms] group-hover:grayscale-0 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="aspect-[3/4] w-full bg-[rgba(var(--color-primary-rgb),0.08)]" aria-hidden="true" />
        )}
      </div>
      <h3 className="mt-4 font-display text-[18px] font-normal text-foreground leading-snug text-left">{name}</h3>
      <p className="mt-1 font-body font-light text-[12px] tracking-[0.1em] text-accent text-left">{"Shop Now ->"}</p>
    </Link>
  );
};

export default CategoryCard;
