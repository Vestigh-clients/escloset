import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import StorefrontProductCard from "@/components/products/StorefrontProductCard";
import { useStorefrontConfig } from "@/contexts/StorefrontConfigContext";
import { getAllProducts, getTopSellingProductIds } from "@/services/productService";
import type { StorefrontCategory } from "@/services/storefrontCategoryService";
import { type Product } from "@/types/product";

const FUNDAMENTALS = [
  {
    title: "Curated Quality",
    description: "Every piece is selected for design quality, fit consistency, and lasting wear.",
  },
  {
    title: "Shipping & Delivery",
    description: "Reliable shipping with delivery updates so customers always know when to expect their order.",
  },
  {
    title: "Secure Checkout",
    description: "Fast and protected checkout flow designed for confidence at every step.",
  },
  {
    title: "Customer Support",
    description: "Responsive support for sizing, orders, and post-purchase assistance.",
  },
];

interface IndexProps {
  initialNewArrivals?: Product[];
  initialBestSellers?: Product[];
  initialCategories?: StorefrontCategory[];
}

const Index = ({ initialNewArrivals = [], initialBestSellers = [], initialCategories = [] }: IndexProps) => {
  const { storefrontCategories } = useStorefrontConfig();
  const [newArrivals, setNewArrivals] = useState<Product[]>(initialNewArrivals);
  const [bestSellers, setBestSellers] = useState<Product[]>(initialBestSellers);

  useEffect(() => {
    if (initialNewArrivals.length > 0 || initialBestSellers.length > 0) {
      return;
    }

    let isMounted = true;

    const loadHomepageProducts = async () => {
      const [allProductsResult, topSellingIdsResult] = await Promise.allSettled([
        getAllProducts(),
        getTopSellingProductIds(4),
      ]);

      if (!isMounted) return;

      const allProducts =
        allProductsResult.status === "fulfilled" && Array.isArray(allProductsResult.value) ? allProductsResult.value : [];
      const topSellingIds =
        topSellingIdsResult.status === "fulfilled" && Array.isArray(topSellingIdsResult.value)
          ? topSellingIdsResult.value
          : [];

      const productById = new Map(allProducts.map((product) => [product.id, product]));
      const rankedBestSellers = topSellingIds
        .map((productId) => productById.get(productId))
        .filter((product): product is Product => Boolean(product));

      setNewArrivals(allProducts.slice(0, 4));
      setBestSellers((rankedBestSellers.length > 0 ? rankedBestSellers : allProducts).slice(0, 4));
    };

    void loadHomepageProducts();

    return () => {
      isMounted = false;
    };
  }, [initialBestSellers.length, initialNewArrivals.length]);

  const activeCategories = initialCategories.length > 0 ? initialCategories : storefrontCategories;

  const categoryTiles = useMemo(
    () =>
      activeCategories.map((category) => ({
        key: category.id || category.slug,
        title: category.name,
        to: `/shop?category=${encodeURIComponent(category.slug)}`,
        imageAlt: `${category.name} collection`,
        imageUrl: category.imageUrl || "/placeholder.svg",
      })),
    [activeCategories],
  );

  return (
    <div className="bg-[#F9F9F9] font-notoSerif text-[#1A1C1C] selection:bg-[#e9ecef] selection:text-[#3e001f]">
      <main>
        <section className="relative flex h-[921px] items-center overflow-hidden bg-[#F3F3F4]">
          <div className="absolute inset-0 overflow-hidden">
            <img
              src="/assets/homepage-hero.jpg"
              alt="Stylish couple in coordinated modern fashion"
              className="h-full w-full object-cover object-[center_20%]"
            />
          </div>

          <div className="absolute inset-0 bg-gradient-to-r from-[#F9F9F9]/88 via-[#F9F9F9]/42 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#F9F9F9]/64 via-transparent to-transparent" />

          <div className="relative z-10 mx-auto w-full max-w-[1536px] self-end px-4 pb-6 sm:px-8 sm:pb-10 md:pb-14">
            <div className="max-w-lg rounded-2xl border border-[#e3bdc7] bg-[rgba(249,249,249,0.86)] p-5 shadow-[0_20px_45px_rgba(26,28,28,0.08)] backdrop-blur-[12px] sm:max-w-xl sm:p-6 md:ml-4">
              <h1 className="font-notoSerif text-[2.7rem] font-bold leading-[1.05] text-[#1A1C1C] sm:text-[3.5rem]">
                Your Wardrobe,
                <br />
                <span className="italic text-[#D81B60]">Our Closet</span>
              </h1>

              {/* <p className="mt-6 max-w-[640px] text-[1.15rem] leading-relaxed text-[#5E5E5E]">
                Curated high-end Ghanaian fashion, redefined for the contemporary aesthetic. Luxury accessible to your
                everyday.
              </p> */}

              <Link
                to="/shop"
                className="mt-8 inline-flex bg-gradient-to-r from-[#B0004A] to-[#D81B60] px-10 py-4 font-manrope text-sm font-semibold uppercase tracking-[0.18em] text-white transition-all duration-300 hover:-translate-y-1 hover:from-[#B0004A] hover:to-[#B0004A]"
              >
                Shop Now
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-[#FFFFFF] py-6 md:py-8">
          <div className="mx-auto max-w-[1536px] px-4 sm:px-8">
            <div className="mb-6 md:mb-7">
              <span className="font-manrope text-xs font-semibold uppercase tracking-[0.18em] text-[#B0004A]">
                Why E&S Closet
              </span>
              <h2 className="mt-2 font-notoSerif text-3xl font-bold text-[#1A1C1C] md:text-4xl lg:text-5xl">Built for a Better Store Experience</h2>
            </div>

            <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {FUNDAMENTALS.map((item) => (
                <article key={item.title} className="border border-[#e3bdc7] bg-[#F9F9F9] p-4 sm:p-5 md:p-6">
                  <h3 className="font-notoSerif text-base font-bold leading-tight text-[#1A1C1C] sm:text-lg md:text-xl">{item.title}</h3>
                  <p className="mt-2 font-manrope text-[11px] leading-relaxed text-[#5E5E5E] sm:text-xs md:mt-3 md:text-sm">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {categoryTiles.length > 0 ? (
          <section className="mx-auto max-w-[1536px] px-4 py-6 sm:px-8 md:py-8">
            <div className="mb-8 flex items-end justify-between gap-4 md:mb-10">
              <div>
                <span className="font-manrope text-xs font-semibold uppercase tracking-[0.18em] text-[#B0004A]">
                  Discover Collections
                </span>
                <h2 className="mt-2 font-notoSerif text-3xl font-bold text-[#1A1C1C] md:text-4xl lg:text-5xl">Shop by Category</h2>
              </div>
              <Link
                to="/shop"
                className="font-manrope text-sm font-semibold text-[#B0004A] underline decoration-2 underline-offset-4 transition-colors hover:text-[#D81B60]"
              >
                View All Categories
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 md:hidden">
              {categoryTiles.map((tile) => (
                <Link key={`${tile.key}-mobile`} to={tile.to} className="group relative block cursor-pointer overflow-hidden">
                  <img
                    src={tile.imageUrl}
                    alt={tile.imageAlt}
                    className="aspect-[3/4] h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/10 transition-colors duration-500 group-hover:bg-[#D81B60]/20" />
                  <div className="absolute bottom-6 left-5">
                    <h3 className="font-notoSerif text-2xl font-bold text-white">{tile.title}</h3>
                    <div className="mt-2 h-1 w-12 bg-[#D81B60] transition-all duration-500 group-hover:w-full" />
                  </div>
                </Link>
              ))}
            </div>

            <div
              className="hidden gap-5 md:grid"
              style={{
                gridTemplateColumns:
                  categoryTiles.length > 0 ? `repeat(${categoryTiles.length}, minmax(0, 1fr))` : undefined,
              }}
            >
              {categoryTiles.map((tile) => (
                <Link key={`${tile.key}-desktop`} to={tile.to} className="group relative block cursor-pointer overflow-hidden">
                  <img
                    src={tile.imageUrl}
                    alt={tile.imageAlt}
                    className="aspect-[3/4] h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/10 transition-colors duration-500 group-hover:bg-[#D81B60]/20" />
                  <div className="absolute bottom-8 left-8">
                    <h3 className="font-notoSerif text-3xl font-bold text-white">{tile.title}</h3>
                    <div className="mt-2 h-1 w-12 bg-[#D81B60] transition-all duration-500 group-hover:w-full" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="bg-[#FFFFFF] py-6 md:py-8">
          <div className="mx-auto max-w-[1536px] px-4 sm:px-8">
            <div className="mb-8 flex items-end justify-between gap-4 md:mb-10">
              <div>
                <span className="font-manrope text-xs font-semibold uppercase tracking-[0.18em] text-[#B0004A]">
                  Curated Collection
                </span>
                <h2 className="mt-2 font-notoSerif text-3xl font-bold text-[#1A1C1C] md:text-4xl lg:text-5xl">New Arrivals</h2>
              </div>
              <Link
                to="/shop"
                className="font-manrope text-sm font-semibold text-[#B0004A] underline decoration-2 underline-offset-4 transition-colors hover:text-[#D81B60]"
              >
                View All Collection
              </Link>
            </div>

            {newArrivals.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
                {newArrivals.map((product) => (
                  <StorefrontProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="border border-[#e3bdc7] bg-[#fff] px-6 py-10 text-center">
                <p className="font-manrope text-sm text-[#5E5E5E]">No new arrivals available yet.</p>
              </div>
            )}
          </div>
        </section>

        <section className="bg-[#F9F9F9] py-6 md:py-8">
          <div className="mx-auto max-w-[1536px] px-4 sm:px-8">
            <div className="mb-8 flex items-end justify-between gap-4 md:mb-10">
              <div>
                <span className="font-manrope text-xs font-semibold uppercase tracking-[0.18em] text-[#B0004A]">
                  Most Loved
                </span>
                <h2 className="mt-2 font-notoSerif text-3xl font-bold text-[#1A1C1C] md:text-4xl lg:text-5xl">Best Sellers</h2>
              </div>
              <Link
                to="/shop"
                className="font-manrope text-sm font-semibold text-[#B0004A] underline decoration-2 underline-offset-4 transition-colors hover:text-[#D81B60]"
              >
                Shop Best Sellers
              </Link>
            </div>

            {bestSellers.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
                {bestSellers.map((product) => (
                  <StorefrontProductCard key={product.id} product={product} actionLabel="View Product" />
                ))}
              </div>
            ) : (
              <div className="border border-[#e3bdc7] bg-[#fff] px-6 py-10 text-center">
                <p className="font-manrope text-sm text-[#5E5E5E]">No best sellers available yet.</p>
              </div>
            )}
          </div>
        </section>

        <section className="bg-[#F9F9F9] py-6 md:py-8">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-8">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
              <div className="relative">
                <div className="absolute -left-10 -top-10 h-64 w-64 bg-[#e9ecef]/80 blur-3xl" />
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBEpLhqUZzVZo7P9fGAgmXdUNjlST_StPhgD8GA_wSTggUVM-SQjKIhFwS2gAMIuNLc7IqhqLAXXkTX-ia8kUSOML4NL1bpHEN5L9v13ffnixOfizMRKJMz6TWblOtZa6A-z-ISdP5tJqRmYhEiRJFDgxo5xNGN1gH2OmSSy7bNSCsoHPnpV-ZGOL-I6mWsF1NfpFYy5GU7k2aoRW28Ull-M5vxvN5lfMkpvI8-G_IBUoYKNeiZFKabJzh0d3eTfUpOR3oSAcHj6Lk"
                  alt="Luxury Showroom"
                  className="relative z-10 w-full object-cover grayscale transition-all duration-1000 hover:grayscale-0"
                />
              </div>

              <div>
                <h2 className="font-notoSerif text-3xl font-bold leading-tight text-[#1A1C1C] md:text-4xl lg:text-5xl">
                  Elevating Ghanaian Fashion to New Heights
                </h2>

                <div className="mt-6 space-y-4 text-base leading-relaxed text-[#5E5E5E] md:text-lg">
                  <p>
                    E&S Closet was created with the idea that great style should feel both beautiful and attainable. We believe fashion should inspire confidence, reflect individuality, and make every woman feel her best without compromise.
                  </p>
                  <p>
                   Based in Ghana, our brand is built around carefully selected styles that bring together modern trends, elegance, and effortless sophistication. Each collection is chosen for women who appreciate fashion that feels refined, confident, and easy to wear.
                  </p>
                  <p>
                    At E&S Closet, we are more than just a store. We are a destination for women who want to look polished, feel empowered, and enjoy fashion that fits both their taste and their lifestyle.
                  </p>
                  <div className="flex items-center gap-4 pt-4">
                    <span className="h-[2px] w-12 bg-[#D81B60]" />
                    <span className="font-manrope text-sm font-semibold uppercase tracking-[0.18em] text-[#B0004A]">
                      Established 2026
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

    </div>
  );
};

export default Index;
