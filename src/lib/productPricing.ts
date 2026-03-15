export const shouldShowPriceVariesByVariantNote = (
  hasPriceDifferenceAcrossVariants: boolean,
  selectedVariantPrice: number | null | undefined,
  productPrice: number | null | undefined,
): boolean => {
  if (!hasPriceDifferenceAcrossVariants) {
    return false;
  }

  if (selectedVariantPrice === null || selectedVariantPrice === undefined) {
    return false;
  }

  if (productPrice === null || productPrice === undefined) {
    return false;
  }

  return selectedVariantPrice !== productPrice;
};
