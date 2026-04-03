import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StorefrontProductCard from "@/components/products/StorefrontProductCard";
import { useStorefrontConfig } from "@/contexts/StorefrontConfigContext";
import { getAllProducts, getFeaturedProducts } from "@/services/productService";
import { type Product } from "@/types/product";

const NEW_ARRIVALS = [
  {
    name: "Champagne Silk Slip",
    category: "Women's Premium",
    price: "GH\u20B5 450.00",
    imageAlt: "Silk Slip Dress",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD5uw-EcjyELejFHeTJ-DD4v5VS1-NXY359QVggXw7TBB5Z19y0hn8CrhDFlO64FzGUT3rH1WcyZmWOfa84zNDuOiXaW6egeILtgslvKewTASQQaHhY4IVk6QZqiHCCo04N8rbuiW7RuZm7Z3d0h5nx0GZ-dbiGbMPnf8CFpGugA02qFRa7GteRKFW2w4gLZRrNzLXwi4UZS9Yyde41pmqmO0VSJ58z8t6SxmFaEO4M7KWgTuIbqNQT01zTKQ-YNe5c9SCCYDvM-qQ",
  },
  {
    name: "Linen Tailored Shirt",
    category: "Men's Essentials",
    price: "GH\u20B5 320.00",
    imageAlt: "Tailored Linen Shirt",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCO8_j4tUGr0KIjJ-lnZ2Xc8GHHkkob1ewxqu2GL_MOROvSN4cUI0nEN9Z0LkdJZ07jTGj6BFwJkzLc16-zhR8MS8ens8ienYW9NVOZHPmI9_64jpt_SkWNhBWfZ1F7IW6R0kudkWl6UldLGlJ2DK8SwUThacekwpwkSA5AJxVQX1jG4r9jSgTjlNK_AdCsvf3rlUsxDH54zWmHomhc80qB8lwGFMFMmTEBuKGHki-IxblJM9ZJ-5tPKMEgBhFbKbuovyac8n7K9js",
  },
  {
    name: "Petite Crossbody Bag",
    category: "Accessories",
    price: "GH\u20B5 580.00",
    imageAlt: "Leather Crossbody Bag",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCl-hCdN7jOByn89zinmeeGvgQuG4qkZ84yPd3Vo9iC7IdFXCoTqB1hONyjmkLmou2cSuGSq5akSLaoZPwwVmZKghprJz40lKa4F3G7e7PF4fKPUQZZmABY_g_TorfNKLjFUW-hqJ679LrKxh-i6B3KtFoTH_BGzkJuoE39C7QqJP6x9KkMG7nOjrjuu32p85tBOKO4xh4XGelVIhzzPCNYbzQvl0xUPTxGsqL8Id3Vaqpm2sPx9ySs-KNUcD2gWriyuI7sCEiK22w",
  },
  {
    name: "Heritage Maxi Dress",
    category: "Women's Collection",
    price: "GH\u20B5 750.00",
    imageAlt: "Patterned Maxi Dress",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD68EweOv7fPJ6aEpfL9-RQxWJq2YwztZtP5nXXeaFfrWMbNBbLKvN7S6sQOZIFsJ07rpBUXzXrQ-EUXiaE-r325KUkXqjknSkiW7UNbSA4Ac3hcrgu3aecnsBbwNULXwvQV8rFcuS2Lci5P_mfJUN_SIAsIKPqlOymhEvS6shzmrf2SPjLQpT4XzgFu5cAqeqdxj58UE27wkMbNSIT5Eq6mXEbv96jBrpMn-3sI7QwB_4lOzImIBjq80NNjIDcIadOVxPERLXJ6r0",
  },
];

