import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Product, ProductBenefit, ProductCategory, ProductImage } from "@/types/product";

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

const mapProduct = (value: Record<string, unknown>): Product => {
  const compareAtPriceValue = value.compare_at_price;
  const weightGramsValue = value.weight_grams;
  const skuValue = value.sku;

  return {
    id: toString(value.id),
    name: toString(value.name),
    slug: toString(value.slug),
    description: toString(value.description, "") || undefined,
    short_description: toString(value.short_description, "") || undefined,
    price: toNumber(value.price, 0),
    compare_at_price:
      compareAtPriceValue === null || compareAtPriceValue === undefined ? undefined : toNumber(compareAtPriceValue, 0),
    stock_quantity: Math.max(0, Math.trunc(toNumber(value.stock_quantity, 0))),
    is_available: toBoolean(value.is_available),
    is_featured: value.is_featured === null || value.is_featured === undefined ? undefined : toBoolean(value.is_featured),
    images: mapImages(value.images as Json | null | undefined),
    benefits: mapBenefits(value.benefits as Json | null | undefined),
    tags: mapTags(value.tags as Json | null | undefined),
    weight_grams: weightGramsValue === null || weightGramsValue === undefined ? undefined : toNumber(weightGramsValue, 0),
    sku: typeof skuValue === "string" ? skuValue : undefined,
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
  const { data, error } = await supabase
    .from("products")
    .select(`
      id, name, slug, short_description,
      price, compare_at_price,
      stock_quantity, is_available,
      is_featured, images, benefits,
      tags, weight_grams,
      categories ( id, name, slug )
    `)
    .eq("is_available", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return mapProducts(data);
};

// Fetch products by category slug
export const getProductsByCategory = async (categorySlug: string) => {
  const { data, error } = await supabase
    .from("products")
    .select(`
      id, name, slug, short_description,
      price, compare_at_price,
      stock_quantity, is_available,
      is_featured, images, benefits, tags,
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
  const { data, error } = await supabase
    .from("products")
    .select(`
      id, name, slug, description,
      short_description, price,
      compare_at_price, stock_quantity,
      is_available, is_featured, images, benefits,
      tags, weight_grams, sku,
      categories ( id, name, slug )
    `)
    .eq("slug", slug)
    .eq("is_available", true)
    .single();

  if (error) throw error;
  return mapProduct((data ?? {}) as Record<string, unknown>);
};

// Fetch featured products
export const getFeaturedProducts = async () => {
  const { data, error } = await supabase
    .from("products")
    .select(`
      id, name, slug, short_description,
      price, compare_at_price,
      stock_quantity, is_available,
      is_featured, images, categories ( id, name, slug )
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
  const { data, error } = await supabase
    .from("products")
    .select(`
      id, name, slug, price,
      compare_at_price, stock_quantity,
      is_available, images,
      categories ( id, name, slug )
    `)
    .eq("is_available", true)
    .eq("category_id", categoryId)
    .neq("id", excludeProductId)
    .limit(limit);

  if (error) throw error;
  return mapProducts(data);
};
