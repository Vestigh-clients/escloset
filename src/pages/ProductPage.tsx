import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  categoryLabels,
  formatPrice,
  getProductById,
  products,
} from "@/data/products";
import { productImages } from "@/data/images";
import ShopProductCard from "@/components/ShopProductCard";
import {
  BadgeCheck,
  Droplets,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const benefitIcons = [Droplets, Sparkles, ShieldCheck, BadgeCheck];

const trustItems = [
  { icon: ShieldCheck, label: "Secure Ordering" },
  { icon: Package, label: "Nationwide Delivery" },
  { icon: RefreshCw, label: "Easy Returns" },
];

const ProductPage = () => {
  const { id } = useParams<{ id: string }>();
  const product = getProductById(id || "");
  const activeCategory = product?.category ?? "hair-care";
  const activeProductId = product?.id ?? "";

  const categoryProducts = useMemo(
    () => products.filter((item) => item.category === activeCategory),
    [activeCategory],
  );

  const galleryImages = useMemo(() => {
    if (!product) {
      return [];
    }

    const primary = productImages[activeProductId];
    const categoryImages = categoryProducts
      .map((item) => productImages[item.id])
      .filter((image): image is string => Boolean(image));

    const uniqueImages = [primary, ...categoryImages.filter((image) => image !== primary)].filter(
      (image, index, array) => array.indexOf(image) === index,
    );

    return uniqueImages.slice(0, 4);
  }, [activeProductId, categoryProducts, product]);

  const [activeImage, setActiveImage] = useState<string>(galleryImages[0] ?? "");

  useEffect(() => {
    setActiveImage(galleryImages[0] ?? "");
  }, [galleryImages]);

  const benefitTiles = useMemo(() => {
    if (!product) {
      return [];
    }

    const tiles = [...product.benefits.slice(0, 4)];

    while (tiles.length < 4) {
      tiles.push("Premium Quality");
    }

    return tiles;
  }, [product]);

  const relatedProducts = useMemo(() => {
    if (!product) {
      return [];
    }

    const sameCategory = categoryProducts.filter((item) => item.id !== product.id);

    if (sameCategory.length >= 3) {
      return sameCategory.slice(0, 3);
    }

    return [...sameCategory, ...categoryProducts.filter((item) => item.id === product.id)].slice(0, 3);
  }, [categoryProducts, product]);

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-bold mb-4">Product Not Found</h1>
        <Link to="/shop" className="font-body text-accent hover:underline">
          {"\u2190 Back to Shop"}
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Link
          to="/shop"
          className="font-body text-[11px] uppercase tracking-[0.1em] text-[#888888] transition-colors hover:text-foreground"
        >
          {"\u2190 Back to Shop"}
        </Link>

        <div className="flex flex-wrap items-center gap-2 font-body text-[11px] font-light text-[#888888]">
          <Link to="/" className="transition-colors hover:text-foreground">
            Home
          </Link>
          <span className="text-[#d4ccc2]">/</span>
          <Link to="/shop" className="transition-colors hover:text-foreground">
            Shop
          </Link>
          <span className="text-[#d4ccc2]">/</span>
          <Link to={`/category/${product.category}`} className="transition-colors hover:text-foreground">
            {categoryLabels[product.category]}
          </Link>
          <span className="text-[#d4ccc2]">/</span>
          <span>{product.name}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 xl:gap-16">
        {/* Image Section */}
        <div className="space-y-4">
          <div className="overflow-hidden">
            <img src={activeImage} alt={product.name} className="h-[75vh] min-h-[520px] w-full object-cover" />
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(3, galleryImages.length)}, minmax(0, 1fr))` }}>
            {galleryImages.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => setActiveImage(image)}
                className={`h-20 overflow-hidden border transition-colors ${
                  activeImage === image ? "border-foreground" : "border-transparent"
                }`}
                aria-label={`View image ${index + 1}`}
              >
                <img src={image} alt={`${product.name} thumbnail ${index + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Product Info */}
        <div className="flex flex-col">
          <span className="mb-3 font-body text-[10px] uppercase tracking-[0.2em] text-accent">
            {categoryLabels[product.category]}
          </span>
          <h1 className="mb-5 font-display text-[42px] font-normal leading-[1.1] text-foreground">
            {product.name}
          </h1>
          <p className="font-display text-[28px] font-normal text-foreground">{formatPrice(product.price)}</p>

          <div className="my-6 border-b border-[#d4ccc2]" />

          <p className="font-body text-[14px] font-light leading-[1.8] text-[#666666]">{product.description}</p>

          <div className="my-8 border-y border-[#d4ccc2] py-6">
            <div className="grid grid-cols-2">
              {benefitTiles.map((benefit, index) => {
                const Icon = benefitIcons[index % benefitIcons.length];

                return (
                  <div
                    key={`${benefit}-${index}`}
                    className={`flex min-h-[108px] flex-col items-center justify-center px-3 text-center ${
                      index % 2 === 0 ? "border-r border-[#d4ccc2]" : ""
                    } ${index < 2 ? "border-b border-[#d4ccc2]" : ""}`}
                  >
                    <Icon size={20} className="mb-3 text-foreground" />
                    <span className="font-body text-[11px] font-light uppercase tracking-[0.1em] text-foreground">
                      {benefit}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="my-7 border-b border-[#d4ccc2]" />

          <div className="grid grid-cols-3 gap-6 text-center">
            {trustItems.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.label}>
                  <Icon size={18} className="mx-auto text-accent" />
                  <p className="mt-2 font-body text-[10px] font-light uppercase tracking-[0.1em] text-[#888888]">
                    {item.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <section className="mt-20">
        <p className="font-body text-[10px] font-light uppercase tracking-[0.2em] text-accent">Related Products</p>
        <h2 className="mt-3 font-display text-[28px] font-light italic text-foreground">You May Also Like</h2>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          {relatedProducts.map((item) => (
            <ShopProductCard key={item.id} product={item} size="regular" />
          ))}
        </div>
      </section>
    </div>
  );
};

export default ProductPage;
