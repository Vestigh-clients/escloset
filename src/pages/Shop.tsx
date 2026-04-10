import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import StorefrontProductCard from "@/components/products/StorefrontProductCard";
import ProductFetchErrorState from "@/components/products/ProductFetchErrorState";
import { useCart } from "@/contexts/CartContext";
import { useStorefrontConfig } from "@/contexts/StorefrontConfigContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatPrice } from "@/lib/price";
import { getAllProducts } from "@/services/productService";
import type { StorefrontCategory } from "@/services/storefrontCategoryService";
import {
  getPrimaryImage,
  getStockQuantity,
  isInStock,
  type Product,
} from "@/types/product";

type ShopFilter = "all" | string;
type SortKey = "newest" | "price-low" | "price-high" | "popular";

interface CategoryFilterItem {
  slug: string;
  label: string;
}

interface VariationFilterOption {
  id: string;
  label: string;
  colorHex: string | null;
  displayOrder: number;
  count: number;
}

interface VariationFilterType {
  id: string;
  name: string;
  displayOrder: number;
  hasColorSwatches: boolean;
  options: VariationFilterOption[];
}

interface FilterPanelProps {
  activeFilter: ShopFilter;
  activeFilterCount: number;
  categoryCounts: Record<string, number>;
  categoryFilterItems: CategoryFilterItem[];
  clearAllFilters: () => void;
  priceCeiling: number;
  priceLimit: number;
  selectedVariationOptionIdsByType: Record<string, string[]>;
  setActiveFilter: (nextFilter: ShopFilter) => void;
  setPriceLimit: (value: number) => void;
  toggleVariationFilterOption: (typeId: string, optionId: string) => void;
  variationFilterTypes: VariationFilterType[];
}

const DEFAULT_PRICE_CEILING = 1000;
const SHOP_PAGE_SIZE_DESKTOP = 6;
const SHOP_PAGE_SIZE_MOBILE = 8;

const normalizeColorHex = (colorHex: string | null) => {
  if (!colorHex) {
    return null;
  }

  const normalized = colorHex.trim();
  if (/^#([a-f\d]{3}|[a-f\d]{6})$/i.test(normalized)) {
    return normalized;
  }

  return null;
};

const normalizeVariationTypeKey = (name: string) => name.trim().toLowerCase();
const normalizeVariationOptionKey = (label: string) => label.trim().toLowerCase();

const getAvailableVariantOptionIdsByType = (product: Product) => {
  const result = new Map<string, Set<string>>();
  const variants = product.product_variants ?? [];

  for (const variant of variants) {
    if (!variant.is_available || variant.stock_quantity <= 0) {
      continue;
    }

    for (const optionLink of variant.product_variant_options) {
      if (!result.has(optionLink.option_type_id)) {
        result.set(optionLink.option_type_id, new Set<string>());
      }

      result.get(optionLink.option_type_id)?.add(optionLink.option_value_id);
    }
  }

  return result;
};

const getProductOptionIdsByType = (product: Product) => {
  const optionTypes = product.product_option_types ?? [];
  if (optionTypes.length === 0) {
    return new Map<string, Set<string>>();
  }

  const availableByType = getAvailableVariantOptionIdsByType(product);
  const hasAvailableVariantConstraints = availableByType.size > 0;
  const result = new Map<string, Set<string>>();

  for (const optionType of optionTypes) {
    const typeKey = normalizeVariationTypeKey(optionType.name);
    if (!typeKey) {
      continue;
    }

    const ids = result.get(typeKey) ?? new Set<string>();
    const allowedIds = availableByType.get(optionType.id);

    for (const optionValue of optionType.product_option_values) {
      const optionLabel = optionValue.value.trim();
      if (!optionLabel) {
        continue;
      }

      if (hasAvailableVariantConstraints) {
        if (!allowedIds || !allowedIds.has(optionValue.id)) {
          continue;
        }
      }

      const optionKey = normalizeVariationOptionKey(optionLabel);
      if (!optionKey) {
        continue;
      }

      ids.add(optionKey);
    }

    if (ids.size > 0) {
      result.set(typeKey, ids);
    }
  }

  return result;
};

