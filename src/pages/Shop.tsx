import { useEffect, useMemo, useState } from "react";
import { categoryImages } from "@/data/images";
import ShopProductCard from "@/components/ShopProductCard";
import ProductFetchErrorState from "@/components/products/ProductFetchErrorState";
import {
  STOREFRONT_CATEGORY_ORDER,
  categoryLabels,
  getCategorySkeletonCount,
  isStorefrontCategorySlug,
  type StorefrontCategorySlug,
} from "@/lib/categories";
import { getAllProducts } from "@/services/productService";
import { getPrimaryImage, type Product } from "@/types/product";

type ShopFilter = "all" | StorefrontCategorySlug;

const filterItems: Array<{ label: string; value: ShopFilter }> = [
  { label: "All", value: "all" },
  { label: "Hair Care", value: "hair-care" },
  { label: "Men", value: "mens-fashion" },
  { label: "Women", value: "womens-fashion" },
  { label: "Bags", value: "bags" },
  { label: "Shoes", value: "shoes" },
];

const editorialHeadlines: Record<StorefrontCategorySlug, string> = {
  "hair-care": "Rituals for your most luxurious self.",
  "mens-fashion": "Dressed with intention. Built to last.",
  "womens-fashion": "Effortless elegance, every day.",
  bags: "Carry something worth noticing.",
  shoes: "Every step, considered.",
};

const buildEmptyCategoryMap = (): Record<StorefrontCategorySlug, Product[]> => ({
  "hair-care": [],
  "mens-fashion": [],
  "womens-fashion": [],
  bags: [],
  shoes: [],
});

const ProductCardSkeleton = () => {
  return (
    <div className="flex h-full flex-col">
      <div className="lux-product-shimmer aspect-[4/5] w-full" />
      <div className="mt-3 space-y-2">
        <div className="lux-product-shimmer h-4 w-2/3" />
        <div className="lux-product-shimmer h-3 w-1/3" />
      </div>
    </div>
  );
};

const ProductBannerSkeleton = () => {
  return (
    <article className="bg-transparent">
      <div className="grid h-[400px] w-full grid-cols-[55fr_45fr]">
        <div className="lux-product-shimmer h-full w-full" />
        <div className="bg-[#F5F0E8] p-12">
          <div className="space-y-3">
            <div className="lux-product-shimmer h-3 w-1/3" />
            <div className="lux-product-shimmer h-8 w-3/4" />
            <div className="lux-product-shimmer h-4 w-1/3" />
            <div className="lux-product-shimmer mt-6 h-11 w-40" />
          </div>
        </div>
      </div>
    </article>
  );
};

const renderProductRows = (items: Product[], loading: boolean, expectedCount = 4) => {
  if (loading) {
    const regularCount = Math.max(0, expectedCount - 1);

    return (
      <>
        {regularCount > 0 ? (
          <div className="grid grid-cols-3 gap-[2px]">
            {Array.from({ length: regularCount }).map((_, index) => (
              <ProductCardSkeleton key={`shop-card-skeleton-${index}`} />
            ))}
          </div>
        ) : null}

        <div className={regularCount > 0 ? "mt-[2px]" : ""}>
          <ProductBannerSkeleton />
        </div>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <div className="border border-[#d4ccc2] px-6 py-8 text-center">
        <p className="font-body text-[12px] text-[#555555]">No products available in this category right now.</p>
      </div>
    );
  }

  const standardProducts = items.slice(0, -1);
  const bannerProduct = items[items.length - 1];

  return (
    <>
      {standardProducts.length > 0 ? (
        <div className="grid grid-cols-3 gap-[2px]">
          {standardProducts.map((product) => (
            <ShopProductCard key={product.id} product={product} size="regular" />
          ))}
        </div>
      ) : null}

      <div className={standardProducts.length > 0 ? "mt-[2px]" : ""}>
        <ShopProductCard product={bannerProduct} size="banner" />
      </div>
    </>
  );
};

