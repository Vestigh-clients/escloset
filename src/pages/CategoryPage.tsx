import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ProductFetchErrorState from "@/components/products/ProductFetchErrorState";
import ProductImagePlaceholder from "@/components/products/ProductImagePlaceholder";
import { categoryImages } from "@/data/images";
import { categoryLabels, getCategorySkeletonCount, isStorefrontCategorySlug, type StorefrontCategorySlug } from "@/lib/categories";
import { formatPrice } from "@/lib/price";
import { getProductsByCategory } from "@/services/productService";
import { getPrimaryImage, type Product } from "@/types/product";

type SortOption = "featured" | "price-low-high" | "price-high-low" | "newest";

const editorialQuotes: Record<StorefrontCategorySlug, string> = {
  "hair-care": "Your hair deserves a ritual, not a routine.",
  "mens-fashion": "Built for the man who notices the details.",
  "womens-fashion": "Worn with intention. Made to last.",
  bags: "The right bag changes everything.",
  shoes: "Stand in something worth remembering.",
};

const editorialDescriptions: Record<StorefrontCategorySlug, string> = {
  "hair-care": "Formulas selected for strength, softness, and long-term hair health.\nLuxury begins with consistency.",
  "mens-fashion": "Tailored essentials shaped by clean lines and durable construction.\nA focused wardrobe for everyday confidence.",
  "womens-fashion": "Refined silhouettes designed to move between day and evening.\nQuiet confidence in every detail.",
  bags: "Structured and soft forms curated for function and statement.\nCarry pieces that complete the look.",
  shoes: "Footwear built for comfort, finish, and timeless wear.\nEvery step grounded in quality.",
};

const heroDescriptions: Record<StorefrontCategorySlug, string> = {
  "hair-care": "A focused edit of treatments and cleansers for healthy, luminous hair.",
  "mens-fashion": "Modern essentials for a precise and elevated wardrobe.",
  "womens-fashion": "Intentional pieces created for everyday elegance.",
  bags: "Distinctive bags designed for utility and style in equal measure.",
  shoes: "Curated footwear designed for comfort, balance, and impact.",
};

interface CategoryProductCardProps {
  product: Product;
  variant: "large" | "standard" | "banner";
}

const CategoryProductCard = ({ product, variant }: CategoryProductCardProps) => {
  const image = getPrimaryImage(product);
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [image, product.id]);

  if (variant === "banner") {
    return (
      <article className="group border-t border-[#d4ccc2] pt-8">
        <div className="grid grid-cols-1 md:grid-cols-5">
          <div className="relative overflow-hidden md:col-span-3">
            <Link to={`/shop/${product.slug}`} className="block">
              {image && !hasImageError ? (
                <img
                  src={image}
                  alt={product.name}
                  className="h-[320px] md:h-[420px] w-full object-cover transition-transform ease-out [transition-duration:400ms] group-hover:scale-[1.04]"
                  loading="lazy"
                  onError={() => setHasImageError(true)}
                />
              ) : (
                <ProductImagePlaceholder className="h-[320px] md:h-[420px] w-full" />
              )}
            </Link>
          </div>

          <div className="md:col-span-2 flex flex-col justify-center border-[#d4ccc2] px-6 py-8 transition-colors duration-300 ease-in-out md:border-l md:px-8 group-hover:bg-[#1A1A1A]">
            <Link to={`/shop/${product.slug}`}>
              <h3 className="font-display text-[16px] font-normal italic leading-snug text-foreground transition-colors duration-300 ease-in-out group-hover:text-[#F5F0E8]">
                {product.name}
              </h3>
            </Link>
            <p className="mt-2 font-body text-[13px] font-normal text-[#888] transition-colors duration-300 ease-in-out group-hover:text-[#F5F0E8]">
              {formatPrice(product.price)}
            </p>

            <p className="mt-4 font-body text-[13px] font-light leading-[1.8] text-[#666666] transition-colors duration-300 ease-in-out group-hover:text-[#F5F0E8]">
              {product.short_description || product.description || ""}
            </p>
          </div>
        </div>
      </article>
    );
  }

  const imageWrapperClass =
    variant === "large"
      ? "group relative overflow-hidden aspect-[3/4] md:aspect-auto md:flex-1"
      : "group relative overflow-hidden aspect-[4/5]";

  return (
    <article className="flex h-full flex-col">
      <div className={imageWrapperClass}>
        <Link to={`/shop/${product.slug}`} className="block h-full">
          {image && !hasImageError ? (
            <img
              src={image}
              alt={product.name}
              className="h-full w-full object-cover transition-transform ease-out [transition-duration:400ms] group-hover:scale-[1.04]"
              loading="lazy"
              onError={() => setHasImageError(true)}
            />
          ) : (
            <ProductImagePlaceholder className="h-full w-full" />
          )}
        </Link>
      </div>

      <div className="mt-[14px] text-left">
        <Link to={`/shop/${product.slug}`}>
          <h3 className="font-display text-[16px] font-normal italic leading-snug text-foreground">{product.name}</h3>
        </Link>
        <p className="mt-1 font-body text-[13px] font-normal text-[#888]">{formatPrice(product.price)}</p>
      </div>
    </article>
  );
};