const collectVariationFilterTypes = (products: Product[]): VariationFilterType[] => {
  const typeMap = new Map<
    string,
    {
      id: string;
      name: string;
      displayOrder: number;
      options: Map<string, VariationFilterOption>;
    }
  >();

  for (const product of products) {
    const optionIdsByType = getProductOptionIdsByType(product);
    const optionTypes = product.product_option_types ?? [];
    const seenOptionKeysByType = new Map<string, Set<string>>();

    for (const optionType of optionTypes) {
      const typeKey = normalizeVariationTypeKey(optionType.name);
      if (!typeKey) {
        continue;
      }

      const availableOptionIds = optionIdsByType.get(typeKey);
      if (!availableOptionIds || availableOptionIds.size === 0) {
        continue;
      }

      if (!typeMap.has(typeKey)) {
        typeMap.set(typeKey, {
          id: typeKey,
          name: optionType.name.trim() || "Variation",
          displayOrder: optionType.display_order,
          options: new Map<string, VariationFilterOption>(),
        });
      }

      const typeEntry = typeMap.get(typeKey);
      if (!typeEntry) {
        continue;
      }

      typeEntry.displayOrder = Math.min(typeEntry.displayOrder, optionType.display_order);
      const seenInProduct = seenOptionKeysByType.get(typeKey) ?? new Set<string>();
      seenOptionKeysByType.set(typeKey, seenInProduct);

      for (const optionValue of optionType.product_option_values) {
        const optionLabel = optionValue.value.trim();
        if (!optionLabel) {
          continue;
        }

        const optionKey = normalizeVariationOptionKey(optionLabel);
        if (!optionKey || !availableOptionIds.has(optionKey)) {
          continue;
        }

        const existing = typeEntry.options.get(optionKey);
        const normalizedColor = normalizeColorHex(optionValue.color_hex);
        if (!existing) {
          typeEntry.options.set(optionKey, {
            id: optionKey,
            label: optionLabel,
            colorHex: normalizedColor,
            displayOrder: optionValue.display_order,
            count: seenInProduct.has(optionKey) ? 0 : 1,
          });
        } else {
          if (!seenInProduct.has(optionKey)) {
            existing.count += 1;
          }
          existing.displayOrder = Math.min(existing.displayOrder, optionValue.display_order);
          if (!existing.colorHex && normalizedColor) {
            existing.colorHex = normalizedColor;
          }
        }

        seenInProduct.add(optionKey);
      }
    }
  }

  return Array.from(typeMap.values())
    .map((typeEntry) => {
      const options = Array.from(typeEntry.options.values()).sort((left, right) => {
        if (left.displayOrder !== right.displayOrder) {
          return left.displayOrder - right.displayOrder;
        }

        return left.label.localeCompare(right.label);
      });

      return {
        id: typeEntry.id,
        name: typeEntry.name,
        displayOrder: typeEntry.displayOrder,
        hasColorSwatches: options.some((option) => Boolean(option.colorHex)),
        options,
      };
    })
    .filter((typeEntry) => typeEntry.options.length > 0)
    .sort((left, right) => {
      if (left.displayOrder !== right.displayOrder) {
        return left.displayOrder - right.displayOrder;
      }

      return left.name.localeCompare(right.name);
    });
};

