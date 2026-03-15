import { Link } from "react-router-dom";
import { categoryImages } from "@/data/images";
import { categoryLabels, type StorefrontCategorySlug } from "@/lib/categories";

interface CategoryCardProps {
  category: StorefrontCategorySlug;
}

const CategoryCard = ({ category }: CategoryCardProps) => {
  return (
    <Link to={`/category/${category}`} className="group block">
      <div className="overflow-hidden rounded-[4px]">
        <img
          src={categoryImages[category]}
          alt={categoryLabels[category]}
          className="aspect-[3/4] w-full object-cover grayscale-[20%] transition-all ease-in-out [transition-duration:400ms] group-hover:grayscale-0 group-hover:scale-[1.03]"
          loading="lazy"
        />
      </div>
      <h3 className="mt-4 font-display text-[18px] font-normal text-foreground leading-snug text-left">
        {categoryLabels[category]}
      </h3>
      <p className="mt-1 font-body font-light text-[12px] tracking-[0.1em] text-accent text-left">
        {"Shop Now \u2192"}
      </p>
    </Link>
  );
};

export default CategoryCard;
