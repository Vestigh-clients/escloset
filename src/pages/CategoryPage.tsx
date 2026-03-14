import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { categoryImages, productImages } from "@/data/images";
import {
  categoryLabels,
  formatPrice,
  getProductsByCategory,
  type Category,
  type Product,
} from "@/data/products";

const validCategories: Category[] = ["hair-care", "mens-fashion", "womens-fashion", "bags", "shoes"];

type SortOption = "featured" | "price-low-high" | "price-high-low" | "newest";

const editorialQuotes: Record<Category, string> = {
  "hair-care": "Your hair deserves a ritual, not a routine.",
  "mens-fashion": "Built for the man who notices the details.",
  "womens-fashion": "Worn with intention. Made to last.",
  "bags": "The right bag changes everything.",
  "shoes": "Stand in something worth remembering.",
};

const editorialDescriptions: Record<Category, string> = {
  "hair-care": "Formulas selected for strength, softness, and long-term hair health.\nLuxury begins with consistency.",
  "mens-fashion": "Tailored essentials shaped by clean lines and durable construction.\nA focused wardrobe for everyday confidence.",
  "womens-fashion": "Refined silhouettes designed to move between day and evening.\nQuiet confidence in every detail.",
  "bags": "Structured and soft forms curated for function and statement.\nCarry pieces that complete the look.",
  "shoes": "Footwear built for comfort, finish, and timeless wear.\nEvery step grounded in quality.",
};

const heroDescriptions: Record<Category, string> = {
  "hair-care": "A focused edit of treatments and cleansers for healthy, luminous hair.",
  "mens-fashion": "Modern essentials for a precise and elevated wardrobe.",
  "womens-fashion": "Intentional pieces created for everyday elegance.",
  "bags": "Distinctive bags designed for utility and style in equal measure.",
  "shoes": "Curated footwear designed for comfort, balance, and impact.",
};

interface CategoryProductCardProps {
  product: Product;
  variant: "large" | "standard" | "banner";
}

const CategoryProductCard = ({ product, variant }: CategoryProductCardProps) => {
  const image = productImages[product.id];

  if (variant === "banner") {
    return (
      <article className="group border-t border-[#d4ccc2] pt-8">
        <div className="grid grid-cols-1 md:grid-cols-5">
          <div className="relative overflow-hidden md:col-span-3">
            <Link to={`/product/${product.id}`} className="block">
              <img
                src={image}
                alt={product.name}
                className="h-[320px] md:h-[420px] w-full object-cover transition-transform ease-out [transition-duration:400ms] group-hover:scale-[1.04]"
                loading="lazy"
              />
            </Link>
          </div>

          <div className="md:col-span-2 flex flex-col justify-center border-[#d4ccc2] px-6 py-8 transition-colors duration-300 ease-in-out md:border-l md:px-8 group-hover:bg-[#1A1A1A]">
            <Link to={`/product/${product.id}`}>
              <h3 className="font-display text-[16px] font-normal italic leading-snug text-foreground transition-colors duration-300 ease-in-out group-hover:text-[#F5F0E8]">
                {product.name}
              </h3>
            </Link>
            <p className="mt-2 font-body text-[13px] font-normal text-[#888] transition-colors duration-300 ease-in-out group-hover:text-[#F5F0E8]">
              {formatPrice(product.price)}
            </p>

            <p className="mt-4 font-body text-[13px] font-light leading-[1.8] text-[#666666] transition-colors duration-300 ease-in-out group-hover:text-[#F5F0E8]">
              {product.description}
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
        <Link to={`/product/${product.id}`} className="block h-full">
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform ease-out [transition-duration:400ms] group-hover:scale-[1.04]"
            loading="lazy"
          />
        </Link>

      </div>

      <div className="mt-[14px] text-left">
        <Link to={`/product/${product.id}`}>
          <h3 className="font-display text-[16px] font-normal italic leading-snug text-foreground">{product.name}</h3>
        </Link>
        <p className="mt-1 font-body text-[13px] font-normal text-[#888]">{formatPrice(product.price)}</p>
      </div>
    </article>
  );
};

const CategoryPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const category = slug as Category;
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const isValidCategory = validCategories.includes(category);
  const categoryProducts = useMemo(
    () => (isValidCategory ? getProductsByCategory(category) : []),
    [category, isValidCategory],
  );

  const sortedProducts = useMemo(() => {
    const indexed = categoryProducts.map((product, index) => ({ product, index }));

    switch (sortBy) {
      case "price-low-high":
        return [...indexed].sort((a, b) => a.product.price - b.product.price).map((entry) => entry.product);
      case "price-high-low":
        return [...indexed].sort((a, b) => b.product.price - a.product.price).map((entry) => entry.product);
      case "newest":
        return [...indexed].sort((a, b) => b.index - a.index).map((entry) => entry.product);
      case "featured":
      default:
        return [...indexed]
          .sort((a, b) => {
            const featuredDiff = Number(Boolean(b.product.isFeatured)) - Number(Boolean(a.product.isFeatured));
            return featuredDiff !== 0 ? featuredDiff : a.index - b.index;
          })
          .map((entry) => entry.product);
    }
  }, [categoryProducts, sortBy]);

  const productChunks = useMemo(() => {
    const chunks: Product[][] = [];
    for (let index = 0; index < sortedProducts.length; index += 4) {
      chunks.push(sortedProducts.slice(index, index + 4));
    }
    return chunks;
  }, [sortedProducts]);

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

  return (
    <div className="bg-[#F5F0E8] text-foreground">
      {/* Hero */}
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

        {/* Intro Row */}
        <section className="border-b border-[#d4ccc2] pb-8">
          <div className="container mx-auto px-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-body text-[11px] font-light text-[#888888]">Showing {sortedProducts.length} products</p>

            <div className="relative inline-flex items-center gap-2 self-start sm:self-auto">
              <span className="font-body text-[11px] font-light text-[#888888]">Sort by:</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
                className="appearance-none bg-transparent border-none p-0 pr-4 font-body text-[11px] font-light text-foreground focus:outline-none"
                aria-label="Sort products"
              >
                <option value="featured">Featured</option>
                <option value="price-low-high">Price Low-High</option>
                <option value="price-high-low">Price High-Low</option>
                <option value="newest">Newest</option>
              </select>
              <span className="pointer-events-none absolute right-0 font-body text-[11px] text-[#888888]">▾</span>
            </div>
          </div>
        </section>

        {/* Products */}
        <section className="container mx-auto px-4 pb-[80px]">
          <div className="space-y-[80px]">
            {productChunks.map((chunk, chunkIndex) => {
              const [firstProduct, secondProduct, thirdProduct, bannerProduct] = chunk;

              return (
                <div key={`${category}-chunk-${chunkIndex}`} className="space-y-[80px]">
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-stretch md:gap-6">
                    {firstProduct && (
                      <div className="h-full">
                        <CategoryProductCard product={firstProduct} variant="large" />
                      </div>
                    )}

                    {(secondProduct || thirdProduct) && (
                      <div className={`grid gap-6 md:h-full ${secondProduct && thirdProduct ? "md:grid-rows-2" : ""}`}>
                        {secondProduct && (
                          <div className="h-full">
                            <CategoryProductCard product={secondProduct} variant="standard" />
                          </div>
                        )}

                        {thirdProduct && (
                          <div className="h-full">
                            <CategoryProductCard product={thirdProduct} variant="standard" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {chunkIndex === 0 && (
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
                  )}

                  {bannerProduct && <CategoryProductCard product={bannerProduct} variant="banner" />}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CategoryPage;