const sanitizeSelectedVariationFilters = (
  current: Record<string, string[]>,
  variationFilterTypes: VariationFilterType[],
) => {
  const allowedByType = new Map<string, Set<string>>();
  for (const typeEntry of variationFilterTypes) {
    allowedByType.set(typeEntry.id, new Set(typeEntry.options.map((option) => option.id)));
  }

  const next: Record<string, string[]> = {};
  let changed = false;

  for (const [typeId, selectedIds] of Object.entries(current)) {
    const allowed = allowedByType.get(typeId);
    if (!allowed) {
      changed = true;
      continue;
    }

    const filtered = selectedIds.filter((optionId) => allowed.has(optionId));
    if (filtered.length === 0) {
      if (selectedIds.length > 0) {
        changed = true;
      }
      continue;
    }

    if (filtered.length !== selectedIds.length) {
      changed = true;
    }
    next[typeId] = filtered;
  }

  if (!changed && Object.keys(next).length !== Object.keys(current).length) {
    changed = true;
  }

  return { next, changed };
};

const productMatchesVariationFilters = (
  product: Product,
  selectedVariationOptionIdsByType: Record<string, string[]>,
) => {
  const selections = Object.entries(selectedVariationOptionIdsByType).filter(([, optionIds]) => optionIds.length > 0);
  if (selections.length === 0) {
    return true;
  }

  const productOptionIdsByType = getProductOptionIdsByType(product);
  for (const [typeId, selectedIds] of selections) {
    const productOptionIds = productOptionIdsByType.get(typeId);
    if (!productOptionIds || productOptionIds.size === 0) {
      return false;
    }

    const hasMatch = selectedIds.some((selectedId) => productOptionIds.has(selectedId));
    if (!hasMatch) {
      return false;
    }
  }

  return true;
};

