export type ProductImage = {
  url: string;
  alt_text: string;
  is_primary: boolean;
  display_order: number;
};

export type ProductBenefit = {
  icon: string;
  label: string;
  description: string;
};

export type ProductCategory = {
  id: string;
  name: string;
  slug: string;
};

export type ProductOptionValue = {
  id: string;
  option_type_id: string;
  value: string;
  color_hex: string | null;
  display_order: number;
};

export type ProductOptionType = {
  id: string;
  name: string;
  display_order: number;
  product_option_values: ProductOptionValue[];
};

export type ProductVariantOption = {
  option_type_id: string;
  option_value_id: string;
};

export type ProductVariant = {
  id: string;
  label: string | null;
  price: number | null;
  compare_at_price: number | null;
  stock_quantity: number;
  is_available: boolean;
  display_order: number;
  sku: string | null;
  product_variant_options: ProductVariantOption[];
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  short_description?: string;
  price: number;
  compare_at_price?: number;
  stock_quantity: number;
  is_available: boolean;
  is_featured?: boolean;
  images: ProductImage[];
  benefits?: ProductBenefit[];
  tags?: string[];
  weight_grams?: number;
  sku?: string;
  has_variants?: boolean;
  product_option_types?: ProductOptionType[];
  product_variants?: ProductVariant[];
  categories: ProductCategory;
};

export const getPrimaryImage = (product: Product): string => {
  if (!product.images?.length) return "";
  const primary = product.images.find((img) => img.is_primary);
  return primary?.url ?? product.images[0].url;
};

export const isOnSale = (product: Product): boolean => {
  return !!product.compare_at_price && product.compare_at_price > product.price;
};

export const isInStock = (product: Product): boolean => {
  return product.is_available && product.stock_quantity > 0;
};