const FUNDAMENTALS = [
  {
    title: "Curated Quality",
    description: "Every piece is selected for design quality, fit consistency, and lasting wear.",
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

const Index = () => {
  const { storefrontCategories } = useStorefrontConfig();
  const [bestSellers, setBestSellers] = useState<Product[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadBestSellers = async () => {
      try {
        const featured = await getFeaturedProducts();
        if (!isMounted) return;

        if (featured.length > 0) {
          setBestSellers(featured.slice(0, 4));
          return;
        }

        const fallbackProducts = await getAllProducts();
        if (!isMounted) return;
        setBestSellers((fallbackProducts ?? []).slice(0, 4));
      } catch {
        if (!isMounted) return;
        setBestSellers([]);
      }
    };

    void loadBestSellers();

    return () => {
      isMounted = false;
    };
  }, []);

  const categoryTiles = useMemo(
    () =>
      storefrontCategories.map((category) => ({
        key: category.id || category.slug,
        title: category.name,
        to: `/shop?category=${encodeURIComponent(category.slug)}`,
        imageAlt: `${category.name} collection`,
        imageUrl: category.imageUrl || "/placeholder.svg",
      })),
    [storefrontCategories],
  );

  return (
    <div className="bg-[#F9F9F9] font-notoSerif text-[#1A1C1C] selection:bg-[#fce4ec] selection:text-[#3e001f]">
      <main>
        <section className="relative flex h-[921px] items-center overflow-hidden bg-[#F3F3F4]">
          <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-2">
            <div className="relative overflow-hidden">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB3f9jYXGfvt1P6Lgk1hbWAdxbZcUmvY80TyZ_aa1CBmBxavQhPcJJEfwq-krnJWkdUrPm2NvB9vD_tAu0VQ7fQQf55UvpF8vrB_3NVgOhSfXko4nyD56yxdnBq2K3O3ECsg784u7DuAchGjhHKHWeGquXRpXP7yRnmEQcowWdvL9IbQMXsC2TO-FEttRIejDjl3lvvCt8sEhA1201Ri4HOrtY8cSDUn_Iv1_5qedhC09dI6UeF7MMorilAj_KCdDZ7-KA9sRJVmpQ"
                alt="Editorial male model in charcoal grey suit"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="relative hidden overflow-hidden md:block">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBGPVas7T5HsblTTLyVgGyZteedwrjIUHqR1_j0xaIBnzcoR2eATLvu6VDWcrbqTZHgMQVMdL93i2eb5VhRbKBUhgl5BoDgn5TXdqeYmQwB3vIpFAM69Tz2O3SzCzvGc8JbZVi40arj1f8YHCE1u8kbrDX2zS4StMxWE12cbwQLnDJtcaG19dLPBaxDzahs57x1azeuwKKPte76Qz9Qjre73q5PyKAUCYxlbf2mIENv4d1UD8qiXIKCEMuZfHybt5c9t8o6dWUrnI4"
                alt="Editorial female model in vibrant pink silk"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="absolute inset-0 bg-gradient-to-r from-[#F9F9F9]/88 via-[#F9F9F9]/42 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#F9F9F9]/64 via-transparent to-transparent" />

          <div className="relative z-10 mx-auto w-full max-w-[1536px] px-4 sm:px-8">
            <div className="max-w-2xl bg-[rgba(249,249,249,0.86)] p-7 shadow-[0_20px_45px_rgba(26,28,28,0.08)] backdrop-blur-[12px] sm:p-10 md:ml-4">
              <h1 className="font-notoSerif text-[2.7rem] font-bold leading-[1.05] text-[#1A1C1C] sm:text-[3.5rem]">
                Your Wardrobe,
                <br />
                <span className="italic text-[#D81B60]">Our Closet</span>
              </h1>

              <p className="mt-6 max-w-[640px] text-[1.15rem] leading-relaxed text-[#5E5E5E]">
                Curated high-end Ghanaian fashion, redefined for the contemporary aesthetic. Luxury accessible to your
                everyday.
              </p>

              <Link
                to="/shop"
                className="mt-8 inline-flex bg-gradient-to-r from-[#B0004A] to-[#D81B60] px-10 py-4 font-manrope text-sm font-semibold uppercase tracking-[0.18em] text-white transition-all duration-300 hover:-translate-y-1 hover:from-[#B0004A] hover:to-[#B0004A]"
              >
                Shop Now
              </Link>
            </div>
          </div>
        </section>

        {categoryTiles.length > 0 ? (
          <section className="mx-auto max-w-[1536px] px-4 py-24 sm:px-8">
            <div className="mb-12 flex items-end justify-between gap-4">
              <div>
                <span className="font-manrope text-xs font-semibold uppercase tracking-[0.18em] text-[#B0004A]">
                  Discover Collections
                </span>
                <h2 className="mt-2 font-notoSerif text-5xl font-bold text-[#1A1C1C]">Shop by Category</h2>
              </div>
              <Link
                to="/shop"
                className="font-manrope text-sm font-semibold text-[#B0004A] underline decoration-2 underline-offset-4 transition-colors hover:text-[#D81B60]"
              >
                View All Categories
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-6 md:hidden">
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
              className="hidden gap-8 md:grid"
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

        <section className="bg-[#FFFFFF] py-24">
          <div className="mx-auto max-w-[1536px] px-4 sm:px-8">
            <div className="mb-12 flex items-end justify-between gap-4">
              <div>
                <span className="font-manrope text-xs font-semibold uppercase tracking-[0.18em] text-[#B0004A]">
                  Curated Collection
                </span>
                <h2 className="mt-2 font-notoSerif text-5xl font-bold text-[#1A1C1C]">New Arrivals</h2>
              </div>
              <Link
                to="/shop"
                className="font-manrope text-sm font-semibold text-[#B0004A] underline decoration-2 underline-offset-4 transition-colors hover:text-[#D81B60]"
              >
                View All Collection
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
              {NEW_ARRIVALS.map((product) => (
                <article key={product.name} className="group">
                  <div className="relative mb-4 overflow-hidden bg-[#F3F3F4]">
                    <img
                      src={product.imageUrl}
                      alt={product.imageAlt}
                      className="aspect-[4/5] h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <Link
                      to="/shop"
                      className="absolute bottom-4 left-4 right-4 flex translate-y-12 items-center justify-center gap-2 bg-[#D81B60] py-3 font-manrope text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all duration-300 group-hover:translate-y-0 group-hover:-translate-y-1 group-hover:bg-[#B0004A]"
                    >
                      <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                      Add to Cart
                    </Link>
                  </div>

                  <h4 className="font-notoSerif text-lg font-bold text-[#1A1C1C] transition-colors group-hover:text-[#D81B60]">
                    {product.name}
                  </h4>
                  <p className="mt-1 font-manrope text-xs uppercase tracking-[0.1em] text-[#5E5E5E]">{product.category}</p>
                  <p className="mt-1 font-manrope text-xs font-semibold uppercase tracking-[0.08em] text-[#B0004A]">
                    {product.price}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#F9F9F9] py-24">
          <div className="mx-auto max-w-[1536px] px-4 sm:px-8">
            <div className="mb-12 flex items-end justify-between gap-4">
              <div>
                <span className="font-manrope text-xs font-semibold uppercase tracking-[0.18em] text-[#B0004A]">
                  Most Loved
                </span>
                <h2 className="mt-2 font-notoSerif text-5xl font-bold text-[#1A1C1C]">Best Sellers</h2>
              </div>
              <Link
                to="/shop"
                className="font-manrope text-sm font-semibold text-[#B0004A] underline decoration-2 underline-offset-4 transition-colors hover:text-[#D81B60]"
              >
                Shop Best Sellers
              </Link>
            </div>

            {bestSellers.length > 0 ? (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
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

        <section className="bg-[#FFFFFF] py-24">
          <div className="mx-auto max-w-[1536px] px-4 sm:px-8">
            <div className="mb-10">
              <span className="font-manrope text-xs font-semibold uppercase tracking-[0.18em] text-[#B0004A]">
                Why E&S Closet
              </span>
              <h2 className="mt-2 font-notoSerif text-5xl font-bold text-[#1A1C1C]">Built for a Better Store Experience</h2>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {FUNDAMENTALS.map((item) => (
                <article key={item.title} className="border border-[#e3bdc7] bg-[#F9F9F9] p-8">
                  <h3 className="font-notoSerif text-2xl font-bold text-[#1A1C1C]">{item.title}</h3>
                  <p className="mt-4 font-manrope text-sm leading-relaxed text-[#5E5E5E]">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#F9F9F9] py-32">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-8">
            <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2 lg:gap-20">
              <div className="relative">
                <div className="absolute -left-10 -top-10 h-64 w-64 bg-[#fce4ec]/80 blur-3xl" />
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBEpLhqUZzVZo7P9fGAgmXdUNjlST_StPhgD8GA_wSTggUVM-SQjKIhFwS2gAMIuNLc7IqhqLAXXkTX-ia8kUSOML4NL1bpHEN5L9v13ffnixOfizMRKJMz6TWblOtZa6A-z-ISdP5tJqRmYhEiRJFDgxo5xNGN1gH2OmSSy7bNSCsoHPnpV-ZGOL-I6mWsF1NfpFYy5GU7k2aoRW28Ull-M5vxvN5lfMkpvI8-G_IBUoYKNeiZFKabJzh0d3eTfUpOR3oSAcHj6Lk"
                  alt="Luxury Showroom"
                  className="relative z-10 w-full object-cover grayscale transition-all duration-1000 hover:grayscale-0"
                />
              </div>

              <div>
                <h2 className="font-notoSerif text-5xl font-bold leading-tight text-[#1A1C1C]">
                  Elevating Ghanaian Fashion to New Heights
                </h2>

                <div className="mt-8 space-y-6 text-lg leading-relaxed text-[#5E5E5E]">
                  <p>
                    At E&S Closet, we believe that luxury shouldn&apos;t be an unreachable dream. Born in the heart of
                    Ghana, our mission is to redefine the digital atelier experience for the modern African consumer.
                  </p>
                  <p>
                    We meticulously curate high-end, contemporary pieces that blend global trends with local
                    sophistication. Every garment in our closet is a testament to quality craftsmanship and timeless
                    style, brought to you at prices that respect your lifestyle.
                  </p>
                  <div className="flex items-center gap-4 pt-6">
                    <span className="h-[2px] w-12 bg-[#D81B60]" />
                    <span className="font-manrope text-sm font-semibold uppercase tracking-[0.18em] text-[#B0004A]">
                      Established 2024
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <button className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center bg-[rgba(249,249,249,0.8)] text-[#D81B60] backdrop-blur-[20px] md:hidden">
        <span className="material-symbols-outlined">shopping_bag</span>
      </button>
    </div>
  );
};

export default Index;