const CardSkeleton = ({ variant }: { variant: "large" | "standard" }) => (
  <div className="flex h-full flex-col">
    <div className={variant === "large" ? "lux-product-shimmer aspect-[3/4] md:aspect-auto md:flex-1" : "lux-product-shimmer aspect-[4/5]"} />
    <div className="mt-[14px] space-y-2">
      <div className="lux-product-shimmer h-4 w-2/3" />
      <div className="lux-product-shimmer h-3 w-1/3" />
    </div>
  </div>
);

const BannerSkeleton = () => (
  <article className="border-t border-[#d4ccc2] pt-8">
    <div className="grid grid-cols-1 md:grid-cols-5">
      <div className="lux-product-shimmer h-[320px] md:h-[420px] w-full md:col-span-3" />
      <div className="md:col-span-2 border-[#d4ccc2] px-6 py-8 md:border-l md:px-8">
        <div className="space-y-3">
          <div className="lux-product-shimmer h-4 w-2/3" />
          <div className="lux-product-shimmer h-3 w-1/3" />
          <div className="lux-product-shimmer h-14 w-full" />
        </div>
      </div>
    </div>
  </article>
);

const CategoryPage = () => {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isValidCategory = isStorefrontCategorySlug(categorySlug || "");
  const category = (categorySlug || "hair-care") as StorefrontCategorySlug;

  useEffect(() => {
    if (!categorySlug || !isValidCategory) {
      setLoading(false);
      setProducts([]);
      return;
    }

    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getProductsByCategory(categorySlug);
        setProducts(data ?? []);
      } catch (err) {
        console.error(err);
        setError("Failed to load products.");
      } finally {
        setLoading(false);
      }
    };

    void fetchProducts();
  }, [categorySlug, isValidCategory]);

  const sortedProducts = useMemo(() => {
    const indexed = products.map((product, index) => ({ product, index }));

    switch (sortBy) {
      case "price-low-high":
        return [...indexed].sort((a, b) => a.product.price - b.product.price).map((entry) => entry.product);
      case "price-high-low":
        return [...indexed].sort((a, b) => b.product.price - a.product.price).map((entry) => entry.product);
      case "newest":
        return [...indexed].sort((a, b) => a.index - b.index).map((entry) => entry.product);
      case "featured":
      default:
        return [...indexed]
          .sort((a, b) => {
            const featuredDiff = Number(Boolean(b.product.is_featured)) - Number(Boolean(a.product.is_featured));
            return featuredDiff !== 0 ? featuredDiff : a.index - b.index;
          })
          .map((entry) => entry.product);
    }
  }, [products, sortBy]);

  const productChunks = useMemo(() => {
    const chunks: Product[][] = [];
    for (let index = 0; index < sortedProducts.length; index += 4) {
      chunks.push(sortedProducts.slice(index, index + 4));
    }
    return chunks;
  }, [sortedProducts]);

  const skeletonChunks = useMemo(() => {
    const skeletonCount = getCategorySkeletonCount(categorySlug);
    const chunked: number[][] = [];
    const items = Array.from({ length: skeletonCount }).map((_, index) => index);

    for (let index = 0; index < items.length; index += 4) {
      chunked.push(items.slice(index, index + 4));
    }

    return chunked;
  }, [categorySlug]);

  if (!isValidCategory) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-bold mb-4">Category Not Found</h1>
        <Link to="/shop" className="font-body text-accent hover:underline">
          {"\u2190 Back to Shop"}
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-20">
        <ProductFetchErrorState />
      </div>
    );
  }

  return (
    <div className="bg-[#F5F0E8] text-foreground">
      <div className="space-y-[80px]">
        <section className="relative min-h-[70vh] overflow-hidden">
          <img src={categoryImages[category]} alt={categoryLabels[category]} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.65)_0%,rgba(0,0,0,0.05)_100%)]" />

          <div className="absolute bottom-8 left-6 right-6 z-10 max-w-[520px] text-left md:bottom-[80px] md:left-[80px] md:right-auto">
            <p className="mb-3 font-body text-[10px] font-light uppercase tracking-[0.2em] text-accent">{categoryLabels[category]}</p>
            <h1 className="font-display text-[46px] md:text-[64px] font-light italic leading-[1.05] text-white">{categoryLabels[category]}</h1>
            <p className="mt-4 max-w-[400px] font-body text-[14px] font-light leading-relaxed text-white/70">{heroDescriptions[category]}</p>
          </div>
        </section>

        <section className="border-b border-[#d4ccc2] pb-8">
          <div className="container mx-auto px-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-body text-[11px] font-light text-[#888888]">
              Showing {loading ? getCategorySkeletonCount(categorySlug) : sortedProducts.length} products
            </p>

            <div className="relative inline-flex items-center gap-2 self-start sm:self-auto">
              <span className="font-body text-[11px] font-light text-[#888888]">Sort by:</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
                className="appearance-none bg-transparent border-none p-0 pr-4 font-body text-[11px] font-light text-foreground focus:outline-none"
                aria-label="Sort products"
                disabled={loading}
              >
                <option value="featured">Featured</option>
                <option value="price-low-high">Price Low-High</option>
                <option value="price-high-low">Price High-Low</option>
                <option value="newest">Newest</option>
              </select>
              <span className="pointer-events-none absolute right-0 font-body text-[11px] text-[#888888]">v</span>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 pb-[80px]">
          <div className="space-y-[80px]">
            {loading
              ? skeletonChunks.map((chunk, chunkIndex) => {
                  const [firstProduct, secondProduct, thirdProduct, bannerProduct] = chunk;

                  return (
                    <div key={`skeleton-chunk-${chunkIndex}`} className="space-y-[80px]">
                      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-stretch md:gap-6">
                        {firstProduct !== undefined ? (
                          <div className="h-full">
                            <CardSkeleton variant="large" />
                          </div>
                        ) : null}

                        {secondProduct !== undefined || thirdProduct !== undefined ? (
                          <div className={`grid gap-6 md:h-full ${secondProduct !== undefined && thirdProduct !== undefined ? "md:grid-rows-2" : ""}`}>
                            {secondProduct !== undefined ? (
                              <div className="h-full">
                                <CardSkeleton variant="standard" />
                              </div>
                            ) : null}

                            {thirdProduct !== undefined ? (
                              <div className="h-full">
                                <CardSkeleton variant="standard" />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      {chunkIndex === 0 ? (
                        <div className="bg-foreground px-8 py-[100px] md:px-[80px]">
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-16 items-start">
                            <p className="md:col-span-3 font-display text-[34px] md:text-[40px] font-light italic leading-[1.2] text-background">
                              {editorialQuotes[category]}
                            </p>

                            <p className="md:col-span-2 max-w-[340px] whitespace-pre-line font-body text-[14px] font-normal leading-[2] text-[#aaa]">
                              {editorialDescriptions[category]}
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {bannerProduct !== undefined ? <BannerSkeleton /> : null}
                    </div>
                  );
                })
              : productChunks.map((chunk, chunkIndex) => {
                  const [firstProduct, secondProduct, thirdProduct, bannerProduct] = chunk;

                  return (
                    <div key={`${category}-chunk-${chunkIndex}`} className="space-y-[80px]">
                      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-stretch md:gap-6">
                        {firstProduct ? (
                          <div className="h-full">
                            <CategoryProductCard product={firstProduct} variant="large" />
                          </div>
                        ) : null}

                        {secondProduct || thirdProduct ? (
                          <div className={`grid gap-6 md:h-full ${secondProduct && thirdProduct ? "md:grid-rows-2" : ""}`}>
                            {secondProduct ? (
                              <div className="h-full">
                                <CategoryProductCard product={secondProduct} variant="standard" />
                              </div>
                            ) : null}

                            {thirdProduct ? (
                              <div className="h-full">
                                <CategoryProductCard product={thirdProduct} variant="standard" />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      {chunkIndex === 0 ? (
                        <div className="bg-foreground px-8 py-[100px] md:px-[80px]">
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-16 items-start">
                            <p className="md:col-span-3 font-display text-[34px] md:text-[40px] font-light italic leading-[1.2] text-background">
                              {editorialQuotes[category]}
                            </p>

                            <p className="md:col-span-2 max-w-[340px] whitespace-pre-line font-body text-[14px] font-normal leading-[2] text-[#aaa]">
                              {editorialDescriptions[category]}
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {bannerProduct ? <CategoryProductCard product={bannerProduct} variant="banner" /> : null}
                    </div>
                  );
                })}

            {!loading && sortedProducts.length === 0 ? (
              <div className="border border-[#d4ccc2] px-6 py-8 text-center">
                <p className="font-body text-[12px] text-[#888888]">No products available in this category right now.</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CategoryPage;