const FilterPanel = ({
  activeFilter,
  activeFilterCount,
  categoryCounts,
  categoryFilterItems,
  clearAllFilters,
  priceCeiling,
  priceLimit,
  selectedVariationOptionIdsByType,
  setActiveFilter,
  setPriceLimit,
  toggleVariationFilterOption,
  variationFilterTypes,
}: FilterPanelProps) => {
  return (
    <div className="space-y-8 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 shadow-[0_10px_30px_rgba(26,28,28,0.04)] md:p-5">
      <div className="flex items-center justify-between">
        <p className="font-manrope text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
          Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
        </p>
        <button
          type="button"
          onClick={clearAllFilters}
          className="font-manrope text-[11px] uppercase tracking-[0.1em] text-primary transition-colors hover:text-on-surface"
        >
          Clear
        </button>
      </div>

      <section>
        <h3 className="mb-4 font-notoSerif text-xl font-bold">Category</h3>
        <div className="space-y-1">
          {categoryFilterItems.map((category) => (
            <label
              key={category.slug}
              className="group flex cursor-pointer items-center justify-between rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-outline-variant/40 hover:bg-surface"
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={activeFilter === category.slug}
                  onChange={() => setActiveFilter(activeFilter === category.slug ? "all" : category.slug)}
                  className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                />
                <span className="font-manrope text-sm transition-colors group-hover:text-primary">{category.label}</span>
              </div>
              <span className="font-manrope text-xs text-on-surface-variant">{categoryCounts[category.slug] ?? 0}</span>
            </label>
          ))}
        </div>
      </section>

      {variationFilterTypes.length > 0 ? (
        <>
          {variationFilterTypes.map((variationType) => (
            <section key={variationType.id} className="border-t border-outline-variant/25 pt-6">
              <h3 className="mb-4 font-notoSerif text-xl font-bold">{variationType.name}</h3>
              <div className="flex flex-wrap gap-2.5">
                {variationType.options.map((option) => {
                  const selectedIds = selectedVariationOptionIdsByType[variationType.id] ?? [];
                  const isSelected = selectedIds.includes(option.id);

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleVariationFilterOption(variationType.id, option.id)}
                      className={[
                        "inline-flex items-center gap-2 rounded-md border bg-surface px-3 py-2 text-xs font-medium transition-all",
                        isSelected
                          ? "border-primary text-primary"
                          : "border-outline-variant hover:border-primary hover:text-primary",
                      ].join(" ")}
                      title={`${option.label} (${option.count})`}
                    >
                      {variationType.hasColorSwatches && option.colorHex ? (
                        <span
                          className="h-3 w-3 rounded-full border border-outline-variant/50"
                          style={{ backgroundColor: option.colorHex }}
                          aria-hidden="true"
                        />
                      ) : null}
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      ) : (
        <section className="border-t border-outline-variant/25 pt-6">
          <h3 className="mb-2 font-notoSerif text-xl font-bold">Variations</h3>
          <p className="font-manrope text-sm text-on-surface-variant">No variation options available.</p>
        </section>
      )}

      <section className="border-t border-outline-variant/25 pt-6">
        <h3 className="mb-4 font-notoSerif text-xl font-bold">Price Range</h3>
        <input
          type="range"
          min={0}
          max={priceCeiling}
          value={priceLimit}
          onChange={(event) => setPriceLimit(Number(event.target.value))}
          className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-surface-variant accent-primary"
        />
        <div className="mt-4 flex justify-between text-xs font-medium uppercase tracking-widest text-on-surface-variant">
          <span>{formatPrice(0)}</span>
          <span>{formatPrice(priceLimit)}</span>
        </div>
      </section>
    </div>
  );
};

interface ShopProps {
  initialProducts?: Product[];
  initialCategories?: StorefrontCategory[];
}

const Shop = ({ initialProducts = [], initialCategories = [] }: ShopProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToCart } = useCart();
  const { storefrontCategories } = useStorefrontConfig();

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(initialProducts.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [priceLimit, setPriceLimit] = useState(DEFAULT_PRICE_CEILING);
  const [selectedVariationOptionIdsByType, setSelectedVariationOptionIdsByType] = useState<Record<string, string[]>>({});
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(SHOP_PAGE_SIZE_DESKTOP);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialProducts.length > 0) {
      setLoading(false);
      return;
    }

    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAllProducts();
        setProducts(data ?? []);
      } catch (fetchError) {
        console.error(fetchError);
        setError("Failed to load products. Please refresh.");
      } finally {
        setLoading(false);
      }
    };

    void fetchProducts();
  }, [initialProducts.length]);

  const categoryFilterItems = useMemo(() => {
    const sourceCategories = initialCategories.length > 0 ? initialCategories : storefrontCategories;
    const fromBackend = sourceCategories
      .map((category) => ({
        slug: category.slug.trim().toLowerCase(),
        label: category.name.trim() || "Category",
      }))
      .filter((category) => Boolean(category.slug));

    if (fromBackend.length > 0) {
      return fromBackend;
    }

    const seen = new Set<string>();
    return products
      .map((product) => ({
        slug: (product.categories?.slug ?? "").trim().toLowerCase(),
        label: (product.categories?.name ?? "").trim(),
      }))
      .filter((category) => {
        if (!category.slug || seen.has(category.slug)) {
          return false;
        }

        seen.add(category.slug);
        return true;
      })
      .map((category) => ({
        slug: category.slug,
        label: category.label || "Category",
      }));
  }, [initialCategories, products, storefrontCategories]);
  const categoryLookup = useMemo(() => new Set(categoryFilterItems.map((item) => item.slug)), [categoryFilterItems]);
  const requestedCategory = (searchParams.get("category") ?? "").trim().toLowerCase();
  const activeFilter: ShopFilter = requestedCategory && categoryLookup.has(requestedCategory) ? requestedCategory : "all";
  const normalizedSearchTerm = (searchParams.get("q") ?? "").trim().toLowerCase();

  const setActiveFilter = (nextFilter: ShopFilter) => {
    const nextParams = new URLSearchParams(searchParams);

    if (nextFilter === "all") {
      nextParams.delete("category");
    } else {
      nextParams.set("category", nextFilter);
    }

    const query = nextParams.toString();
    navigate(query ? `/shop?${query}` : "/shop");
  };

  const searchedProducts = useMemo(() => {
    if (!normalizedSearchTerm) {
      return products;
    }

    return products.filter((product) => {
      const fields = [
        product.name,
        product.short_description ?? "",
        product.description ?? "",
        product.categories?.name ?? "",
      ];

      return fields.some((field) => field.toLowerCase().includes(normalizedSearchTerm));
    });
  }, [normalizedSearchTerm, products]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const product of searchedProducts) {
      const slug = (product.categories?.slug ?? "").trim().toLowerCase();
      if (!slug) {
        continue;
      }

      counts[slug] = (counts[slug] ?? 0) + 1;
    }

    return counts;
  }, [searchedProducts]);

  const productsByCategoryAndSearch = useMemo(() => {
    if (activeFilter === "all") {
      return searchedProducts;
    }

    return searchedProducts.filter((product) => (product.categories?.slug ?? "").trim().toLowerCase() === activeFilter);
  }, [activeFilter, searchedProducts]);

  const variationFilterTypes = useMemo(
    () => collectVariationFilterTypes(productsByCategoryAndSearch),
    [productsByCategoryAndSearch],
  );

  useEffect(() => {
    setSelectedVariationOptionIdsByType((current) => {
      const { next, changed } = sanitizeSelectedVariationFilters(current, variationFilterTypes);
      return changed ? next : current;
    });
  }, [variationFilterTypes]);

  const priceCeiling = useMemo(() => {
    const maxProductPrice = products.reduce((max, product) => Math.max(max, Number(product.price) || 0), 0);
    if (maxProductPrice <= DEFAULT_PRICE_CEILING) {
      return DEFAULT_PRICE_CEILING;
    }

    return Math.ceil(maxProductPrice / 100) * 100;
  }, [products]);

  useEffect(() => {
    setPriceLimit(priceCeiling);
  }, [priceCeiling]);

  const filteredProducts = useMemo(() => {
    const afterVariationFilters = productsByCategoryAndSearch.filter((product) =>
      productMatchesVariationFilters(product, selectedVariationOptionIdsByType),
    );

    const afterPriceFilter = afterVariationFilters.filter((product) => Number(product.price) <= priceLimit);
    const next = [...afterPriceFilter];

    switch (sortBy) {
      case "price-low":
        next.sort((left, right) => Number(left.price) - Number(right.price));
        break;
      case "price-high":
        next.sort((left, right) => Number(right.price) - Number(left.price));
        break;
      case "popular":
        next.sort((left, right) => {
          if ((left.is_featured ?? false) === (right.is_featured ?? false)) {
            return left.name.localeCompare(right.name);
          }

          return left.is_featured ? -1 : 1;
        });
        break;
      case "newest":
      default:
        break;
    }

    return next;
  }, [priceLimit, productsByCategoryAndSearch, selectedVariationOptionIdsByType, sortBy]);

  const shopPageSize = isMobile ? SHOP_PAGE_SIZE_MOBILE : SHOP_PAGE_SIZE_DESKTOP;
  const visibleProducts = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);
  const hasMoreProducts = visibleCount < filteredProducts.length;

  useEffect(() => {
    setVisibleCount(shopPageSize);
  }, [filteredProducts, shopPageSize]);

  useEffect(() => {
    const loadMoreNode = loadMoreRef.current;
    if (!loadMoreNode || loading || !hasMoreProducts) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) {
          return;
        }

        setVisibleCount((current) => Math.min(current + shopPageSize, filteredProducts.length));
      },
      {
        root: null,
        rootMargin: "320px 0px",
        threshold: 0,
      },
    );

    observer.observe(loadMoreNode);
    return () => {
      observer.disconnect();
    };
  }, [filteredProducts.length, hasMoreProducts, isMobile, loading, shopPageSize, visibleProducts.length]);

  const toggleVariationFilterOption = (typeId: string, optionId: string) => {
    setSelectedVariationOptionIdsByType((current) => {
      const currentSelected = current[typeId] ?? [];
      const nextSelected = currentSelected.includes(optionId)
        ? currentSelected.filter((id) => id !== optionId)
        : [...currentSelected, optionId];

      const next = { ...current };
      if (nextSelected.length === 0) {
        delete next[typeId];
      } else {
        next[typeId] = nextSelected;
      }

      return next;
    });
  };

  const clearAllFilters = () => {
    setSelectedVariationOptionIdsByType({});
    setPriceLimit(priceCeiling);
    setActiveFilter("all");
  };

  const selectedVariationCount = Object.values(selectedVariationOptionIdsByType).reduce((sum, values) => sum + values.length, 0);
  const activeFilterCount =
    (activeFilter === "all" ? 0 : 1) +
    selectedVariationCount +
    (priceLimit < priceCeiling ? 1 : 0);

  const handleAddToCart = (product: Product) => {
    const basePayload = {
      product_id: product.id,
      name: product.name,
      slug: product.slug,
      category: product.categories?.name?.trim() || "Collection",
      image_url: getPrimaryImage(product),
      image_alt: product.name,
    };

    if (product.has_variants) {
      const firstAvailableVariant = (product.product_variants ?? []).find(
        (variant) => variant.is_available && variant.stock_quantity > 0,
      );

      if (!firstAvailableVariant) {
        return;
      }

      const optionValueById = new Map<string, string>();
      for (const optionType of product.product_option_types ?? []) {
        for (const optionValue of optionType.product_option_values) {
          const label = optionValue.value.trim();
          if (label) {
            optionValueById.set(optionValue.id, label);
          }
        }
      }

      const derivedVariantLabel = firstAvailableVariant.product_variant_options
        .map((optionLink) => optionValueById.get(optionLink.option_value_id) ?? "")
        .filter(Boolean)
        .join(" / ");

      addToCart({
        ...basePayload,
        price: firstAvailableVariant.price ?? product.price,
        compare_at_price: firstAvailableVariant.compare_at_price ?? product.compare_at_price ?? null,
        sku: firstAvailableVariant.sku ?? product.sku ?? null,
        stock_quantity: firstAvailableVariant.stock_quantity,
        variant_id: firstAvailableVariant.id,
        variant_label: firstAvailableVariant.label?.trim() || derivedVariantLabel || null,
      });
      return;
    }

    if (!isInStock(product)) {
      return;
    }

    addToCart({
      ...basePayload,
      price: product.price,
      compare_at_price: product.compare_at_price ?? null,
      sku: product.sku ?? null,
      stock_quantity: getStockQuantity(product),
      variant_id: null,
      variant_label: null,
    });
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-14 md:py-16">
        <ProductFetchErrorState />
      </div>
    );
  }

  return (
    <div className="bg-surface font-manrope text-on-surface">
      <header className="mx-auto max-w-screen-2xl px-4 pb-10 pt-14 md:px-8 md:pb-12 md:pt-16">
        <h1 className="font-notoSerif text-6xl font-bold tracking-tight text-on-background md:text-8xl">
          The <span className="italic text-primary">Shop</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-on-surface-variant">
          Shop stylish, carefully selected clothing that brings together trend, elegance, and confidence.
        </p>
      </header>

      <main className="mx-auto grid max-w-screen-2xl grid-cols-1 gap-10 px-4 pb-16 md:grid-cols-12 md:gap-12 md:px-8">
        <aside className="hidden md:col-span-3 md:block md:pr-2">
          <div className="md:sticky md:top-24 md:max-h-[calc(100dvh-7.5rem)] md:overflow-y-auto md:overscroll-contain lux-hide-scrollbar">
            <FilterPanel
              activeFilter={activeFilter}
              activeFilterCount={activeFilterCount}
              categoryCounts={categoryCounts}
              categoryFilterItems={categoryFilterItems}
              clearAllFilters={clearAllFilters}
              priceCeiling={priceCeiling}
              priceLimit={priceLimit}
              selectedVariationOptionIdsByType={selectedVariationOptionIdsByType}
              setActiveFilter={setActiveFilter}
              setPriceLimit={setPriceLimit}
              toggleVariationFilterOption={toggleVariationFilterOption}
              variationFilterTypes={variationFilterTypes}
            />
          </div>
        </aside>

        <div className="md:col-span-9">
          <div className="mb-8 flex flex-col items-start justify-between gap-4 border-b border-outline-variant/30 pb-4 sm:flex-row sm:items-center">
            <p className="text-sm text-on-surface-variant">
              Showing {loading ? 0 : visibleProducts.length} results of {loading ? 0 : filteredProducts.length} items
            </p>
            <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-outline-variant bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant transition-colors hover:border-primary hover:text-primary md:hidden"
              >
                <span className="material-symbols-outlined text-base">tune</span>
                Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
              </button>
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Sort By</span>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortKey)}
                  className="cursor-pointer border-none bg-transparent p-0 text-sm font-semibold text-primary focus:ring-0"
                >
                  <option value="newest">Newest Arrivals</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="popular">Most Popular</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-2 sm:gap-x-7 sm:gap-y-14 lg:grid-cols-3">
              {Array.from({ length: shopPageSize }).map((_, index) => (
                <div key={`shop-skeleton-${index}`} className="animate-pulse">
                  <div className="mb-6 aspect-[4/5] rounded-lg bg-surface-container-lowest" />
                  <div className="h-5 w-2/3 rounded bg-surface-container-high" />
                  <div className="mt-2 h-4 w-1/2 rounded bg-surface-container-high" />
                </div>
              ))}
            </div>
          ) : visibleProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-2 sm:gap-x-7 sm:gap-y-14 lg:grid-cols-3">
              {visibleProducts.map((product) => (
                <StorefrontProductCard
                  key={product.id}
                  product={product}
                  onAction={handleAddToCart}
                  actionLabel="Add to Cart"
                />
              ))}
            </div>
          ) : (
            <div className="rounded border border-outline-variant bg-surface-container-low px-6 py-10 text-center">
              <p className="font-manrope text-sm text-on-surface-variant">No products match the selected filters.</p>
            </div>
          )}

          {!loading && visibleProducts.length > 0 ? (
            <div className="mt-10">
              <div ref={loadMoreRef} className="h-1 w-full" aria-hidden />
              <p className="mt-4 text-center font-manrope text-xs uppercase tracking-[0.12em] text-on-surface-variant">
                {hasMoreProducts ? "Loading more products as you scroll" : "You have reached the end"}
              </p>
            </div>
          ) : null}
        </div>
      </main>

      <Drawer open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
        <DrawerContent className="max-h-[88vh] border-outline-variant/50 bg-surface">
          <DrawerHeader className="border-b border-outline-variant/30 pb-4">
            <div className="flex items-center justify-between">
              <DrawerTitle className="font-notoSerif text-2xl font-bold">Filter Products</DrawerTitle>
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant text-on-surface-variant"
                aria-label="Close filters"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6 pt-3">
            <FilterPanel
              activeFilter={activeFilter}
              activeFilterCount={activeFilterCount}
              categoryCounts={categoryCounts}
              categoryFilterItems={categoryFilterItems}
              clearAllFilters={clearAllFilters}
              priceCeiling={priceCeiling}
              priceLimit={priceLimit}
              selectedVariationOptionIdsByType={selectedVariationOptionIdsByType}
              setActiveFilter={setActiveFilter}
              setPriceLimit={setPriceLimit}
              toggleVariationFilterOption={toggleVariationFilterOption}
              variationFilterTypes={variationFilterTypes}
            />
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(false)}
              className="mt-5 w-full rounded-md bg-primary px-4 py-3 font-manrope text-sm font-semibold uppercase tracking-[0.14em] text-on-primary"
            >
              Show {filteredProducts.length} Results
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Shop;
