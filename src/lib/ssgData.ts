import { createSupabaseServerClient } from "../integrations/supabase/server";
import { getAllProducts, getProductBySlug, getRelatedProducts, getTopSellingProductIds } from "../services/productService";
import { fetchPublicSiteSettings, type PublicSiteSettings } from "../services/publicSiteSettingsService";
import { fetchStorefrontCategories, type StorefrontCategory } from "../services/storefrontCategoryService";
import type { Product } from "../types/product";

type PublicSupabaseClient = Parameters<typeof getAllProducts>[0];

export interface SiteShellData {
  publicSettings: PublicSiteSettings;
  categories: StorefrontCategory[];
}

export interface HomePageData extends SiteShellData {
  newArrivals: Product[];
  bestSellers: Product[];
}

export interface ShopPageData extends SiteShellData {
  products: Product[];
}

export interface ProductPageData extends SiteShellData {
  product: Product;
  relatedProducts: Product[];
}

export const fetchSiteShellData = async (): Promise<SiteShellData> => {
  const supabase = createSupabaseServerClient() as PublicSupabaseClient;
  const [publicSettings, categories] = await Promise.all([
    fetchPublicSiteSettings(supabase),
    fetchStorefrontCategories(supabase),
  ]);

  return { publicSettings, categories };
};

export const fetchHomePageData = async (): Promise<HomePageData> => {
  const supabase = createSupabaseServerClient() as PublicSupabaseClient;
  const [publicSettings, categories, products, topSellingProductIds] = await Promise.all([
    fetchPublicSiteSettings(supabase),
    fetchStorefrontCategories(supabase),
    getAllProducts(supabase),
    getTopSellingProductIds(4, supabase),
  ]);

  if (products.length === 0) {
    throw new Error("Homepage products unavailable - aborting build");
  }

  const productsById = new Map(products.map((product) => [product.id, product]));
  const rankedBestSellers = topSellingProductIds
    .map((productId) => productsById.get(productId))
    .filter((product): product is Product => Boolean(product));

  return {
    publicSettings,
    categories,
    newArrivals: products.slice(0, 4),
    bestSellers: rankedBestSellers.length > 0 ? rankedBestSellers : products.slice(0, 4),
  };
};

export const fetchShopPageData = async (): Promise<ShopPageData> => {
  const supabase = createSupabaseServerClient() as PublicSupabaseClient;
  const [publicSettings, categories, products] = await Promise.all([
    fetchPublicSiteSettings(supabase),
    fetchStorefrontCategories(supabase),
    getAllProducts(supabase),
  ]);

  if (products.length === 0) {
    throw new Error("Shop products unavailable - aborting build");
  }

  return { publicSettings, categories, products };
};

export const fetchProductPageData = async (slug: string | undefined): Promise<ProductPageData> => {
  const normalizedSlug = slug?.trim();
  if (!normalizedSlug) {
    throw new Error("Product slug missing - aborting build");
  }

  const supabase = createSupabaseServerClient() as PublicSupabaseClient;
  const [publicSettings, categories, product] = await Promise.all([
    fetchPublicSiteSettings(supabase),
    fetchStorefrontCategories(supabase),
    getProductBySlug(normalizedSlug, supabase),
  ]);

  if (!product?.id || !product.name?.trim()) {
    throw new Error(`Product not found: ${normalizedSlug} - aborting build`);
  }

  const relatedProducts = await getRelatedProducts(product, 4, supabase);

  return { publicSettings, categories, product, relatedProducts };
};
