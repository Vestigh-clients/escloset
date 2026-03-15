export const STOREFRONT_CATEGORY_ORDER = [
  "hair-care",
  "mens-fashion",
  "womens-fashion",
  "bags",
  "shoes",
] as const;

export type StorefrontCategorySlug = (typeof STOREFRONT_CATEGORY_ORDER)[number];

export const categoryLabels: Record<StorefrontCategorySlug, string> = {
  "hair-care": "Hair Care",
  "mens-fashion": "Men's Fashion",
  "womens-fashion": "Women's Fashion",
  bags: "Bags",
  shoes: "Shoes",
};

const toTitleCaseWords = (value: string) =>
  value
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(" ");

export const isStorefrontCategorySlug = (value: string): value is StorefrontCategorySlug =>
  STOREFRONT_CATEGORY_ORDER.includes(value as StorefrontCategorySlug);

export const getCategoryLabel = (slug: string | null | undefined): string => {
  if (!slug) {
    return "Category";
  }

  return isStorefrontCategorySlug(slug) ? categoryLabels[slug] : toTitleCaseWords(slug);
};

const CATEGORY_SKELETON_COUNTS: Record<StorefrontCategorySlug, number> = {
  "hair-care": 4,
  "mens-fashion": 4,
  "womens-fashion": 3,
  bags: 3,
  shoes: 4,
};

export const getCategorySkeletonCount = (slug: string | null | undefined): number => {
  if (!slug) {
    return 4;
  }

  if (slug === "men") {
    return 4;
  }

  if (slug === "women") {
    return 3;
  }

  if (!isStorefrontCategorySlug(slug)) {
    return 4;
  }

  return CATEGORY_SKELETON_COUNTS[slug];
};
