import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { Link, useParams } from "react-router-dom";
import StorefrontProductCard from "@/components/products/StorefrontProductCard";
import TryOnModal from "@/components/TryOnModal";
import ProductFetchErrorState from "@/components/products/ProductFetchErrorState";
import ProductImagePlaceholder from "@/components/products/ProductImagePlaceholder";
import { storeConfig } from "@/config/store.config";
import { useCart } from "@/contexts/CartContext";
import { useThemeConfig } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryLabel } from "@/lib/categories";
import { formatPrice } from "@/lib/price";
import { shouldShowPriceVariesByVariantNote } from "@/lib/productPricing";
import { getFeaturedProducts, getRelatedProducts } from "@/services/productService";
import {
  getStockQuantity,
  getPrimaryImage,
  isInStock,
  type Product,
  type ProductOptionType,
  type ProductOptionValue,
  type ProductVariant,
} from "@/types/product";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";

const benefitIcons = [Droplets, Sparkles, ShieldCheck, BadgeCheck];

const trustItems = [
  { icon: ShieldCheck, label: "Secure Ordering" },
  { icon: Package, label: "Nationwide Delivery" },
  { icon: RefreshCw, label: "Easy Returns" },
];

const TRYON_CATEGORY_KEYWORDS = ["mens", "womens", "men", "women", "bag", "shoe"];

const RelatedProductSkeleton = () => (
  <div className="flex h-full flex-col">
    <div className="lux-product-shimmer aspect-[4/5] w-full" />
    <div className="mt-3 space-y-2">
      <div className="lux-product-shimmer h-4 w-2/3" />
      <div className="lux-product-shimmer h-3 w-1/3" />
    </div>
  </div>
);

const clothingSizeGuideRows = [
  { size: "XS", chest: "84-88", waist: "68-72", hips: "88-92" },
  { size: "S", chest: "89-94", waist: "73-78", hips: "93-98" },
  { size: "M", chest: "95-102", waist: "79-86", hips: "99-106" },
  { size: "L", chest: "103-110", waist: "87-94", hips: "107-114" },
  { size: "XL", chest: "111-118", waist: "95-102", hips: "115-122" },
  { size: "XXL", chest: "119-126", waist: "103-110", hips: "123-130" },
];

const shoeSizeGuideRows = [
  { uk: "3", eu: "36", us: "5", foot: "22.5" },
  { uk: "4", eu: "37", us: "6", foot: "23.2" },
  { uk: "5", eu: "38", us: "7", foot: "24.0" },
  { uk: "6", eu: "39", us: "8", foot: "24.7" },
  { uk: "7", eu: "41", us: "9", foot: "25.5" },
  { uk: "8", eu: "42", us: "10", foot: "26.3" },
  { uk: "9", eu: "43", us: "11", foot: "27.0" },
  { uk: "10", eu: "44", us: "12", foot: "27.8" },
];

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
          <div className="my-6 border-b border-[var(--color-border)]" />
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

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toString = (value: unknown, fallback = ""): string => {
  return typeof value === "string" ? value : fallback;
};

const toBoolean = (value: unknown): boolean => value === true;

const mapProductRecord = (value: Record<string, unknown>): Product => {
  const categoryCandidate = Array.isArray(value.categories) ? value.categories[0] : value.categories;
  const categoryRecord = categoryCandidate && typeof categoryCandidate === "object" ? (categoryCandidate as Record<string, unknown>) : {};
  const imageCandidates = Array.isArray(value.images) ? value.images : [];
  const benefitCandidates = Array.isArray(value.benefits) ? value.benefits : [];

  return {
    id: toString(value.id),
    name: toString(value.name),
    slug: toString(value.slug),
    description: toString(value.description, "") || undefined,
    short_description: toString(value.short_description, "") || undefined,
    price: toNumber(value.price),
    compare_at_price:
      value.compare_at_price === null || value.compare_at_price === undefined ? undefined : toNumber(value.compare_at_price),
    stock_quantity: Math.max(0, Math.trunc(toNumber(value.stock_quantity))),
    total_stock_quantity:
      value.total_stock_quantity === null || value.total_stock_quantity === undefined
        ? undefined
        : Math.max(0, Math.trunc(toNumber(value.total_stock_quantity))),
    in_stock: value.in_stock === null || value.in_stock === undefined ? undefined : toBoolean(value.in_stock),
    is_available: toBoolean(value.is_available),
    is_featured: value.is_featured === null || value.is_featured === undefined ? undefined : toBoolean(value.is_featured),
    images: imageCandidates
      .map((entry, index) => {
        if (typeof entry === "string") {
          return {
            url: entry,
            alt_text: "",
            is_primary: index === 0,
            display_order: index,
          };
        }
        if (!entry || typeof entry !== "object") return null;
        const record = entry as Record<string, unknown>;
        const urlCandidate = [record.url, record.image_url, record.src].find((candidate) => typeof candidate === "string");
        if (!urlCandidate || typeof urlCandidate !== "string") return null;
        return {
          url: urlCandidate,
          alt_text: typeof record.alt_text === "string" ? record.alt_text : "",
          is_primary: record.is_primary === true || record.primary === true || index === 0,
          display_order: Number.isFinite(Number(record.display_order)) ? Number(record.display_order) : index,
        };
      })
      .filter((entry): entry is Product["images"][number] => Boolean(entry))
      .sort((a, b) => a.display_order - b.display_order),
    benefits: benefitCandidates
      .map((entry) => {
        if (typeof entry === "string") {
          return { icon: "", label: entry, description: "" };
        }
        if (!entry || typeof entry !== "object") return null;
        const record = entry as Record<string, unknown>;
        const label = toString(record.label, "");
        const description = toString(record.description, "");
        if (!label && !description) return null;
        return {
          icon: toString(record.icon, ""),
          label: label || description,
          description,
        };
      })
      .filter((entry): entry is NonNullable<Product["benefits"]>[number] => Boolean(entry)),
    tags: Array.isArray(value.tags) ? value.tags.filter((entry): entry is string => typeof entry === "string") : [],
    weight_grams:
      value.weight_grams === null || value.weight_grams === undefined ? undefined : Math.max(0, Math.trunc(toNumber(value.weight_grams))),
    sku: typeof value.sku === "string" ? value.sku : undefined,
    has_variants: toBoolean(value.has_variants),
    categories: {
      id: toString(categoryRecord.id),
      name: toString(categoryRecord.name, "Uncategorized"),
      slug: toString(categoryRecord.slug),
    },
  };
};

