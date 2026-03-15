import categoryHaircare from "@/assets/category-haircare.jpg";
import categoryMens from "@/assets/category-mens.jpg";
import categoryWomens from "@/assets/category-womens.jpg";
import categoryBags from "@/assets/category-bags.jpg";
import categoryShoes from "@/assets/category-shoes.jpg";
import type { StorefrontCategorySlug } from "@/lib/categories";

export const categoryImages: Record<StorefrontCategorySlug, string> = {
  "hair-care": categoryHaircare,
  "mens-fashion": categoryMens,
  "womens-fashion": categoryWomens,
  bags: categoryBags,
  shoes: categoryShoes,
};
