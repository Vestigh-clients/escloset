import { storeConfig } from "../config/store.config";
import { getPrimaryImage, isInStock, type Product } from "../types/product";

const readRequiredEnv = (key: string): string => {
  const fromProcess = typeof process !== "undefined" ? process.env[key] : undefined;
  const fromImportMeta = import.meta.env?.[key] as string | undefined;
  const value = fromProcess || fromImportMeta;

  if (!value?.trim() && import.meta.env?.DEV) {
    return "http://localhost:5173";
  }

  if (!value?.trim()) {
    throw new Error(`${key} is required for prerendered SEO output`);
  }

  return value.trim();
};

export const getSiteUrl = () => readRequiredEnv("VITE_SITE_URL").replace(/\/+$/, "");

export const buildCanonicalUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
};

export const toAbsoluteUrl = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  return `${getSiteUrl()}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
};

export const getProductDescription = (product: Product) => {
  return (
    product.short_description?.trim() ||
    product.description?.replace(/\s+/g, " ").trim() ||
    `Shop ${product.name} from ${storeConfig.storeName}.`
  );
};

export const buildProductJsonLd = (product: Product) => {
  const name = product.name?.trim();
  const price = Number(product.price);
  const image = toAbsoluteUrl(getPrimaryImage(product));
  const availability = isInStock(product) ? "InStock" : "OutOfStock";

  if (!name || !Number.isFinite(price) || price <= 0 || !image || !availability) {
    return null;
  }

  const url = buildCanonicalUrl(`/shop/${product.slug}`);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    image: [image],
    description: getProductDescription(product),
    sku: product.sku || undefined,
    url,
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: storeConfig.currency.code,
      availability: `https://schema.org/${availability}`,
      url,
    },
  };
};

export const serializeJsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");