const Shop = () => {
  const [activeFilter, setActiveFilter] = useState<ShopFilter>("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAllProducts();
        setProducts(data ?? []);
      } catch (err) {
        console.error(err);
        setError("Failed to load products. Please refresh.");
      } finally {
        setLoading(false);
      }
    };

    void fetchProducts();
  }, []);

  const groupedProducts = useMemo(() => {
    const groups = buildEmptyCategoryMap();

    for (const product of products) {
      const slug = product.categories?.slug;
      if (!isStorefrontCategorySlug(slug)) {
        continue;
      }
      groups[slug].push(product);
    }

    return groups;
  }, [products]);

  const bannerImageByCategory = useMemo(() => {
    const result: Record<StorefrontCategorySlug, string> = {
      "hair-care": categoryImages["hair-care"],
      "mens-fashion": categoryImages["mens-fashion"],
      "womens-fashion": categoryImages["womens-fashion"],
      bags: categoryImages.bags,
      shoes: categoryImages.shoes,
    };

    for (const category of STOREFRONT_CATEGORY_ORDER) {
      const categoryProducts = groupedProducts[category];
      const firstWithImage = categoryProducts.find((item) => Boolean(getPrimaryImage(item)));
      if (firstWithImage) {
        result[category] = getPrimaryImage(firstWithImage);
      }
    }

    return result;
  }, [groupedProducts]);

  const categoriesToShow = useMemo(
    () => (activeFilter === "all" ? STOREFRONT_CATEGORY_ORDER : [activeFilter]),
    [activeFilter],
  );

  const visibleProductCount = useMemo(() => {
    if (loading) {
      return categoriesToShow.reduce((total, category) => total + getCategorySkeletonCount(category), 0);
    }

    return categoriesToShow.reduce((total, category) => total + groupedProducts[category].length, 0);
  }, [categoriesToShow, groupedProducts, loading]);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-14 md:py-16">
        <ProductFetchErrorState />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-14 md:py-16">
      <div className="text-center mb-8">
        <h1 className="font-display text-[42px] md:text-[52px] font-light italic leading-tight">Our Collection</h1>
      </div>

      <div className="mb-12 border-b border-[#d4ccc2] pb-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2.5">
            {filterItems.map((filter) => {
              const isActive = activeFilter === filter.value;

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setActiveFilter(filter.value)}
                  className={`border px-7 py-[10px] font-body text-[11px] font-light uppercase tracking-[0.1em] transition-colors duration-300 ${
                    isActive
                      ? "border-[#1A1A1A] bg-[#1A1A1A] text-[#F5F0E8]"
                      : "border-[#d4ccc2] text-foreground hover:border-foreground/40"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <p className="font-body text-[12px] font-normal text-[#555555] md:text-right">Showing {visibleProductCount} products</p>
        </div>
      </div>

      <div>
        {categoriesToShow.map((category, index) => {
          const categoryProducts = groupedProducts[category];
          const showDivider = index > 0;

          return (
            <section key={category} className={showDivider ? "pt-20" : ""}>
              {showDivider ? (
                <div className="mt-0 mb-10 border-t border-[#d4ccc2] pt-8">
                  <p className="font-body text-[10px] font-medium uppercase tracking-[0.2em] text-accent">{categoryLabels[category]}</p>
                </div>
              ) : (
                <div className="mb-10">
                  <p className="font-body text-[10px] font-medium uppercase tracking-[0.2em] text-accent">{categoryLabels[category]}</p>
                </div>
              )}

              {showDivider && activeFilter === "all" && (
                <div className="relative left-1/2 right-1/2 my-20 min-h-[60vh] w-screen -translate-x-1/2 overflow-hidden">
                  <img
                    src={bannerImageByCategory[category]}
                    alt={categoryLabels[category]}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-[rgba(0,0,0,0.4)]" />

                  <div className="relative z-10 flex min-h-[60vh] items-center">
                    <div className="max-w-[600px] px-6 md:px-0 md:pl-[80px]">
                      <p className="mb-4 font-body text-[11px] font-medium uppercase tracking-[0.2em] text-accent">
                        {categoryLabels[category]}
                      </p>
                      <h2 className="font-display text-[38px] md:text-[52px] font-light italic leading-[1.2] text-white">
                        {editorialHeadlines[category]}
                      </h2>
                    </div>
                  </div>
                </div>
              )}

              <div>{renderProductRows(categoryProducts, loading, getCategorySkeletonCount(category))}</div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default Shop;

