import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ShopProductCard from "@/components/ShopProductCard";
import ProductFetchErrorState from "@/components/products/ProductFetchErrorState";
import { storeConfig } from "@/config/store.config";
import { getAllProducts } from "@/services/productService";
import { getPrimaryImage, type Product } from "@/types/product";

type ShopFilter = "all" | string;

const DEFAULT_SKELETON_COUNT = 4;

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
        <div className="bg-[var(--color-secondary)] p-12">
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

const renderProductRows = (items: Product[], loading: boolean, expectedCount = DEFAULT_SKELETON_COUNT) => {
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
      <div className="border border-[var(--color-border)] px-6 py-8 text-center">
        <p className="font-body text-[12px] text-[var(--color-muted)]">No products available in this category right now.</p>
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
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
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

  const enabledCategories = useMemo(() => {
    const categories = storeConfig.categories
      .filter((category) => category.enabled)
      .map((category) => {
        const normalizedSlug = category.slug.trim().toLowerCase();
        return {
          ...category,
          slug: normalizedSlug,
        };
      })
      .filter((category) => category.slug.length > 0);

    const seen = new Set<string>();
    return categories.filter((category) => {
      if (seen.has(category.slug)) {
        return false;
      }
      seen.add(category.slug);
      return true;
    });
  }, []);

  const categoryBySlug = useMemo(() => {
    return Object.fromEntries(enabledCategories.map((category) => [category.slug, category]));
  }, [enabledCategories]);

  const requestedCategory = (slug ?? "").trim().toLowerCase();
  const activeFilter: ShopFilter = requestedCategory && categoryBySlug[requestedCategory] ? requestedCategory : "all";

  const groupedProducts = useMemo(() => {
    const groups = Object.fromEntries(enabledCategories.map((category) => [category.slug, [] as Product[]]));

    for (const product of products) {
      const slug = (product.categories?.slug ?? "").trim().toLowerCase();
      if (!slug || !groups[slug]) {
        continue;
      }
      groups[slug].push(product);
    }

    return groups;
  }, [enabledCategories, products]);

  const bannerImageByCategory = useMemo(() => {
    const result = Object.fromEntries(enabledCategories.map((category) => [category.slug, category.imageUrl || ""]));

    for (const category of enabledCategories) {
      const categoryProducts = groupedProducts[category.slug] ?? [];
      const firstWithImage = categoryProducts.find((item) => Boolean(getPrimaryImage(item)));
      if (firstWithImage) {
        result[category.slug] = getPrimaryImage(firstWithImage);
      }
    }

    return result;
  }, [enabledCategories, groupedProducts]);

  const categoriesToShow = useMemo(
    () => (activeFilter === "all" ? enabledCategories.map((category) => category.slug) : [activeFilter]),
    [activeFilter, enabledCategories],
  );

  const visibleProductCount = useMemo(() => {
    if (loading) {
      return categoriesToShow.length * DEFAULT_SKELETON_COUNT;
    }

    return categoriesToShow.reduce((total, categorySlug) => total + (groupedProducts[categorySlug]?.length ?? 0), 0);
  }, [categoriesToShow, groupedProducts, loading]);

  const filterItems = useMemo(
    () => [
      { label: "All", value: "all" as ShopFilter },
      ...enabledCategories.map((category) => ({ label: category.name, value: category.slug as ShopFilter })),
    ],
    [enabledCategories],
  );

  const setActiveFilter = (nextFilter: ShopFilter) => {
    if (nextFilter === "all") {
      navigate("/shop");
    } else {
      navigate(`/category/${encodeURIComponent(nextFilter)}`);
    }
  };

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

      <div className="mb-12 border-b border-[var(--color-border)] pb-6">
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
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-secondary)]"
                      : "border-[var(--color-border)] text-foreground hover:border-foreground/40"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <p className="font-body text-[12px] font-normal text-[var(--color-muted)] md:text-right">Showing {visibleProductCount} products</p>
        </div>
      </div>

      {enabledCategories.length === 0 ? (
        <div className="border border-[var(--color-border)] px-6 py-8 text-center">
          <p className="font-body text-[12px] text-[var(--color-muted)]">No enabled categories configured for this store.</p>
        </div>
      ) : (
        <div>
          {categoriesToShow.map((categorySlug, index) => {
            const category = categoryBySlug[categorySlug];
            const categoryProducts = groupedProducts[categorySlug] ?? [];
            const showDivider = index > 0;
            const bannerImage = bannerImageByCategory[categorySlug];
            const categoryLabel = category?.name ?? categorySlug;
            const categoryHeadline = category?.description?.trim() || `Explore ${categoryLabel}.`;

            return (
              <section key={categorySlug} className={showDivider ? "pt-20" : ""}>
                {showDivider ? (
                  <div className="mt-0 mb-10 border-t border-[var(--color-border)] pt-8">
                    <p className="font-body text-[10px] font-medium uppercase tracking-[0.2em] text-accent">{categoryLabel}</p>
                  </div>
                ) : (
                  <div className="mb-10">
                    <p className="font-body text-[10px] font-medium uppercase tracking-[0.2em] text-accent">{categoryLabel}</p>
                  </div>
                )}

                {showDivider && activeFilter === "all" && (
                  <div className="relative left-1/2 right-1/2 my-20 min-h-[60vh] w-screen -translate-x-1/2 overflow-hidden">
                    {bannerImage ? (
                      <img
                        src={bannerImage}
                        alt={categoryLabel}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[rgba(var(--color-primary-rgb),0.12)]" />
                    )}
                    <div className="absolute inset-0 bg-[rgba(var(--color-primary-rgb),0.4)]" />

                    <div className="relative z-10 flex min-h-[60vh] items-center">
                      <div className="max-w-[600px] px-6 md:px-0 md:pl-[80px]">
                        <p className="mb-4 font-body text-[11px] font-medium uppercase tracking-[0.2em] text-accent">{categoryLabel}</p>
                        <h2 className="font-display text-[38px] md:text-[52px] font-light italic leading-[1.2] text-white">{categoryHeadline}</h2>
                      </div>
                    </div>
                  </div>
                )}

                <div>{renderProductRows(categoryProducts, loading, DEFAULT_SKELETON_COUNT)}</div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Shop;
