import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type {
  Product,
  ProductBenefit,
  ProductCategory,
  ProductImage,
  ProductOptionType,
  ProductOptionValue,
  ProductVariant,
} from "@/types/product";

const UNKNOWN_CATEGORY: ProductCategory = {
  id: "",
  name: "Uncategorized",
  slug: "",
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: unknown): boolean => value === true;

const toString = (value: unknown, fallback = ""): string => {
  return typeof value === "string" ? value : fallback;
};

const toStockQuantity = (value: unknown, fallback = 0): number => {
  return Math.max(0, Math.trunc(toNumber(value, fallback)));
};

const mapCategory = (value: unknown): ProductCategory => {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate || typeof candidate !== "object") {
    return UNKNOWN_CATEGORY;
  }

  const record = candidate as Record<string, unknown>;
  return {
    id: toString(record.id, ""),
    name: toString(record.name, "Uncategorized"),
    slug: toString(record.slug, ""),
  };
};

const mapImage = (value: unknown, index: number): ProductImage | null => {
  if (typeof value === "string" && value.trim()) {
    return {
      url: value.trim(),
      alt_text: "",
      is_primary: index === 0,
      display_order: index,
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const urlCandidate = [record.url, record.image_url, record.src].find(
    (entry) => typeof entry === "string" && entry.trim().length > 0,
  );

  if (!urlCandidate || typeof urlCandidate !== "string") {
    return null;
  }

  return {
    url: urlCandidate,
    alt_text: toString(record.alt_text, ""),
    is_primary: toBoolean(record.is_primary) || toBoolean(record.primary),
    display_order: toNumber(record.display_order, index),
  };
};

const mapImages = (value: Json | null | undefined): ProductImage[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const mapped = value
    .map((entry, index) => mapImage(entry, index))
    .filter((entry): entry is ProductImage => Boolean(entry))
    .sort((a, b) => a.display_order - b.display_order);

  if (!mapped.some((entry) => entry.is_primary) && mapped[0]) {
    mapped[0] = { ...mapped[0], is_primary: true };
  }

  return mapped;
};

const mapBenefit = (value: unknown): ProductBenefit | null => {
  if (typeof value === "string" && value.trim()) {
    return {
      icon: "",
      label: value.trim(),
      description: "",
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const label = toString(record.label, "").trim();
  const description = toString(record.description, "").trim();

  if (!label && !description) {
    return null;
  }

  return {
    icon: toString(record.icon, ""),
    label: label || description,
    description,
  };
};

const mapBenefits = (value: Json | null | undefined): ProductBenefit[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => mapBenefit(entry)).filter((entry): entry is ProductBenefit => Boolean(entry));
};

const mapTags = (value: Json | null | undefined): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const mapVariantOption = (value: unknown): ProductVariant["product_variant_options"][number] | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const optionTypeId = toString(record.option_type_id, "");
  const optionValueId = toString(record.option_value_id, "");

  if (!optionTypeId || !optionValueId) {
    return null;
  }

  return {
    option_type_id: optionTypeId,
    option_value_id: optionValueId,
  };
};

const mapVariant = (value: unknown): ProductVariant | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = toString(record.id, "");

  if (!id) {
    return null;
  }

  const variantOptions = Array.isArray(record.product_variant_options) ? record.product_variant_options : [];

  return {
    id,
    label: typeof record.label === "string" ? record.label : null,
    price: record.price === null || record.price === undefined ? null : toNumber(record.price, 0),
    compare_at_price: record.compare_at_price === null || record.compare_at_price === undefined ? null : toNumber(record.compare_at_price, 0),
    stock_quantity: toStockQuantity(record.stock_quantity, 0),
    is_available: record.is_available !== false,
    display_order: toStockQuantity(record.display_order, 0),
    sku: typeof record.sku === "string" ? record.sku : null,
    product_variant_options: variantOptions.map((entry) => mapVariantOption(entry)).filter((entry): entry is ProductVariant["product_variant_options"][number] => Boolean(entry)),
  };
};

const mapOptionValue = (value: unknown, optionTypeId: string): ProductOptionValue | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = toString(record.id, "");

  if (!id) {
    return null;
  }

  return {
    id,
    option_type_id: toString(record.option_type_id, optionTypeId),
    value: toString(record.value, ""),
    color_hex: typeof record.color_hex === "string" ? record.color_hex : null,
    display_order: toStockQuantity(record.display_order, 0),
  };
};

const mapOptionType = (value: unknown): ProductOptionType | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = toString(record.id, "");

  if (!id) {
    return null;
  }

  const optionValues = Array.isArray(record.product_option_values) ? record.product_option_values : [];

  return {
    id,
    name: toString(record.name, ""),
    display_order: toStockQuantity(record.display_order, 0),
    product_option_values: optionValues
      .map((entry) => mapOptionValue(entry, id))
      .filter((entry): entry is ProductOptionValue => Boolean(entry))
      .sort((a, b) => a.display_order - b.display_order),
  };
};