const mapVariantRecord = (value: unknown): ProductVariant | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = toString(record.id);
  if (!id) return null;
  const optionLinks = Array.isArray(record.product_variant_options) ? record.product_variant_options : [];
  return {
    id,
    label: typeof record.label === "string" ? record.label : null,
    price: record.price === null || record.price === undefined ? null : toNumber(record.price),
    compare_at_price:
      record.compare_at_price === null || record.compare_at_price === undefined ? null : toNumber(record.compare_at_price),
    stock_quantity: Math.max(0, Math.trunc(toNumber(record.stock_quantity))),
    is_available: record.is_available !== false,
    display_order: Math.max(0, Math.trunc(toNumber(record.display_order))),
    sku: typeof record.sku === "string" ? record.sku : null,
    product_variant_options: optionLinks
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const optionRecord = entry as Record<string, unknown>;
        const optionTypeId = toString(optionRecord.option_type_id);
        const optionValueId = toString(optionRecord.option_value_id);
        if (!optionTypeId || !optionValueId) return null;
        return {
          option_type_id: optionTypeId,
          option_value_id: optionValueId,
        };
      })
      .filter((entry): entry is ProductVariant["product_variant_options"][number] => Boolean(entry)),
  };
};

const mapOptionValueRecord = (value: unknown): ProductOptionValue | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = toString(record.id);
  if (!id) return null;
  return {
    id,
    option_type_id: toString(record.option_type_id),
    value: toString(record.value),
    color_hex: typeof record.color_hex === "string" ? record.color_hex : null,
    display_order: Math.max(0, Math.trunc(toNumber(record.display_order))),
  };
};

const mapOptionTypeRecord = (value: unknown): ProductOptionType | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = toString(record.id);
  if (!id) return null;
  const optionValues = Array.isArray(record.product_option_values) ? record.product_option_values : [];
  return {
    id,
    name: toString(record.name),
    display_order: Math.max(0, Math.trunc(toNumber(record.display_order))),
    product_option_values: optionValues
      .map((entry) => mapOptionValueRecord(entry))
      .filter((entry): entry is ProductOptionValue => Boolean(entry))
      .sort((a, b) => a.display_order - b.display_order),
  };
};

const ProductPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { addToCart } = useCart();
  const {
    preset: {
      tokens: { primary: primaryThemeColor },
    },
  } = useThemeConfig();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [activeImage, setActiveImage] = useState<string>("");
  const [hasActiveImageError, setHasActiveImageError] = useState(false);
  const [thumbnailErrors, setThumbnailErrors] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTryOnOpen, setTryOnOpen] = useState(false);
  const [isSizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [isLightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [hasLightboxImageError, setHasLightboxImageError] = useState(false);
  const [isLightboxImageVisible, setIsLightboxImageVisible] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [optionTypes, setOptionTypes] = useState<ProductOptionType[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const lightboxTouchStartXRef = useRef<number | null>(null);

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

        const { data, error: productError } = await (supabase as any)
          .from("products_with_stock")
          .select(`
            id, name, slug, description,
            short_description, price,
            compare_at_price,
            stock_quantity,
            total_stock_quantity,
            in_stock,
            is_available, has_variants,
            images, benefits, tags,
            weight_grams, sku,
            categories ( id, name, slug ),
            product_option_types (
              id,
              name,
              display_order,
              product_option_values (
                id,
                option_type_id,
                value,
                color_hex,
                display_order
              )
            ),
            product_variants (
              id, label,
              price, compare_at_price,
              stock_quantity, is_available,
              display_order, sku,
              product_variant_options (
                option_type_id,
                option_value_id
              )
            )
          `)
          .eq("slug", slug)
          .eq("is_available", true)
          .single();

        if (productError || !data) {
          throw productError ?? new Error("Product not found");
        }

        const mappedProduct = mapProductRecord(data as Record<string, unknown>);
        const variantRows = Array.isArray((data as Record<string, unknown>).product_variants)
          ? ((data as Record<string, unknown>).product_variants as unknown[])
          : [];
        const optionTypeRows = Array.isArray((data as Record<string, unknown>).product_option_types)
          ? ((data as Record<string, unknown>).product_option_types as unknown[])
          : [];
        const sortedVariants = variantRows
          .map((variant) => mapVariantRecord(variant))
          .filter((variant): variant is ProductVariant => Boolean(variant))
          .sort((a, b) => a.display_order - b.display_order);
        const sortedOptionTypes = optionTypeRows
          .map((optionType) => mapOptionTypeRecord(optionType))
          .filter((optionType): optionType is ProductOptionType => Boolean(optionType))
          .sort((a, b) => a.display_order - b.display_order);

        mappedProduct.product_variants = sortedVariants;
        mappedProduct.product_option_types = sortedOptionTypes;
        setProduct(mappedProduct);
        setVariants(sortedVariants);
        setOptionTypes(sortedOptionTypes);
        setSelectedOptions({});

        if (mappedProduct?.categories?.id) {
          const directRelated = (await getRelatedProducts(mappedProduct.categories.id, mappedProduct.id, 3)) ?? [];
          let mergedRelated = directRelated;

          if (mergedRelated.length < 3) {
            try {
              const featured = await getFeaturedProducts();
              const existingIds = new Set(mergedRelated.map((entry) => entry.id));
              existingIds.add(mappedProduct.id);

              const filler = featured.filter((entry) => !existingIds.has(entry.id));
              mergedRelated = [...mergedRelated, ...filler].slice(0, 3);
            } catch (featuredError) {
              if (import.meta.env.DEV) {
                console.error("Failed to fetch featured fallback products", featuredError);
              }
            }
          }

          setRelatedProducts(mergedRelated);
        } else {
          setRelatedProducts([]);
        }
      } catch (err) {
        console.error(err);
        setProduct(null);
        setRelatedProducts([]);
        setVariants([]);
        setOptionTypes([]);
        setSelectedOptions({});
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
      .filter((url): url is string => Boolean(url && url.trim()));
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
  const sortedOptionTypes = useMemo(
    () => [...optionTypes].sort((a, b) => a.display_order - b.display_order),
    [optionTypes],
  );
  const optionValueById = useMemo(() => {
    const index = new Map<string, ProductOptionValue>();
    sortedOptionTypes.forEach((optionType) => {
      optionType.product_option_values.forEach((optionValue) => {
        index.set(optionValue.id, optionValue);
      });
    });
    return index;
  }, [sortedOptionTypes]);
  const hasVariants = Boolean(product?.has_variants) && variants.length > 0 && sortedOptionTypes.length > 0;
  const selectedVariant = useMemo(() => {
    if (!hasVariants) return null;
    const selectedValueIds = Object.values(selectedOptions).filter((valueId) => valueId && valueId.trim());
    if (selectedValueIds.length !== sortedOptionTypes.length) return null;

    return (
      variants.find((variant) =>
        selectedValueIds.every((valueId) =>
          variant.product_variant_options.some((optionLink) => optionLink.option_value_id === valueId),
        ),
      ) ?? null
    );
  }, [hasVariants, selectedOptions, sortedOptionTypes.length, variants]);
  const selectedVariantLabel = useMemo(() => {
    if (!selectedVariant) return null;
    if (selectedVariant.label && selectedVariant.label.trim()) return selectedVariant.label.trim();

    const values = selectedVariant.product_variant_options
      .map((optionLink) => optionValueById.get(optionLink.option_value_id)?.value ?? "")
      .filter(Boolean);

    return values.length > 0 ? values.join(" / ") : null;
  }, [optionValueById, selectedVariant]);
  const hasAnyAvailableVariant = variants.some((variant) => variant.is_available && variant.stock_quantity > 0);
  const productStockQuantity = product ? getStockQuantity(product) : 0;
  const isOutOfStock = !product || (hasVariants ? !hasAnyAvailableVariant : !isInStock(product));
  const displayPrice = selectedVariant?.price ?? product?.price ?? 0;
  const displayComparePrice = selectedVariant?.compare_at_price ?? product?.compare_at_price ?? null;
  const hasPriceDifferenceAcrossVariants =
    hasVariants && Boolean(product) && variants.some((variant) => variant.price !== null && variant.price !== product.price);
  const showPriceVariesByVariantNote = shouldShowPriceVariesByVariantNote(
    hasPriceDifferenceAcrossVariants,
    selectedVariant?.price,
    product?.price,
  );
  const normalizedCategorySlug = categorySlug.toLowerCase();
  const showTryOn = storeConfig.features.tryOn
    ? TRYON_CATEGORY_KEYWORDS.some((keyword) => normalizedCategorySlug.includes(keyword))
    : false;
  const isShoeCategory = categorySlug.includes("shoe");
  const isBagCategory = categorySlug.includes("bag");
  const sizeOptionType = useMemo(
    () => sortedOptionTypes.find((optionType) => optionType.name.toLowerCase().includes("size")) ?? null,
    [sortedOptionTypes],
  );
  const missingOptionNames = useMemo(
    () =>
      sortedOptionTypes
        .filter((optionType) => !selectedOptions[optionType.id])
        .map((optionType) => optionType.name.toLowerCase()),
    [selectedOptions, sortedOptionTypes],
  );
  const activeImageIndex = useMemo(() => {
    const index = galleryImages.findIndex((image) => image === activeImage);
    return index >= 0 ? index : 0;
  }, [activeImage, galleryImages]);
  const lightboxImageUrl = galleryImages[lightboxIndex] ?? "";
  const lightboxHasMultipleImages = galleryImages.length > 1;

  const isOptionValueUnavailable = (optionTypeId: string, optionValueId: string) => {
    return !variants.some((variant) => {
      if (!variant.is_available || variant.stock_quantity <= 0) return false;

      const hasCurrentValue = variant.product_variant_options.some((optionLink) => optionLink.option_value_id === optionValueId);
      if (!hasCurrentValue) return false;

      return Object.entries(selectedOptions)
        .filter(([typeId]) => typeId !== optionTypeId)
        .every(([, selectedValueId]) =>
          selectedValueId
            ? variant.product_variant_options.some((optionLink) => optionLink.option_value_id === selectedValueId)
            : true,
        );
    });
  };

  const addToCartButtonText = useMemo(() => {
    if (!hasVariants) {
      return isOutOfStock ? "Out of Stock" : "Add to Cart";
    }

    if (!selectedVariant) {
      if (missingOptionNames.length > 0) return `Select ${missingOptionNames[0]}`;
      return "Select options";
    }

    if (!selectedVariant.is_available || selectedVariant.stock_quantity === 0) {
      return "Out of Stock";
    }

    return "Add to Cart";
  }, [hasVariants, isOutOfStock, missingOptionNames, selectedVariant]);

  const isAddToCartDisabled =
    !product ||
    (hasVariants
      ? !selectedVariant || !selectedVariant.is_available || selectedVariant.stock_quantity === 0
      : isOutOfStock);
  const stockStatus = useMemo(() => {
    if (!product) {
      return { text: "Out of stock", tone: "danger" as const };
    }

    if (hasVariants) {
      if (!selectedVariant) {
        return { text: "Select options to see availability", tone: "muted" as const };
      }

      if (!selectedVariant.is_available || selectedVariant.stock_quantity <= 0) {
        return { text: "Out of stock", tone: "danger" as const };
      }

      if (selectedVariant.stock_quantity <= 10) {
        return { text: `Only ${selectedVariant.stock_quantity} left in stock`, tone: "accent" as const };
      }

      return { text: "In stock", tone: "default" as const };
    }

    if (isOutOfStock) {
      return { text: "Out of stock", tone: "danger" as const };
    }

    if (productStockQuantity <= 10) {
      return { text: `Only ${productStockQuantity} left in stock`, tone: "accent" as const };
    }

    return { text: `${productStockQuantity} in stock`, tone: "default" as const };
  }, [hasVariants, isOutOfStock, product, productStockQuantity, selectedVariant]);
  const stockStatusToneClass =
    stockStatus.tone === "danger"
      ? "text-[var(--color-muted)]"
      : stockStatus.tone === "accent"
        ? "text-[var(--color-accent)]"
        : stockStatus.tone === "muted"
          ? "text-[var(--color-muted-soft)]"
          : "text-[var(--color-muted)]";

  useEffect(() => {
    if (!hasVariants) {
      setSelectedOptions({});
      return;
    }

    setSelectedOptions((current) => {
      const next = { ...current };
      let hasChanges = false;

      Object.keys(next).forEach((optionTypeId) => {
        const optionType = sortedOptionTypes.find((entry) => entry.id === optionTypeId);
        const selectedValueId = next[optionTypeId];
        const hasValue = optionType?.product_option_values.some((optionValue) => optionValue.id === selectedValueId);
        if (!optionType || !hasValue) {
          delete next[optionTypeId];
          hasChanges = true;
        }
      });

      return hasChanges ? next : current;
    });
  }, [hasVariants, sortedOptionTypes]);

  useEffect(() => {
    if (!galleryImages.length) {
      setLightboxOpen(false);
      setLightboxIndex(0);
      return;
    }

    if (activeImageIndex !== lightboxIndex) {
      setLightboxIndex(activeImageIndex);
    }
  }, [activeImageIndex, galleryImages.length, lightboxIndex]);

  useEffect(() => {
    if (!isLightboxOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxOpen(false);
        return;
      }

      if (!lightboxHasMultipleImages) {
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        const nextIndex = (lightboxIndex + direction + galleryImages.length) % galleryImages.length;
        const nextImage = galleryImages[nextIndex] ?? "";

        setLightboxIndex(nextIndex);
        setActiveImage(nextImage);
        setHasActiveImageError(false);
        setHasLightboxImageError(false);
        setIsLightboxImageVisible(false);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [galleryImages, isLightboxOpen, lightboxHasMultipleImages, lightboxIndex]);

  useEffect(() => {
    if (!isSizeGuideOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSizeGuideOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isSizeGuideOpen]);

  const navigateLightboxTo = (nextIndex: number) => {
    if (!galleryImages.length) {
      return;
    }

    const normalizedIndex = (nextIndex + galleryImages.length) % galleryImages.length;
    if (normalizedIndex === lightboxIndex) {
      return;
    }

    const nextImage = galleryImages[normalizedIndex] ?? "";

    setLightboxIndex(normalizedIndex);
    setActiveImage(nextImage);
    setHasActiveImageError(false);
    setHasLightboxImageError(false);
    setIsLightboxImageVisible(false);
  };

  const handleOpenLightbox = () => {
    if (!galleryImages.length || hasActiveImageError) {
      return;
    }

    setLightboxIndex(activeImageIndex);
    setHasLightboxImageError(false);
    setIsLightboxImageVisible(false);
    setLightboxOpen(true);
  };

  const handleCloseLightbox = () => {
    setLightboxOpen(false);
  };

  const handleLightboxTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    lightboxTouchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleLightboxTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (!lightboxHasMultipleImages || lightboxTouchStartXRef.current === null) {
      lightboxTouchStartXRef.current = null;
      return;
    }

    const endX = event.changedTouches[0]?.clientX ?? lightboxTouchStartXRef.current;
    const swipeDistance = lightboxTouchStartXRef.current - endX;
    lightboxTouchStartXRef.current = null;

    if (Math.abs(swipeDistance) <= 50) {
      return;
    }

    navigateLightboxTo(swipeDistance > 0 ? lightboxIndex + 1 : lightboxIndex - 1);
  };

  const handleAddToCart = () => {
    if (!product) {
      return;
    }

    if (hasVariants) {
      if (!selectedVariant || !selectedVariant.is_available || selectedVariant.stock_quantity <= 0) {
        return;
      }

      addToCart({
        product_id: product.id,
        name: product.name,
        slug: product.slug,
        category: categoryLabel,
        price: displayPrice,
        compare_at_price: displayComparePrice ?? null,
        image_url: primaryImage,
        image_alt: product.name,
        sku: selectedVariant.sku ?? product.sku ?? null,
        stock_quantity: selectedVariant.stock_quantity,
        variant_id: selectedVariant.id,
        variant_label: selectedVariantLabel,
      });
      return;
    }

    if (isOutOfStock) {
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
      stock_quantity: productStockQuantity,
      variant_id: null,
      variant_label: null,
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
          className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted)] transition-colors hover:text-foreground"
        >
          {"\u2190 Back to Shop"}
        </Link>

        <div className="flex flex-wrap items-center gap-2 font-body text-[11px] font-light text-[var(--color-muted)]">
          <Link to="/" className="transition-colors hover:text-foreground">
            Home
          </Link>
          <span className="text-[var(--color-muted-soft)]">/</span>
          <Link to="/shop" className="transition-colors hover:text-foreground">
            Shop
          </Link>
          <span className="text-[var(--color-muted-soft)]">/</span>
          <Link to="/shop" className="transition-colors hover:text-foreground">
            {categoryLabel}
          </Link>
          <span className="text-[var(--color-muted-soft)]">/</span>
          <span>{product.name}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14 xl:gap-16">
        <div>
          {galleryImages.length > 0 ? (
            <div className="flex flex-col gap-3 md:flex-row md:gap-3">
              <div className="lux-hide-scrollbar order-2 flex gap-2 overflow-x-auto pb-1 md:order-1 md:max-h-[400px] md:w-20 md:flex-col md:overflow-x-hidden md:overflow-y-auto md:pb-0">
                {galleryImages.map((image, index) => {
                  const hasThumbError = thumbnailErrors[image] === true;
                  const isActive = activeImage === image;
                  return (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      onClick={() => {
                        setActiveImage(image);
                        setHasActiveImageError(false);
                        setLightboxIndex(index);
                      }}
                      className={`h-[75px] w-[56px] shrink-0 overflow-hidden rounded-[var(--border-radius)] border-2 transition-all duration-200 ease-in md:h-24 md:w-[72px] ${
                        isActive ? "border-[var(--color-primary)] opacity-100" : "border-transparent opacity-60 hover:opacity-100"
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

              <div className="order-1 flex-1 md:order-2">
                <button
                  type="button"
                  onClick={handleOpenLightbox}
                  className="group block w-full cursor-zoom-in overflow-hidden rounded-[var(--border-radius)]"
                  aria-label="Open full image"
                >
                  {activeImage && !hasActiveImageError ? (
                    <div className="aspect-[3/4] overflow-hidden rounded-[var(--border-radius)]">
                      <img
                        src={activeImage}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-[1.02]"
                        onError={() => setHasActiveImageError(true)}
                      />
                    </div>
                  ) : (
                    <ProductImagePlaceholder className="aspect-[3/4] w-full rounded-[var(--border-radius)]" />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <ProductImagePlaceholder className="aspect-[3/4] w-full rounded-[var(--border-radius)]" />
          )}
        </div>

        <div className="flex flex-col">
          <span className="mb-2 font-body text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--color-accent)]">{categoryLabel}</span>
          <h1 className="mb-4 font-display text-[36px] font-light italic leading-[1.2] text-[var(--color-primary)]">{product.name}</h1>
          <div className="flex items-end gap-3">
            {displayComparePrice !== null && displayComparePrice > displayPrice ? (
              <p className="font-body text-[16px] font-light text-[var(--color-muted-soft)] line-through">{formatPrice(displayComparePrice)}</p>
            ) : null}
            <p className="font-display text-[28px] font-normal text-[var(--color-primary)]">{formatPrice(displayPrice)}</p>
          </div>
          {showPriceVariesByVariantNote ? (
            <p className="mt-1 font-body text-[10px] text-[var(--color-muted-soft)]">Price varies by variant</p>
          ) : null}

          <div className="my-5 border-t border-[var(--color-border)]" />

          {hasVariants ? (
            <div className="space-y-5">
              {sortedOptionTypes.map((optionType) => {
                const selectedValueId = selectedOptions[optionType.id] ?? null;
                const selectedValue =
                  optionType.product_option_values.find((optionValue) => optionValue.id === selectedValueId) ?? null;
                const renderAsSwatches = optionType.product_option_values.some((optionValue) => Boolean(optionValue.color_hex));

                return (
                  <div key={optionType.id}>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">{optionType.name}</p>
                      <div className="flex items-center gap-4">
                        {selectedValue ? (
                          <p className="font-body text-[11px] text-[var(--color-primary)]">{selectedValue.value}</p>
                        ) : null}
                        {sizeOptionType?.id === optionType.id ? (
                          <button
                            type="button"
                            onClick={() => setSizeGuideOpen(true)}
                            className="font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)] transition-colors duration-200 hover:text-[var(--color-primary)]"
                          >
                            Size guide
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {renderAsSwatches ? (
                      <div className="flex flex-wrap gap-[10px]">
                        {optionType.product_option_values.map((optionValue) => {
                          const isUnavailable = isOptionValueUnavailable(optionType.id, optionValue.id);
                          const isSelected = selectedValueId === optionValue.id;
                          return (
                            <button
                              key={optionValue.id}
                              type="button"
                              title={optionValue.value}
                              disabled={isUnavailable}
                              onClick={() =>
                                setSelectedOptions((current) => ({
                                  ...current,
                                  [optionType.id]: optionValue.id,
                                }))
                              }
                              className={`relative h-7 w-7 rounded-full border-2 transition-all duration-150 ease-in ${
                                isSelected ? "scale-110 border-[var(--color-primary)]" : "border-transparent"
                              } ${isUnavailable ? "cursor-not-allowed opacity-35" : "cursor-pointer"}`}
                              style={{ backgroundColor: optionValue.color_hex || primaryThemeColor }}
                            >
                              {isUnavailable ? (
                                <span
                                  className="pointer-events-none absolute inset-0 rounded-full"
                                  style={{
                                    background:
                                      "linear-gradient(135deg, transparent 45%, rgba(var(--color-secondary-rgb),0.8) 45%, rgba(var(--color-secondary-rgb),0.8) 55%, transparent 55%)",
                                  }}
                                />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {optionType.product_option_values.map((optionValue) => {
                          const isUnavailable = isOptionValueUnavailable(optionType.id, optionValue.id);
                          const isSelected = selectedValueId === optionValue.id;
                          return (
                            <button
                              key={optionValue.id}
                              type="button"
                              disabled={isUnavailable}
                              onClick={() =>
                                setSelectedOptions((current) => ({
                                  ...current,
                                  [optionType.id]: optionValue.id,
                                }))
                              }
                              className={`min-w-11 rounded-[var(--border-radius)] border px-[14px] py-2 text-center font-body text-[11px] transition-colors duration-150 ease-in ${
                                isSelected
                                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-secondary)]"
                                  : isUnavailable
                                    ? "cursor-not-allowed border-[var(--color-surface)] text-[var(--color-border)] line-through"
                                    : "border-[var(--color-border)] bg-transparent text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                              }`}
                            >
                              {optionValue.value}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}

          <p className={`mt-5 font-body text-[11px] uppercase tracking-[0.1em] ${stockStatusToneClass}`}>{stockStatus.text}</p>

          <div className="my-5 border-t border-[var(--color-border)]" />

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isAddToCartDisabled}
            className={`w-full rounded-[var(--border-radius)] border-0 px-4 py-[18px] font-body text-[11px] uppercase tracking-[0.18em] transition-all duration-200 ease-in ${
              isAddToCartDisabled
                ? "cursor-not-allowed bg-[var(--color-border)] text-[var(--color-muted)]"
                : "cursor-pointer bg-[var(--color-primary)] text-[var(--color-secondary)] hover:bg-[var(--color-accent)] hover:text-[var(--color-primary)]"
            }`}
          >
            {addToCartButtonText}
          </button>

          {showTryOn ? (
            <>
              <button
                type="button"
                onClick={() => setTryOnOpen(true)}
                className="mt-[10px] flex w-full items-center justify-center gap-2 rounded-[var(--border-radius)] border border-[var(--color-primary)] bg-transparent px-4 py-[18px] font-body text-[11px] uppercase tracking-[0.18em] text-[var(--color-primary)] transition-all duration-200 ease-in hover:bg-[var(--color-primary)] hover:text-[var(--color-secondary)]"
              >
                <WandSparkles size={16} strokeWidth={1.4} />
                Try it On
              </button>
              <p className="mt-[6px] text-center font-body text-[9px] tracking-[0.1em] text-[var(--color-muted-soft)]">Powered by StyleSyncs</p>
            </>
          ) : null}

          <div className="mt-5 flex items-start justify-between gap-3">
            {trustItems.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.label} className="flex flex-1 flex-col items-center gap-1.5 text-center">
                  <Icon size={18} strokeWidth={1.4} className="text-[var(--color-accent)]" />
                  <p className="font-body text-[9px] uppercase tracking-[0.12em] text-[var(--color-muted-soft)]">{item.label}</p>
                </div>
              );
            })}
          </div>

          <div className="my-7 border-t border-[var(--color-border)]" />

          <p className="font-body text-[14px] font-light leading-[1.8] text-[var(--color-muted)]">
            {product.short_description || product.description || ""}
          </p>

          <div className="mt-7 grid grid-cols-2 border border-[var(--color-border)]">
            {benefitTiles.map((benefit, index) => {
              const Icon = benefitIcons[index % benefitIcons.length];

              return (
                <div
                  key={`${benefit}-${index}`}
                  className={`flex min-h-[108px] flex-col items-center justify-center px-3 text-center ${
                    index % 2 === 0 ? "border-r border-[var(--color-border)]" : ""
                  } ${index < 2 ? "border-b border-[var(--color-border)]" : ""}`}
                >
                  <Icon size={20} className="mb-3 text-[var(--color-primary)]" />
                  <span className="font-body text-[11px] font-light uppercase tracking-[0.1em] text-[var(--color-muted)]">{benefit}</span>
                </div>
              );
            })}
          </div>

          <div className="my-7 border-t border-[var(--color-border)]" />
        </div>
      </div>

      {relatedProducts.length > 0 ? (
        <>
          <div className="my-12 border-t border-[var(--color-border)]" />

          <section>
            <p className="mb-2 font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">RELATED PRODUCTS</p>
            <h2 className="mb-10 font-display text-[32px] font-light italic leading-[1.1] text-[var(--color-primary)]">You May Also Like</h2>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {relatedProducts.map((item) => (
                <StorefrontProductCard key={item.id} product={item} actionLabel="View Product" />
              ))}
            </div>
          </section>
        </>
      ) : null}

      {isLightboxOpen ? (
        <div
          className="fixed inset-0 z-[2000] cursor-zoom-out bg-[rgba(var(--color-primary-rgb),0.95)]"
          onClick={handleCloseLightbox}
          onTouchStart={handleLightboxTouchStart}
          onTouchEnd={handleLightboxTouchEnd}
          role="dialog"
          aria-modal="true"
          aria-label="Product image lightbox"
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleCloseLightbox();
            }}
            className="fixed right-6 top-6 z-[2001] text-white/70 transition-opacity duration-200 hover:text-white hover:opacity-100"
            aria-label="Close lightbox"
          >
            <X size={24} strokeWidth={1.2} />
          </button>

          {lightboxHasMultipleImages ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                navigateLightboxTo(lightboxIndex - 1);
              }}
              className="fixed left-3 top-1/2 z-[2001] -translate-y-1/2 text-white/60 transition-colors duration-200 hover:text-white md:left-6"
              aria-label="Previous image"
            >
              <ChevronLeft size={32} strokeWidth={1.2} />
            </button>
          ) : null}

          {lightboxHasMultipleImages ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                navigateLightboxTo(lightboxIndex + 1);
              }}
              className="fixed right-3 top-1/2 z-[2001] -translate-y-1/2 text-white/60 transition-colors duration-200 hover:text-white md:right-6"
              aria-label="Next image"
            >
              <ChevronRight size={32} strokeWidth={1.2} />
            </button>
          ) : null}

          <div className="flex h-full items-center justify-center p-4 md:p-8">
            {lightboxImageUrl && !hasLightboxImageError ? (
              <img
                src={lightboxImageUrl}
                alt={`${product.name} image ${lightboxIndex + 1}`}
                className={`max-h-[90vh] max-w-[90vw] cursor-default object-contain transition-opacity duration-200 ease-in ${
                  isLightboxImageVisible ? "opacity-100" : "opacity-0"
                }`}
                onClick={(event) => event.stopPropagation()}
                onLoad={() => setIsLightboxImageVisible(true)}
                onError={() => setHasLightboxImageError(true)}
              />
            ) : (
              <div onClick={(event) => event.stopPropagation()}>
                <ProductImagePlaceholder className="h-[60vh] w-[80vw] max-w-[560px]" />
              </div>
            )}
          </div>

          <p className="pointer-events-none fixed bottom-20 left-1/2 z-[2001] -translate-x-1/2 font-body text-[11px] tracking-[0.1em] text-white/50">
            {`${lightboxIndex + 1} / ${galleryImages.length}`}
          </p>

          <div className="lux-hide-scrollbar fixed bottom-6 left-1/2 z-[2001] flex max-w-[90vw] -translate-x-1/2 gap-2 overflow-x-auto">
            {galleryImages.map((image, index) => (
              <button
                key={`lightbox-thumb-${image}-${index}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  navigateLightboxTo(index);
                }}
                className={`h-[53px] w-10 shrink-0 overflow-hidden rounded-[var(--border-radius)] border-b-2 transition-opacity duration-150 ease-in ${
                  lightboxIndex === index ? "border-white opacity-100" : "border-transparent opacity-50 hover:opacity-80"
                }`}
                aria-label={`Open image ${index + 1}`}
              >
                <img src={image} alt={`${product.name} thumbnail ${index + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {isSizeGuideOpen ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 px-3 py-6"
          onClick={() => setSizeGuideOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Size Guide"
        >
          <div
            className="relative max-h-[80vh] w-full max-w-[480px] overflow-y-auto rounded-[var(--border-radius)] bg-[var(--color-secondary)] p-8 sm:p-10"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSizeGuideOpen(false)}
              className="absolute right-5 top-5 text-[var(--color-muted)] transition-colors duration-200 hover:text-[var(--color-primary)]"
              aria-label="Close size guide"
            >
              <X size={20} strokeWidth={1.4} />
            </button>

            <h3 className="font-display text-[28px] italic text-[var(--color-primary)]">Size Guide</h3>
            <p className="mb-8 font-body text-[11px] text-[var(--color-muted-soft)]">{categoryLabel}</p>

            {isBagCategory ? (
              <p className="font-body text-[12px] leading-[1.8] text-[var(--color-muted)]">
                One size - see product dimensions in the description.
              </p>
            ) : isShoeCategory ? (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[var(--color-primary)] font-body text-[10px] uppercase tracking-[0.08em] text-[var(--color-secondary)]">
                    <th className="px-4 py-3 text-left">UK</th>
                    <th className="px-4 py-3 text-left">EU</th>
                    <th className="px-4 py-3 text-left">US</th>
                    <th className="px-4 py-3 text-left">Foot length (cm)</th>
                  </tr>
                </thead>
                <tbody>
                  {shoeSizeGuideRows.map((row, index) => (
                    <tr key={row.uk} className={index % 2 === 0 ? "bg-[var(--color-secondary)]" : "bg-[rgba(var(--color-primary-rgb),0.03)]"}>
                      <td className="px-4 py-2.5 font-body text-[12px] text-[var(--color-muted)]">{row.uk}</td>
                      <td className="px-4 py-2.5 font-body text-[12px] text-[var(--color-muted)]">{row.eu}</td>
                      <td className="px-4 py-2.5 font-body text-[12px] text-[var(--color-muted)]">{row.us}</td>
                      <td className="px-4 py-2.5 font-body text-[12px] text-[var(--color-muted)]">{row.foot}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[var(--color-primary)] font-body text-[10px] uppercase tracking-[0.08em] text-[var(--color-secondary)]">
                    <th className="px-4 py-3 text-left">Size</th>
                    <th className="px-4 py-3 text-left">Chest (cm)</th>
                    <th className="px-4 py-3 text-left">Waist (cm)</th>
                    <th className="px-4 py-3 text-left">Hips (cm)</th>
                  </tr>
                </thead>
                <tbody>
                  {clothingSizeGuideRows.map((row, index) => (
                    <tr key={row.size} className={index % 2 === 0 ? "bg-[var(--color-secondary)]" : "bg-[rgba(var(--color-primary-rgb),0.03)]"}>
                      <td className="px-4 py-2.5 font-body text-[12px] text-[var(--color-muted)]">{row.size}</td>
                      <td className="px-4 py-2.5 font-body text-[12px] text-[var(--color-muted)]">{row.chest}</td>
                      <td className="px-4 py-2.5 font-body text-[12px] text-[var(--color-muted)]">{row.waist}</td>
                      <td className="px-4 py-2.5 font-body text-[12px] text-[var(--color-muted)]">{row.hips}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <p className="mt-4 font-body text-[11px] leading-[1.8] text-[var(--color-muted-soft)]">
              Measurements are approximate. If you are between sizes we recommend sizing up.
            </p>
          </div>
        </div>
      ) : null}

      {showTryOn ? <TryOnModal product={product} isOpen={isTryOnOpen} onClose={() => setTryOnOpen(false)} /> : null}
    </div>
  );
};

export default ProductPage;


