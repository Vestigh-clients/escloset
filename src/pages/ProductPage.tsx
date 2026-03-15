import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ShopProductCard from "@/components/ShopProductCard";
import ProductFetchErrorState from "@/components/products/ProductFetchErrorState";
import ProductImagePlaceholder from "@/components/products/ProductImagePlaceholder";
import { useCart } from "@/contexts/CartContext";
import { getCategoryLabel } from "@/lib/categories";
import { formatPrice } from "@/lib/price";
import { getProductBySlug, getRelatedProducts } from "@/services/productService";
import { getPrimaryImage, isInStock, type Product } from "@/types/product";
import { BadgeCheck, Droplets, Package, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";

const benefitIcons = [Droplets, Sparkles, ShieldCheck, BadgeCheck];

const trustItems = [
  { icon: ShieldCheck, label: "Secure Ordering" },
  { icon: Package, label: "Nationwide Delivery" },
  { icon: RefreshCw, label: "Easy Returns" },
];

const RelatedProductSkeleton = () => (
  <div className="flex h-full flex-col">
    <div className="lux-product-shimmer aspect-[4/5] w-full" />
    <div className="mt-3 space-y-2">
      <div className="lux-product-shimmer h-4 w-2/3" />
      <div className="lux-product-shimmer h-3 w-1/3" />
    </div>
  </div>
);

const ProductPageSkeleton = () => {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="lux-product-shimmer h-4 w-28" />
        <div className="lux-product-shimmer h-4 w-64" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 xl:gap-16">
        <div className="space-y-4">
          <div className="lux-product-shimmer h-[75vh] min-h-[520px] w-full" />
          <div className="grid gap-3 grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`product-thumbnail-skeleton-${index}`} className="lux-product-shimmer h-20" />
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          <div className="lux-product-shimmer mb-3 h-3 w-24" />
          <div className="lux-product-shimmer mb-5 h-12 w-3/4" />
          <div className="lux-product-shimmer h-8 w-40" />
          <div className="mt-7 lux-product-shimmer h-11 w-44" />
          <div className="my-6 border-b border-[#d4ccc2]" />
          <div className="space-y-3">
            <div className="lux-product-shimmer h-4 w-full" />
            <div className="lux-product-shimmer h-4 w-[90%]" />
            <div className="lux-product-shimmer h-4 w-[82%]" />
          </div>
          <div className="my-8 grid grid-cols-2 gap-[1px]">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`benefit-skeleton-${index}`} className="lux-product-shimmer h-[108px]" />
            ))}
          </div>
        </div>
      </div>

      <section className="mt-20">
        <div className="lux-product-shimmer h-3 w-32" />
        <div className="mt-3 lux-product-shimmer h-10 w-56" />
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          {Array.from({ length: 3 }).map((_, index) => (
            <RelatedProductSkeleton key={`related-skeleton-${index}`} />
          ))}
        </div>
      </section>
    </div>
  );
};

const ProductPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { addToCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [activeImage, setActiveImage] = useState<string>("");
  const [hasActiveImageError, setHasActiveImageError] = useState(false);
  const [thumbnailErrors, setThumbnailErrors] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!slug) {
          setProduct(null);
          setRelatedProducts([]);
          setError("Product not found.");
          return;
        }

        const data = await getProductBySlug(slug);
        setProduct(data);

        if (data?.categories?.id) {
          const related = await getRelatedProducts(data.categories.id, data.id);
          setRelatedProducts(related ?? []);
        } else {
          setRelatedProducts([]);
        }
      } catch (err) {
        console.error(err);
        setProduct(null);
        setRelatedProducts([]);
        setError("Product not found.");
      } finally {
        setLoading(false);
      }
    };

    void fetchProduct();
  }, [slug]);

  const galleryImages = useMemo(() => {
    if (!product) {
      return [];
    }

    return product.images
      .map((image) => image.url)
      .filter((url): url is string => Boolean(url && url.trim()))
      .slice(0, 4);
  }, [product]);

  useEffect(() => {
    setActiveImage(galleryImages[0] ?? "");
    setHasActiveImageError(false);
    setThumbnailErrors({});
  }, [galleryImages, product?.id]);

  const primaryImage = useMemo(() => (product ? getPrimaryImage(product) : ""), [product]);

  const benefitTiles = useMemo(() => {
    if (!product) {
      return [];
    }

    const labels = (product.benefits ?? [])
      .map((benefit) => benefit.label || benefit.description)
      .filter((benefit): benefit is string => Boolean(benefit && benefit.trim()));

    const tiles = [...labels.slice(0, 4)];

    while (tiles.length < 4) {
      tiles.push("Premium Quality");
    }

    return tiles;
  }, [product]);

  const categorySlug = product?.categories?.slug ?? "";
  const categoryLabel = product?.categories?.name || getCategoryLabel(categorySlug);
  const isOutOfStock = !product || !isInStock(product);

  const handleAddToCart = () => {
    if (!product || isOutOfStock) {
      return;
    }

    addToCart({
      product_id: product.id,
      name: product.name,
      slug: product.slug,
      category: categoryLabel,
      price: product.price,
      compare_at_price: product.compare_at_price ?? null,
      image_url: primaryImage,
      image_alt: product.name,
      sku: product.sku ?? null,
      stock_quantity: product.stock_quantity,
    });
  };

  if (loading) {
    return <ProductPageSkeleton />;
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-20">
        <ProductFetchErrorState />
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
          <Link to={`/category/${categorySlug}`} className="transition-colors hover:text-foreground">
            {categoryLabel}
          </Link>
          <span className="text-[#d4ccc2]">/</span>
          <span>{product.name}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 xl:gap-16">
        <div className="space-y-4">
          <div className="overflow-hidden">
            {activeImage && !hasActiveImageError ? (
              <img
                src={activeImage}
                alt={product.name}
                className="h-[75vh] min-h-[520px] w-full object-cover"
                onError={() => setHasActiveImageError(true)}
              />
            ) : (
              <ProductImagePlaceholder className="h-[75vh] min-h-[520px] w-full" />
            )}
          </div>

          {galleryImages.length > 0 ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(3, galleryImages.length)}, minmax(0, 1fr))` }}>
              {galleryImages.map((image, index) => {
                const hasThumbError = thumbnailErrors[image] === true;
                return (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => {
                      setActiveImage(image);
                      setHasActiveImageError(false);
                    }}
                    className={`h-20 overflow-hidden border transition-colors ${
                      activeImage === image ? "border-foreground" : "border-transparent"
                    }`}
                    aria-label={`View image ${index + 1}`}
                  >
                    {!hasThumbError ? (
                      <img
                        src={image}
                        alt={`${product.name} thumbnail ${index + 1}`}
                        className="h-full w-full object-cover"
                        onError={() =>
                          setThumbnailErrors((previous) => ({
                            ...previous,
                            [image]: true,
                          }))
                        }
                      />
                    ) : (
                      <ProductImagePlaceholder className="h-full w-full" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <ProductImagePlaceholder key={`empty-thumb-${index}`} className="h-20 w-full" />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <span className="mb-3 font-body text-[10px] uppercase tracking-[0.2em] text-accent">{categoryLabel}</span>
          <h1 className="mb-5 font-display text-[42px] font-normal leading-[1.1] text-foreground">{product.name}</h1>
          <div className="flex items-end gap-3">
            {product.compare_at_price && product.compare_at_price > product.price ? (
              <p className="font-body text-[16px] font-light text-[#aaaaaa] line-through">{formatPrice(product.compare_at_price)}</p>
            ) : null}
            <p className="font-display text-[28px] font-normal text-foreground">{formatPrice(product.price)}</p>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className="rounded-[2px] border border-[#1A1A1A] bg-[#1A1A1A] px-10 py-[14px] font-body text-[11px] uppercase tracking-[0.18em] text-[#F5F0E8] transition-colors duration-300 hover:bg-[#C4A882] hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:border-[#d4ccc2] disabled:bg-transparent disabled:text-[#888888]"
            >
              {isOutOfStock ? "Out of Stock" : "Add to Cart"}
            </button>
            {!isOutOfStock ? (
              <p className="font-body text-[11px] uppercase tracking-[0.1em] text-[#888888]">{product.stock_quantity} in stock</p>
            ) : null}
          </div>

          <div className="my-6 border-b border-[#d4ccc2]" />

          <p className="font-body text-[14px] font-light leading-[1.8] text-[#666666]">{product.description || product.short_description || ""}</p>

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
                    <span className="font-body text-[11px] font-light uppercase tracking-[0.1em] text-foreground">{benefit}</span>
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
                  <p className="mt-2 font-body text-[10px] font-light uppercase tracking-[0.1em] text-[#888888]">{item.label}</p>
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