const mapProduct = (value: Record<string, unknown>): Product => {
  const compareAtPriceValue = value.compare_at_price;
  const weightGramsValue = value.weight_grams;
  const skuValue = value.sku;
  const inStockValue = value.in_stock;
  const totalStockQuantityValue = value.total_stock_quantity;
  const optionTypeRows = Array.isArray(value.product_option_types) ? value.product_option_types : [];
  const variantRows = Array.isArray(value.product_variants) ? value.product_variants : [];

  return {
    id: toString(value.id),
    name: toString(value.name),
    slug: toString(value.slug),
    description: toString(value.description, "") || undefined,
    short_description: toString(value.short_description, "") || undefined,
    price: toNumber(value.price, 0),
    compare_at_price:
      compareAtPriceValue === null || compareAtPriceValue === undefined ? undefined : toNumber(compareAtPriceValue, 0),
    stock_quantity: toStockQuantity(value.stock_quantity, 0),
    total_stock_quantity:
      totalStockQuantityValue === null || totalStockQuantityValue === undefined
        ? undefined
        : toStockQuantity(totalStockQuantityValue, 0),
    in_stock: inStockValue === null || inStockValue === undefined ? undefined : toBoolean(inStockValue),
    is_available: toBoolean(value.is_available),
    is_featured: value.is_featured === null || value.is_featured === undefined ? undefined : toBoolean(value.is_featured),
    has_variants: value.has_variants === null || value.has_variants === undefined ? undefined : toBoolean(value.has_variants),
    images: mapImages(value.images as Json | null | undefined),
    benefits: mapBenefits(value.benefits as Json | null | undefined),
    tags: mapTags(value.tags as Json | null | undefined),
    weight_grams: weightGramsValue === null || weightGramsValue === undefined ? undefined : toNumber(weightGramsValue, 0),
    sku: typeof skuValue === "string" ? skuValue : undefined,
    product_option_types: optionTypeRows
      .map((entry) => mapOptionType(entry))
      .filter((entry): entry is ProductOptionType => Boolean(entry))
      .sort((a, b) => a.display_order - b.display_order),
    product_variants: variantRows
      .map((entry) => mapVariant(entry))
      .filter((entry): entry is ProductVariant => Boolean(entry))
      .sort((a, b) => a.display_order - b.display_order),
    categories: mapCategory(value.categories),
  };
};

const mapProducts = (rows: unknown[] | null | undefined): Product[] => {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => mapProduct(row));
};

// Fetch all available products
export const getAllProducts = async () => {
  const { data, error } = await (supabase as any)
    .from("products_with_stock")
    .select(`
      id, name, slug, short_description,
      price, compare_at_price,
      stock_quantity,
      total_stock_quantity,
      in_stock,
      is_available, is_featured,
      has_variants,
      images, benefits, tags,
      weight_grams,
      categories ( id, name, slug ),
      product_option_types (
        id, name, display_order,
        product_option_values (
          id, value, color_hex,
          display_order
        )
      ),
      product_variants (
        id, stock_quantity,
        is_available,
        display_order,
        product_variant_options (
          option_type_id,
          option_value_id
        )
      )
    `)
    .eq("is_available", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return mapProducts(data);
};

// Fetch products by category slug
export const getProductsByCategory = async (categorySlug: string) => {
  const { data, error } = await (supabase as any)
    .from("products_with_stock")
    .select(`
      id, name, slug, short_description,
      price, compare_at_price,
      stock_quantity,
      total_stock_quantity,
      in_stock,
      is_available, is_featured,
      has_variants,
      images,
      categories!inner ( id, name, slug )
    `)
    .eq("is_available", true)
    .eq("categories.slug", categorySlug)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return mapProducts(data);
};

// Fetch single product by slug
export const getProductBySlug = async (slug: string) => {
  const { data, error } = await (supabase as any)
    .from("products_with_stock")
    .select(`
      id, name, slug, description,
      short_description, price,
      compare_at_price,
      stock_quantity,
      total_stock_quantity,
      in_stock,
      is_available, has_variants,
      images, benefits, tags,
      weight_grams, sku,
      categories ( id, name, slug ),
      product_option_types (
        id, name, display_order,
        product_option_values (
          id, value, color_hex,
          display_order
        )
      ),
      product_variants (
        id, label, price,
        compare_at_price,
        stock_quantity,
        is_available,
        display_order, sku,
        product_variant_options (
          option_type_id,
          option_value_id
        )
      )
    `)
    .eq("slug", slug)
    .eq("is_available", true)
    .single();

  if (error) throw error;
  return mapProduct((data ?? {}) as Record<string, unknown>);
};

// Fetch featured products
export const getFeaturedProducts = async () => {
  const { data, error } = await (supabase as any)
    .from("products_with_stock")
    .select(`
      id, name, slug, short_description,
      price, compare_at_price,
      stock_quantity,
      total_stock_quantity,
      in_stock,
      is_available,
      has_variants,
      is_featured, images,
      categories ( id, name, slug )
    `)
    .eq("is_available", true)
    .eq("is_featured", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return mapProducts(data);
};

// Fetch related products
// (same category, exclude current product)
export const getRelatedProducts = async (categoryId: string, excludeProductId: string, limit = 3) => {
  const { data, error } = await (supabase as any)
    .from("products_with_stock")
    .select(`
      id, name, slug, price,
      compare_at_price,
      stock_quantity,
      total_stock_quantity,
      in_stock,
      is_available,
      has_variants,
      images,
      categories ( id, name, slug )
    `)
    .eq("is_available", true)
    .eq("category_id", categoryId)
    .neq("id", excludeProductId)
    .limit(limit);

  if (error) throw error;
  return mapProducts(data);
};
