import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useStorefrontConfig } from "@/contexts/StorefrontConfigContext";
import { useThemeConfig } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import {
  createAdminProduct,
  deleteAdminProduct,
  deleteProductImageFromStorage,
  fetchAdminCategories,
  fetchAdminProductById,
  fetchProductOrderCount,
  normalizeProductImages,
  updateAdminProduct,
  uploadProductImage,
  type ProductImageObject,
} from "@/services/adminService";

interface BenefitItem {
  id: string;
  icon: string;
  label: string;
  description: string;
}

interface AIFillResult {
  short_description?: string;
  full_description?: string;
  meta_title?: string;
  meta_description?: string;
  tags?: string[];
  benefits?: Array<{
    icon?: string;
    label?: string;
    description?: string;
  }>;
  sku_suggestion?: string;
  weight_grams?: number;
}

interface AIFillFunctionResponse {
  success?: boolean;
  message?: string;
  data?: AIFillResult;
  used_image?: boolean;
}

interface OptionValueState {
  local_id: string;
  id?: string;
  option_type_id?: string;
  value: string;
  color_hex: string | null;
  display_order: number;
}

interface OptionTypeState {
  local_id: string;
  id?: string;
  product_id?: string;
  name: string;
  display_order: number;
  values: OptionValueState[];
}

interface VariantOptionSelection {
  option_type_local_id: string;
  option_value_local_id: string;
}

interface ProductVariant {
  local_id: string;
  id?: string;
  product_id?: string;
  label: string;
  options: VariantOptionSelection[];
  price: number | null;
  compare_at_price: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  sku: string;
  is_available: boolean;
  display_order: number;
  isNew?: boolean;
  isDirty?: boolean;
  isDeleted?: boolean;
}

interface OptionValueDraftState {
  value: string;
  withColor: boolean;
  color_hex: string;
}

const iconOptions = [
  "leaf",
  "droplet",
  "shield",
  "star",
  "check-circle",
  "heart",
  "flask",
  "sun",
  "moon",
  "sparkle",
  "zap",
  "award",
];

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const categoryCodeFromSlug = (slug: string) => {
  if (!slug) return "PR";
  if (slug.includes("hair")) return "HC";
  if (slug.includes("men")) return "MF";
  if (slug.includes("women")) return "WF";
  if (slug.includes("bag")) return "BG";
  if (slug.includes("shoe")) return "SH";
  return slug.slice(0, 2).toUpperCase();
};

const generateSkuValue = (categorySlug: string) => {
  const code = categoryCodeFromSlug(categorySlug);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `LUX-${code}-${random}`;
};

const numberOrNull = (value: string) => {
  if (!value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseTagsFromJson = (value: unknown) => {
  if (!Array.isArray(value)) return [] as string[];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
};

const parseBenefitsFromJson = (value: unknown) => {
  if (!Array.isArray(value)) return [] as BenefitItem[];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      return {
        id: String(record.id || crypto.randomUUID()),
        icon: typeof record.icon === "string" ? record.icon : "star",
        label: typeof record.label === "string" ? record.label : "",
        description: typeof record.description === "string" ? record.description : "",
      };
    })
    .filter((entry): entry is BenefitItem => Boolean(entry));
};

const toImageJson = (images: ProductImageObject[]) =>
  images.map((image, index) => ({
    url: image.url,
    alt_text: image.alt_text,
    is_primary: index === 0,
    display_order: index,
  }));

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

const sectionLabelClass =
  "mb-6 border-t border-[var(--color-border)] pt-8 font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]";

const normalizeSkuToken = (value: string | null | undefined, fallback = "VAR") => {
  const token = (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 4);
  return token || fallback;
};

const normalizeHexColor = (value: string | null | undefined) => {
  if (!value) return null;
  const normalized = value.trim();
  return /^#[A-Fa-f0-9]{6}$/.test(normalized) ? normalized.toUpperCase() : null;
};

const createRandomVariantCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const toComboKey = (options: VariantOptionSelection[]) =>
  options
    .map((option) => `${option.option_type_local_id}:${option.option_value_local_id}`)
    .sort()
    .join("|");

const mapOptionTypeRowToState = (row: Record<string, unknown>, index: number): OptionTypeState => {
  const optionValues = Array.isArray(row.product_option_values) ? (row.product_option_values as Array<Record<string, unknown>>) : [];
  return {
    local_id: typeof row.id === "string" ? row.id : crypto.randomUUID(),
    id: typeof row.id === "string" ? row.id : undefined,
    product_id: typeof row.product_id === "string" ? row.product_id : undefined,
    name: typeof row.name === "string" ? row.name : "",
    display_order:
      Number.isFinite(Number(row.display_order)) && Number(row.display_order) >= 0 ? Math.trunc(Number(row.display_order)) : index,
    values: optionValues
      .map((valueRow, valueIndex) => ({
        local_id: typeof valueRow.id === "string" ? valueRow.id : crypto.randomUUID(),
        id: typeof valueRow.id === "string" ? valueRow.id : undefined,
        option_type_id: typeof valueRow.option_type_id === "string" ? valueRow.option_type_id : undefined,
        value: typeof valueRow.value === "string" ? valueRow.value : "",
        color_hex: normalizeHexColor(typeof valueRow.color_hex === "string" ? valueRow.color_hex : null),
        display_order:
          Number.isFinite(Number(valueRow.display_order)) && Number(valueRow.display_order) >= 0
            ? Math.trunc(Number(valueRow.display_order))
            : valueIndex,
      }))
      .sort((a, b) => a.display_order - b.display_order),
  };
};

const AdminProductEditorPage = () => {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const productImagesInputRef = useRef<HTMLInputElement | null>(null);
  const { storefrontConfig } = useStorefrontConfig();
  const {
    preset: {
      tokens: { primary: primaryThemeColor },
    },
  } = useThemeConfig();

  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [currentProductName, setCurrentProductName] = useState("");
  const [currentProductSnapshot, setCurrentProductSnapshot] = useState<unknown>(null);
  const [hasOrderUsage, setHasOrderUsage] = useState<number | null>(null);
  const [confirmDeleteValue, setConfirmDeleteValue] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugEditable, setIsSlugEditable] = useState(false);
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sku, setSku] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [weightGrams, setWeightGrams] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [benefits, setBenefits] = useState<BenefitItem[]>([]);
  const [images, setImages] = useState<ProductImageObject[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [aiLoading, setAILoading] = useState(false);
  const [aiError, setAIError] = useState<string | null>(null);
  const [aiSuccessMessage, setAISuccessMessage] = useState<string | null>(null);
  const [aiMessageVisible, setAIMessageVisible] = useState(false);
  const [selectedProductImageForAI, setSelectedProductImageForAI] = useState<File | null>(null);
  const [pendingProductImageFiles, setPendingProductImageFiles] = useState<File[]>([]);
  const [hasVariants, setHasVariants] = useState(false);
  const [optionTypes, setOptionTypes] = useState<OptionTypeState[]>([]);
  const [newOptionTypeName, setNewOptionTypeName] = useState("");
  const [valueDrafts, setValueDrafts] = useState<Record<string, OptionValueDraftState>>({});
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [variantToggleWarning, setVariantToggleWarning] = useState(false);
  const [confirmDeleteVariantId, setConfirmDeleteVariantId] = useState<string | null>(null);
  const [editingPriceVariantId, setEditingPriceVariantId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadCategories = async () => {
      try {
        const categoryRows = await fetchAdminCategories();
        if (!isMounted) return;
        setCategories(categoryRows.map((row) => ({ id: row.id, name: row.name, slug: row.slug })));
      } catch {
        if (!isMounted) return;
        setCategories([]);
      }
    };

    void loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isEditMode || !id) {
      return;
    }

    let isMounted = true;

    const loadProduct = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [product, usageCount, optionTypesResponse, variantsResponse] = await Promise.all([
          fetchAdminProductById(id),
          fetchProductOrderCount(id),
          (supabase as any)
            .from("product_option_types")
            .select(
              `
              *,
              product_option_values (*)
            `,
            )
            .eq("product_id", id)
            .order("display_order", { ascending: true }),
          (supabase as any)
            .from("product_variants")
            .select(
              `
              *,
              product_variant_options (
                option_type_id,
                option_value_id
              )
            `,
            )
            .eq("product_id", id)
            .order("display_order", { ascending: true }),
        ]);

        if (optionTypesResponse.error) {
          throw optionTypesResponse.error;
        }

        if (variantsResponse.error) {
          throw variantsResponse.error;
        }

        if (!isMounted) return;
        const productRecord = product as Record<string, unknown>;
        const existingOptionTypes = (optionTypesResponse.data ?? []) as Array<Record<string, unknown>>;
        const existingVariants = (variantsResponse.data ?? []) as Array<Record<string, unknown>>;
        const mappedOptionTypes = existingOptionTypes.map((row, index) => mapOptionTypeRowToState(row, index));
        const optionTypeIdToLocalId = new Map(
          mappedOptionTypes.filter((optionType) => optionType.id).map((optionType) => [optionType.id as string, optionType.local_id]),
        );
        const optionValueIdToLocalId = new Map<string, string>();
        const optionValueByLocalId = new Map<string, OptionValueState>();

        mappedOptionTypes.forEach((optionType) => {
          optionType.values.forEach((optionValue) => {
            if (optionValue.id) {
              optionValueIdToLocalId.set(optionValue.id, optionValue.local_id);
            }
            optionValueByLocalId.set(optionValue.local_id, optionValue);
          });
        });

        const mappedVariants: ProductVariant[] = existingVariants.map((variant, index) => {
          const links = Array.isArray(variant.product_variant_options)
            ? (variant.product_variant_options as Array<Record<string, unknown>>)
            : [];
          const options = links
            .map((link) => {
              const optionTypeId = typeof link.option_type_id === "string" ? link.option_type_id : "";
              const optionValueId = typeof link.option_value_id === "string" ? link.option_value_id : "";
              const optionTypeLocalId = optionTypeIdToLocalId.get(optionTypeId);
              const optionValueLocalId = optionValueIdToLocalId.get(optionValueId);
              if (!optionTypeLocalId || !optionValueLocalId) return null;
              return {
                option_type_local_id: optionTypeLocalId,
                option_value_local_id: optionValueLocalId,
              };
            })
            .filter((entry): entry is VariantOptionSelection => Boolean(entry));

          const derivedLabel = options
            .map((entry) => optionValueByLocalId.get(entry.option_value_local_id)?.value ?? "")
            .filter(Boolean)
            .join(" / ");

          return {
            local_id: typeof variant.id === "string" ? variant.id : crypto.randomUUID(),
            id: typeof variant.id === "string" ? variant.id : undefined,
            product_id: typeof variant.product_id === "string" ? variant.product_id : undefined,
            label:
              typeof variant.label === "string" && variant.label.trim().length > 0
                ? variant.label
                : derivedLabel || `Variant ${index + 1}`,
            options,
            price: typeof variant.price === "number" ? variant.price : null,
            compare_at_price: typeof variant.compare_at_price === "number" ? variant.compare_at_price : null,
            stock_quantity:
              Number.isFinite(Number(variant.stock_quantity)) ? Math.max(0, Math.trunc(Number(variant.stock_quantity))) : 0,
            low_stock_threshold:
              Number.isFinite(Number(variant.low_stock_threshold)) && Number(variant.low_stock_threshold) >= 0
                ? Math.trunc(Number(variant.low_stock_threshold))
                : 5,
            sku: typeof variant.sku === "string" ? variant.sku : "",
            is_available: variant.is_available !== false,
            display_order:
              Number.isFinite(Number(variant.display_order)) && Number(variant.display_order) >= 0
                ? Math.trunc(Number(variant.display_order))
                : index,
            isNew: false,
            isDirty: false,
            isDeleted: false,
          };
        });

        setCurrentProductSnapshot(product);
        setCurrentProductName(product.name || "");
        setName(product.name || "");
        setSlug(product.slug || "");
        setShortDescription(product.short_description || "");
        setDescription(product.description || "");
        setPrice(product.price?.toString() || "");
        setCompareAtPrice(product.compare_at_price?.toString() || "");
        setCostPrice(product.cost_price?.toString() || "");
        setSku(product.sku || "");
        setStockQuantity(product.stock_quantity?.toString() || "0");
        setLowStockThreshold(product.low_stock_threshold?.toString() || "5");
        setWeightGrams(product.weight_grams?.toString() || "");
        setCategoryId(product.category_id || "");
        setTags(parseTagsFromJson(product.tags));
        setMetaTitle(product.meta_title || "");
        setMetaDescription(product.meta_description || "");
        setBenefits(parseBenefitsFromJson(product.benefits));
        setImages(normalizeProductImages(product.images));
        setIsAvailable(Boolean(product.is_available));
        setIsFeatured(Boolean(product.is_featured));
        setHasVariants(Boolean(productRecord.has_variants) || mappedVariants.length > 0);
        setOptionTypes(mappedOptionTypes);
        setNewOptionTypeName("");
        setValueDrafts({});
        setVariants(mappedVariants);
        setVariantToggleWarning(false);
        setHasOrderUsage(usageCount);
      } catch {
        if (!isMounted) return;
        setLoadError("Unable to load product.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadProduct();

    return () => {
      isMounted = false;
    };
  }, [id, isEditMode]);

  useEffect(() => {
    if (isEditMode) return;
    setHasVariants(false);
    setOptionTypes([]);
    setNewOptionTypeName("");
    setValueDrafts({});
    setVariants([]);
    setVariantToggleWarning(false);
    setConfirmDeleteVariantId(null);
    setEditingPriceVariantId(null);
    setEditingPriceValue("");
  }, [isEditMode]);

  useEffect(() => {
    if (isSlugEditable) return;
    setSlug(slugify(name));
  }, [name, isSlugEditable]);

  useEffect(() => {
    if (!saveMessage) return;
    const timeout = window.setTimeout(() => setSaveMessage(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [saveMessage]);

  useEffect(() => {
    if (!aiSuccessMessage && !aiError) return;
    setAIMessageVisible(true);

    const fadeTimer = window.setTimeout(() => setAIMessageVisible(false), 5000);
    const clearTimer = window.setTimeout(() => {
      setAISuccessMessage(null);
      setAIError(null);
    }, 5400);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [aiSuccessMessage, aiError]);

  const queuedImagePreviewUrl = useMemo(() => {
    const firstQueuedFile = pendingProductImageFiles[0];
    if (!firstQueuedFile) {
      return null;
    }
    return URL.createObjectURL(firstQueuedFile);
  }, [pendingProductImageFiles]);

  useEffect(() => {
    return () => {
      if (queuedImagePreviewUrl) {
        URL.revokeObjectURL(queuedImagePreviewUrl);
      }
    };
  }, [queuedImagePreviewUrl]);

  const selectedCategory = useMemo(() => categories.find((category) => category.id === categoryId) ?? null, [categories, categoryId]);
  const categorySlug = selectedCategory?.slug ?? "";
  const selectedCategoryName = selectedCategory?.name ?? "";
  const optionValueByLocalId = useMemo(() => {
    const next = new Map<string, { optionType: OptionTypeState; optionValue: OptionValueState }>();
    optionTypes.forEach((optionType) => {
      optionType.values.forEach((optionValue) => {
        next.set(optionValue.local_id, { optionType, optionValue });
      });
    });
    return next;
  }, [optionTypes]);
  const activeVariants = useMemo(() => variants.filter((variant) => !variant.isDeleted), [variants]);
  const parsedLowStockThreshold = useMemo(() => {
    const numeric = Number(lowStockThreshold || 5);
    if (!Number.isFinite(numeric)) return 5;
    return Math.max(0, Math.trunc(numeric));
  }, [lowStockThreshold]);
  const totalVariantStock = useMemo(
    () => activeVariants.reduce((sum, variant) => sum + Math.max(0, variant.stock_quantity), 0),
    [activeVariants],
  );
  const availableVariantCount = useMemo(
    () => activeVariants.filter((variant) => variant.is_available).length,
    [activeVariants],
  );
  const outOfStockVariantCount = useMemo(
    () => activeVariants.filter((variant) => variant.stock_quantity <= 0).length,
    [activeVariants],
  );
  const activeOptionTypes = useMemo(
    () =>
      optionTypes
        .map((optionType, index) => ({
          ...optionType,
          display_order: index,
          values: optionType.values
            .filter((optionValue) => optionValue.value.trim().length > 0)
            .map((optionValue, valueIndex) => ({ ...optionValue, display_order: valueIndex })),
        }))
        .filter((optionType) => optionType.name.trim().length > 0),
    [optionTypes],
  );

  const buildVariantLabelFromOptions = (options: VariantOptionSelection[]) => {
    const values = options
      .map((optionSelection) => optionValueByLocalId.get(optionSelection.option_value_local_id)?.optionValue.value ?? "")
      .filter(Boolean);
    return values.join(" / ");
  };

  const buildVariantSku = (options: VariantOptionSelection[]) => {
    const baseSku = sku.trim().toUpperCase() || `LUX-VAR-${createRandomVariantCode()}`;
    const suffix = options
      .map((optionSelection) => {
        const valueName = optionValueByLocalId.get(optionSelection.option_value_local_id)?.optionValue.value ?? "";
        return normalizeSkuToken(valueName, "VAR");
      })
      .join("-");
    return suffix ? `${baseSku}-${suffix}` : `${baseSku}-${createRandomVariantCode()}`;
  };

  const updateVariantRow = (localId: string, updater: (variant: ProductVariant) => ProductVariant) => {
    setVariants((current) =>
      current.map((variant) => {
        if (variant.local_id !== localId) return variant;
        const next = updater(variant);
        return next.isNew ? next : { ...next, isDirty: true };
      }),
    );
  };

  const onToggleHasVariants = () => {
    if (hasVariants) {
      const hasExistingRows = activeVariants.length > 0;
      setHasVariants(false);
      setVariantToggleWarning(hasExistingRows);
      return;
    }
    setHasVariants(true);
    setVariantToggleWarning(false);
  };

  const onAddOptionType = () => {
    const normalizedName = newOptionTypeName.trim();
    if (!normalizedName) {
      return;
    }

    const duplicate = optionTypes.some((optionType) => optionType.name.trim().toLowerCase() === normalizedName.toLowerCase());
    if (duplicate) {
      setSaveMessage("Option type already exists on this product.");
      return;
    }

    const localId = crypto.randomUUID();
    setOptionTypes((current) => [
      ...current,
      {
        local_id: localId,
        name: normalizedName,
        display_order: current.length,
        values: [],
      },
    ]);
    setValueDrafts((current) => ({
      ...current,
      [localId]: {
        value: "",
        withColor: false,
        color_hex: primaryThemeColor,
      },
    }));
    setNewOptionTypeName("");
  };

  const onUpdateOptionTypeName = (localId: string, value: string) => {
    setOptionTypes((current) =>
      current.map((optionType) => (optionType.local_id === localId ? { ...optionType, name: value } : optionType)),
    );
  };

  const onRemoveOptionType = (localId: string) => {
    const inUse = activeVariants.some((variant) =>
      variant.options.some((optionSelection) => optionSelection.option_type_local_id === localId),
    );
    if (inUse && !window.confirm("Delete this option type and all variants using it?")) {
      return;
    }

    setOptionTypes((current) => current.filter((optionType) => optionType.local_id !== localId));
    setValueDrafts((current) => {
      const next = { ...current };
      delete next[localId];
      return next;
    });
    setVariants((current) =>
      current.map((variant) =>
        variant.options.some((optionSelection) => optionSelection.option_type_local_id === localId)
          ? { ...variant, isDeleted: true, isDirty: true }
          : variant,
      ),
    );
  };

  const onUpdateValueDraft = (optionTypeLocalId: string, updater: (current: OptionValueDraftState) => OptionValueDraftState) => {
    setValueDrafts((current) => {
      const previous = current[optionTypeLocalId] ?? {
        value: "",
        withColor: false,
        color_hex: primaryThemeColor,
      };
      return {
        ...current,
        [optionTypeLocalId]: updater(previous),
      };
    });
  };

  const onAddOptionValue = (optionTypeLocalId: string) => {
    const draft = valueDrafts[optionTypeLocalId] ?? {
      value: "",
      withColor: false,
      color_hex: primaryThemeColor,
    };
    const normalizedValue = draft.value.trim();
    if (!normalizedValue) {
      return;
    }

    setOptionTypes((current) =>
      current.map((optionType) => {
        if (optionType.local_id !== optionTypeLocalId) return optionType;
        const duplicate = optionType.values.some((optionValue) => optionValue.value.trim().toLowerCase() === normalizedValue.toLowerCase());
        if (duplicate) {
          return optionType;
        }
        return {
          ...optionType,
          values: [
            ...optionType.values,
            {
              local_id: crypto.randomUUID(),
              value: normalizedValue,
              color_hex: draft.withColor ? normalizeHexColor(draft.color_hex) : null,
              display_order: optionType.values.length,
            },
          ],
        };
      }),
    );
    onUpdateValueDraft(optionTypeLocalId, () => ({
      value: "",
      withColor: draft.withColor,
      color_hex: draft.color_hex,
    }));
  };

  const onRemoveOptionValue = (optionTypeLocalId: string, optionValueLocalId: string) => {
    const inUse = activeVariants.some((variant) =>
      variant.options.some((optionSelection) => optionSelection.option_value_local_id === optionValueLocalId),
    );
    if (inUse && !window.confirm("Delete this value and all variants using it?")) {
      return;
    }

    setOptionTypes((current) =>
      current.map((optionType) =>
        optionType.local_id === optionTypeLocalId
          ? {
              ...optionType,
              values: optionType.values.filter((optionValue) => optionValue.local_id !== optionValueLocalId),
            }
          : optionType,
      ),
    );
    setVariants((current) =>
      current.map((variant) =>
        variant.options.some((optionSelection) => optionSelection.option_value_local_id === optionValueLocalId)
          ? { ...variant, isDeleted: true, isDirty: true }
          : variant,
      ),
    );
  };

  const onGenerateVariants = () => {
    const validOptionTypes = activeOptionTypes.filter((optionType) => optionType.values.length > 0);
    if (validOptionTypes.length === 0) {
      setSaveMessage("Add at least one option type with values before generating variants.");
      return;
    }

    const valueArrays = validOptionTypes.map((optionType) =>
      optionType.values.map((optionValue) => ({
        option_type_local_id: optionType.local_id,
        option_value_local_id: optionValue.local_id,
      })),
    );

    const combinations = valueArrays.reduce<VariantOptionSelection[][]>(
      (accumulator, currentValues) =>
        accumulator.flatMap((combo) => currentValues.map((item) => [...combo, item])),
      [[]],
    );

    const existingByKey = new Map(
      activeVariants.map((variant) => [toComboKey(variant.options), variant] as const),
    );
    const generatedKeys = new Set<string>();

    const generatedVariants = combinations.map((combo, index) => {
      const key = toComboKey(combo);
      generatedKeys.add(key);
      const existing = existingByKey.get(key);
      if (existing) {
        return {
          ...existing,
          label: existing.label?.trim() || buildVariantLabelFromOptions(combo),
          options: combo,
          display_order: index,
        };
      }

      return {
        local_id: crypto.randomUUID(),
        label: buildVariantLabelFromOptions(combo),
        options: combo,
        price: null,
        compare_at_price: null,
        stock_quantity: 0,
        low_stock_threshold: parsedLowStockThreshold,
        sku: buildVariantSku(combo),
        is_available: true,
        display_order: index,
        isNew: true,
        isDirty: false,
        isDeleted: false,
      } satisfies ProductVariant;
    });

    const unmatchedVariants = activeVariants
      .filter((variant) => !generatedKeys.has(toComboKey(variant.options)))
      .map((variant, index) => ({
        ...variant,
        display_order: generatedVariants.length + index,
      }));

    setVariants([...generatedVariants, ...unmatchedVariants]);
    setHasVariants(true);
    setVariantToggleWarning(false);
  };

  const onChangeVariantLabel = (localId: string, value: string) => {
    updateVariantRow(localId, (variant) => ({ ...variant, label: value }));
  };

  const onChangeVariantStock = (localId: string, value: string) => {
    const numeric = Math.max(0, Math.trunc(Number(value || 0)));
    updateVariantRow(localId, (variant) => ({ ...variant, stock_quantity: numeric }));
  };

  const onChangeVariantSku = (localId: string, value: string) => {
    updateVariantRow(localId, (variant) => ({ ...variant, sku: value.toUpperCase() }));
  };

  const onToggleVariantAvailable = (localId: string) => {
    updateVariantRow(localId, (variant) => ({ ...variant, is_available: !variant.is_available }));
  };

  const onConfirmDeleteVariant = (localId: string) => {
    updateVariantRow(localId, (variant) => ({ ...variant, isDeleted: true }));
    setConfirmDeleteVariantId(null);
  };

  const onStartEditingVariantPrice = (variant: ProductVariant) => {
    setEditingPriceVariantId(variant.local_id);
    setEditingPriceValue(variant.price === null ? "" : variant.price.toString());
  };

  const onSaveEditingVariantPrice = (localId: string) => {
    const nextPrice = numberOrNull(editingPriceValue);
    updateVariantRow(localId, (variant) => ({ ...variant, price: nextPrice }));
    setEditingPriceVariantId(null);
    setEditingPriceValue("");
  };

  const onClearVariantPrice = (localId: string) => {
    updateVariantRow(localId, (variant) => ({ ...variant, price: null }));
    setEditingPriceVariantId(null);
    setEditingPriceValue("");
  };

  const onAddTag = () => {
    const normalized = tagInput.trim();
    if (!normalized) return;
    if (tags.includes(normalized)) {
      setTagInput("");
      return;
    }
    setTags((current) => [...current, normalized]);
    setTagInput("");
  };

  const onAddBenefit = () => {
    if (benefits.length >= 6) return;
    setBenefits((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        icon: "star",
        label: "",
        description: "",
      },
    ]);
  };

  const onUpdateBenefit = (benefitId: string, key: keyof BenefitItem, value: string) => {
    setBenefits((current) =>
      current.map((benefit) => (benefit.id === benefitId ? { ...benefit, [key]: value } : benefit)),
    );
  };

  const onMoveBenefit = (benefitId: string, direction: "up" | "down") => {
    setBenefits((current) => {
      const index = current.findIndex((entry) => entry.id === benefitId);
      if (index < 0) return current;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, item);
      return copy;
    });
  };

  const onRemoveBenefit = (benefitId: string) => {
    setBenefits((current) => current.filter((benefit) => benefit.id !== benefitId));
  };

  const persistImages = async (nextImages: ProductImageObject[]) => {
    if (!id) return;
    await updateAdminProduct(
      id,
      {
        images: toImageJson(nextImages),
      },
      currentProductSnapshot as never,
    );
    setCurrentProductSnapshot((current) =>
      current && typeof current === "object" ? { ...(current as Record<string, unknown>), images: toImageJson(nextImages) } : current,
    );
  };

  const onUploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const list = Array.from(files);
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const validFiles = list.filter((file) => allowedTypes.includes(file.type) && file.size <= 2 * 1024 * 1024);
    const currentCount = id ? images.length : pendingProductImageFiles.length;
    const allowedCount = Math.max(0, 6 - currentCount);
    const filesToUpload = validFiles.slice(0, allowedCount);

    if (filesToUpload.length === 0) {
      return;
    }

    if (!id) {
      const queuedCount = Math.min(6, pendingProductImageFiles.length + filesToUpload.length);
      setPendingProductImageFiles((current) => [...current, ...filesToUpload].slice(0, 6));
      setSaveMessage(
        `${queuedCount} image${queuedCount === 1 ? "" : "s"} queued. They will upload automatically after first save.`,
      );
      return;
    }

    setSelectedProductImageForAI(filesToUpload[0]);

    setIsUploadingImage(true);
    try {
      const uploaded: ProductImageObject[] = [];
      for (const file of filesToUpload) {
        const result = await uploadProductImage(id, file);
        uploaded.push({
          url: result.url,
          alt_text: name || file.name,
          is_primary: false,
          display_order: 0,
        });
      }

      const merged = [...images, ...uploaded].map((image, index) => ({
        ...image,
        is_primary: index === 0,
        display_order: index,
      }));
      setImages(merged);
      await persistImages(merged);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const onReorderImage = async (index: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item);
    const normalized = next.map((image, currentIndex) => ({
      ...image,
      is_primary: currentIndex === 0,
      display_order: currentIndex,
    }));
    setImages(normalized);
    await persistImages(normalized);
  };

  const onRemoveImage = async (index: number) => {
    const target = images[index];
    if (!target) return;
    const next = images.filter((_, currentIndex) => currentIndex !== index).map((image, currentIndex) => ({
      ...image,
      is_primary: currentIndex === 0,
      display_order: currentIndex,
    }));
    setImages(next);
    if (target.url) {
      await deleteProductImageFromStorage(target.url);
    }
    await persistImages(next);
  };

  const onRemoveQueuedPreviewImage = () => {
    setPendingProductImageFiles((current) => current.slice(1));
  };

  const setFormField = (field: string, value: unknown) => {
    switch (field) {
      case "shortDescription":
        setShortDescription(typeof value === "string" ? value : "");
        return;
      case "fullDescription":
        setDescription(typeof value === "string" ? value : "");
        return;
      case "metaTitle":
        setMetaTitle(typeof value === "string" ? value : "");
        return;
      case "metaDescription":
        setMetaDescription(typeof value === "string" ? value : "");
        return;
      case "tags":
        setTags(parseTagsFromJson(value));
        return;
      case "benefits":
        setBenefits(parseBenefitsFromJson(value).slice(0, 6));
        return;
      case "sku":
        setSku(typeof value === "string" ? value : "");
        return;
      case "weight":
        setWeightGrams(typeof value === "string" ? value : "");
        return;
      default:
        return;
    }
  };

  const applyWithFlash = (field: string, value: unknown) => {
    setFormField(field, value);
    const element = document.getElementById(`field-${field}`);
    if (!element) {
      return;
    }

    element.style.transition = "none";
    element.style.background = "rgba(var(--color-navbar-solid-foreground-rgb),0.15)";

    window.setTimeout(() => {
      element.style.transition = "background 0.6s ease";
      element.style.background = "transparent";
    }, 50);
  };

  const handleAIFill = async () => {
    if (!name.trim()) return;

    setAILoading(true);
    setAIError(null);
    setAISuccessMessage(null);
    setAIMessageVisible(false);

    try {
      let imagePayload: { data: string; mimeType: string } | undefined;
      const selectedFileForAI = pendingProductImageFiles[0] ?? selectedProductImageForAI ?? null;

      if (selectedFileForAI) {
        const base64 = await fileToBase64(selectedFileForAI);
        imagePayload = {
          data: base64,
          mimeType: selectedFileForAI.type,
        };
      }

      const { data, error } = await supabase.functions.invoke("ai_product_autofill", {
        body: {
          product_name: name,
          category: selectedCategoryName || undefined,
          image: imagePayload,
        },
      });

      const response = (data ?? {}) as AIFillFunctionResponse;
      if (error || !response.success || !response.data) {
        setAIError(response.message || "AI fill failed. Please try again.");
        return;
      }

      const result = response.data;
      applyWithFlash("shortDescription", result.short_description ?? "");
      applyWithFlash("fullDescription", result.full_description ?? "");
      applyWithFlash("metaTitle", result.meta_title ?? "");
      applyWithFlash("metaDescription", result.meta_description ?? "");
      applyWithFlash("tags", result.tags ?? []);
      applyWithFlash("benefits", result.benefits ?? []);

      if (!sku.trim()) {
        applyWithFlash("sku", result.sku_suggestion ?? "");
      }

      if (!weightGrams.trim() && typeof result.weight_grams === "number") {
        applyWithFlash("weight", result.weight_grams.toString());
      }

      setAISuccessMessage(
        response.used_image ? "* Fields filled using product image" : "* Fields filled - review before saving",
      );
    } catch {
      setAIError("AI fill failed. Please try again.");
    } finally {
      setAILoading(false);
    }
  };

  const saveVariants = async (productId: string) => {
    const normalizedOptionTypes = activeOptionTypes.map((optionType, index) => ({
      ...optionType,
      name: optionType.name.trim(),
      display_order: index,
      values: optionType.values
        .map((optionValue, valueIndex) => ({
          ...optionValue,
          value: optionValue.value.trim(),
          color_hex: normalizeHexColor(optionValue.color_hex),
          display_order: valueIndex,
        }))
        .filter((optionValue) => optionValue.value.length > 0),
    }));

    const existingOptionTypeIds = normalizedOptionTypes
      .map((optionType) => optionType.id)
      .filter((optionTypeId): optionTypeId is string => Boolean(optionTypeId));

    const { data: existingOptionTypeRows, error: existingOptionTypeRowsError } = await (supabase as any)
      .from("product_option_types")
      .select("id")
      .eq("product_id", productId);
    if (existingOptionTypeRowsError) {
      throw existingOptionTypeRowsError;
    }

    const optionTypeIdsToDelete = ((existingOptionTypeRows ?? []) as Array<{ id: string }>)
      .map((row) => row.id)
      .filter((optionTypeId) => !existingOptionTypeIds.includes(optionTypeId));
    if (optionTypeIdsToDelete.length > 0) {
      const { error } = await (supabase as any).from("product_option_types").delete().in("id", optionTypeIdsToDelete);
      if (error) {
        throw error;
      }
    }

    const optionTypeDbIdByLocalId = new Map<string, string>();
    const optionValueDbIdByLocalId = new Map<string, string>();

    for (const optionType of normalizedOptionTypes) {
      let optionTypeId = optionType.id ?? null;

      if (optionTypeId) {
        const { error } = await (supabase as any)
          .from("product_option_types")
          .update({
            name: optionType.name,
            display_order: optionType.display_order,
          })
          .eq("id", optionTypeId);
        if (error) {
          throw error;
        }
      } else {
        const { data, error } = await (supabase as any)
          .from("product_option_types")
          .insert({
            product_id: productId,
            name: optionType.name,
            display_order: optionType.display_order,
          })
          .select("id")
          .single();
        if (error) {
          throw error;
        }
        optionTypeId = data?.id ?? null;
      }

      if (!optionTypeId) {
        throw new Error("Failed to persist option type");
      }

      optionTypeDbIdByLocalId.set(optionType.local_id, optionTypeId);

      const existingOptionValueIds = optionType.values
        .map((optionValue) => optionValue.id)
        .filter((optionValueId): optionValueId is string => Boolean(optionValueId));

      const { data: existingOptionValueRows, error: existingOptionValueRowsError } = await (supabase as any)
        .from("product_option_values")
        .select("id")
        .eq("option_type_id", optionTypeId);
      if (existingOptionValueRowsError) {
        throw existingOptionValueRowsError;
      }

      const optionValueIdsToDelete = ((existingOptionValueRows ?? []) as Array<{ id: string }>)
        .map((row) => row.id)
        .filter((optionValueId) => !existingOptionValueIds.includes(optionValueId));
      if (optionValueIdsToDelete.length > 0) {
        const { error } = await (supabase as any).from("product_option_values").delete().in("id", optionValueIdsToDelete);
        if (error) {
          throw error;
        }
      }

      for (const optionValue of optionType.values) {
        let optionValueId = optionValue.id ?? null;
        if (optionValueId) {
          const { error } = await (supabase as any)
            .from("product_option_values")
            .update({
              value: optionValue.value,
              color_hex: optionValue.color_hex,
              display_order: optionValue.display_order,
            })
            .eq("id", optionValueId);
          if (error) {
            throw error;
          }
        } else {
          const { data, error } = await (supabase as any)
            .from("product_option_values")
            .insert({
              option_type_id: optionTypeId,
              value: optionValue.value,
              color_hex: optionValue.color_hex,
              display_order: optionValue.display_order,
            })
            .select("id")
            .single();
          if (error) {
            throw error;
          }
          optionValueId = data?.id ?? null;
        }

        if (!optionValueId) {
          throw new Error("Failed to persist option value");
        }
        optionValueDbIdByLocalId.set(optionValue.local_id, optionValueId);
      }
    }

    const orderedActiveVariants = variants
      .filter((variant) => !variant.isDeleted)
      .map((variant, index) => ({
        ...variant,
        display_order: index,
      }));

    const toDelete = variants
      .filter((variant) => variant.isDeleted && variant.id)
      .map((variant) => variant.id)
      .filter((variantId): variantId is string => Boolean(variantId));
    if (toDelete.length > 0) {
      const { error } = await (supabase as any).from("product_variants").delete().in("id", toDelete);
      if (error) {
        throw error;
      }
    }

    for (const variant of orderedActiveVariants) {
      let variantId = variant.id ?? null;
      const label = variant.label.trim() || buildVariantLabelFromOptions(variant.options) || `Variant ${variant.display_order + 1}`;

      if (variantId) {
        const { error } = await (supabase as any)
          .from("product_variants")
          .update({
            label,
            price: variant.price ?? null,
            compare_at_price: variant.compare_at_price ?? null,
            stock_quantity: variant.stock_quantity,
            low_stock_threshold: variant.low_stock_threshold,
            sku: variant.sku || null,
            is_available: variant.is_available,
            display_order: variant.display_order,
            updated_at: new Date().toISOString(),
          })
          .eq("id", variantId);
        if (error) {
          throw error;
        }
      } else {
        const { data, error } = await (supabase as any)
          .from("product_variants")
          .insert({
            product_id: productId,
            label,
            price: variant.price ?? null,
            compare_at_price: variant.compare_at_price ?? null,
            stock_quantity: variant.stock_quantity,
            low_stock_threshold: variant.low_stock_threshold,
            sku: variant.sku || null,
            is_available: variant.is_available,
            display_order: variant.display_order,
          })
          .select("id")
          .single();
        if (error) {
          throw error;
        }
        variantId = data?.id ?? null;
      }

      if (!variantId) {
        throw new Error("Failed to persist variant");
      }

      const { error: clearOptionsError } = await (supabase as any)
        .from("product_variant_options")
        .delete()
        .eq("variant_id", variantId);
      if (clearOptionsError) {
        throw clearOptionsError;
      }

      const optionLinks = variant.options
        .map((optionSelection) => {
          const optionTypeId = optionTypeDbIdByLocalId.get(optionSelection.option_type_local_id);
          const optionValueId = optionValueDbIdByLocalId.get(optionSelection.option_value_local_id);
          if (!optionTypeId || !optionValueId) return null;
          return {
            variant_id: variantId,
            option_type_id: optionTypeId,
            option_value_id: optionValueId,
          };
        })
        .filter((entry): entry is { variant_id: string; option_type_id: string; option_value_id: string } => Boolean(entry));

      if (optionLinks.length > 0) {
        const { error: insertOptionsError } = await (supabase as any).from("product_variant_options").insert(optionLinks);
        if (insertOptionsError) {
          throw insertOptionsError;
        }
      }
    }

    const hasDynamicVariants = hasVariants && orderedActiveVariants.length > 0;
    const { error: hasVariantsError } = await supabase
      .from("products")
      .update({
        has_variants: hasDynamicVariants,
      } as never)
      .eq("id", productId);
    if (hasVariantsError) {
      throw hasVariantsError;
    }

    const [optionTypesResponse, variantsResponse] = await Promise.all([
      (supabase as any)
        .from("product_option_types")
        .select(
          `
          *,
          product_option_values (*)
        `,
        )
        .eq("product_id", productId)
        .order("display_order", { ascending: true }),
      (supabase as any)
        .from("product_variants")
        .select(
          `
          *,
          product_variant_options (
            option_type_id,
            option_value_id
          )
        `,
        )
        .eq("product_id", productId)
        .order("display_order", { ascending: true }),
    ]);

    if (optionTypesResponse.error) {
      throw optionTypesResponse.error;
    }
    if (variantsResponse.error) {
      throw variantsResponse.error;
    }

    const refreshedOptionTypes = (optionTypesResponse.data ?? []) as Array<Record<string, unknown>>;
    const mappedOptionTypes = refreshedOptionTypes.map((row, index) => mapOptionTypeRowToState(row, index));
    const optionTypeIdToLocalId = new Map(
      mappedOptionTypes.filter((optionType) => optionType.id).map((optionType) => [optionType.id as string, optionType.local_id]),
    );
    const optionValueIdToLocalId = new Map<string, string>();
    const optionValueNameByLocalId = new Map<string, string>();

    mappedOptionTypes.forEach((optionType) => {
      optionType.values.forEach((optionValue) => {
        if (optionValue.id) {
          optionValueIdToLocalId.set(optionValue.id, optionValue.local_id);
        }
        optionValueNameByLocalId.set(optionValue.local_id, optionValue.value);
      });
    });

    const refreshedVariants = (variantsResponse.data ?? []) as Array<Record<string, unknown>>;
    const mappedVariants = refreshedVariants.map((variant, index) => {
      const links = Array.isArray(variant.product_variant_options)
        ? (variant.product_variant_options as Array<Record<string, unknown>>)
        : [];
      const options = links
        .map((link) => {
          const optionTypeId = typeof link.option_type_id === "string" ? link.option_type_id : "";
          const optionValueId = typeof link.option_value_id === "string" ? link.option_value_id : "";
          const optionTypeLocalId = optionTypeIdToLocalId.get(optionTypeId);
          const optionValueLocalId = optionValueIdToLocalId.get(optionValueId);
          if (!optionTypeLocalId || !optionValueLocalId) return null;
          return {
            option_type_local_id: optionTypeLocalId,
            option_value_local_id: optionValueLocalId,
          };
        })
        .filter((entry): entry is VariantOptionSelection => Boolean(entry));
      const derivedLabel = options
        .map((entry) => optionValueNameByLocalId.get(entry.option_value_local_id) ?? "")
        .filter(Boolean)
        .join(" / ");

      return {
        local_id: typeof variant.id === "string" ? variant.id : crypto.randomUUID(),
        id: typeof variant.id === "string" ? variant.id : undefined,
        product_id: typeof variant.product_id === "string" ? variant.product_id : undefined,
        label:
          typeof variant.label === "string" && variant.label.trim().length > 0
            ? variant.label
            : derivedLabel || `Variant ${index + 1}`,
        options,
        price: typeof variant.price === "number" ? variant.price : null,
        compare_at_price: typeof variant.compare_at_price === "number" ? variant.compare_at_price : null,
        stock_quantity:
          Number.isFinite(Number(variant.stock_quantity)) ? Math.max(0, Math.trunc(Number(variant.stock_quantity))) : 0,
        low_stock_threshold:
          Number.isFinite(Number(variant.low_stock_threshold)) && Number(variant.low_stock_threshold) >= 0
            ? Math.trunc(Number(variant.low_stock_threshold))
            : 5,
        sku: typeof variant.sku === "string" ? variant.sku : "",
        is_available: variant.is_available !== false,
        display_order:
          Number.isFinite(Number(variant.display_order)) && Number(variant.display_order) >= 0
            ? Math.trunc(Number(variant.display_order))
            : index,
        isNew: false,
        isDirty: false,
        isDeleted: false,
      } satisfies ProductVariant;
    });

    setOptionTypes(mappedOptionTypes);
    setVariants(mappedVariants);
    setHasVariants(hasDynamicVariants);
    setValueDrafts({});
  };

  const save = async (asDraft = false) => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const payload = {
        name: name.trim(),
        slug: slugify(slug || name),
        short_description: shortDescription.trim() || null,
        description: description.trim() || null,
        category_id: categoryId || null,
        price: Number(price || 0),
        compare_at_price: numberOrNull(compareAtPrice),
        cost_price: numberOrNull(costPrice),
        sku: sku.trim() || null,
        stock_quantity: Number(stockQuantity || 0),
        low_stock_threshold: Number(lowStockThreshold || 5),
        has_variants: hasVariants,
        is_available: asDraft ? false : isAvailable,
        is_featured: isFeatured,
        images: toImageJson(images),
        benefits: benefits.map((benefit, index) => ({
          id: benefit.id,
          icon: benefit.icon,
          label: benefit.label,
          description: benefit.description,
          display_order: index,
        })),
        tags,
        weight_grams: numberOrNull(weightGrams),
        meta_title: metaTitle.trim() || null,
        meta_description: metaDescription.trim() || null,
      } as const;

      const missingRequiredFields: Array<{ label: string; section: string; fieldId: string }> = [];
      if (!payload.name) {
        missingRequiredFields.push({ label: "Product name", section: "Basic Information", fieldId: "field-name" });
      }
      if (!categoryId) {
        missingRequiredFields.push({ label: "Category", section: "Basic Information", fieldId: "field-category" });
      }
      if (!payload.price) {
        missingRequiredFields.push({ label: "Selling price", section: "Pricing & Inventory", fieldId: "field-price" });
      }

      if (missingRequiredFields.length > 0) {
        const message = missingRequiredFields.map((field) => `${field.label} (${field.section})`).join(", ");
        setSaveMessage(`Missing required fields: ${message}.`);

        const firstMissingField = document.getElementById(missingRequiredFields[0].fieldId);
        firstMissingField?.scrollIntoView({ behavior: "smooth", block: "center" });
        const focusTarget = firstMissingField?.querySelector<HTMLElement>("input, select, textarea, button");
        focusTarget?.focus();
        return;
      }

      if (isEditMode && id) {
        const updated = await updateAdminProduct(id, payload as never, currentProductSnapshot as never);
        await saveVariants(id);
        setCurrentProductSnapshot(updated);
        setCurrentProductName(updated.name || payload.name);
        setSaveMessage("Product updated.");
      } else {
        const createPayload = pendingProductImageFiles.length > 0 ? { ...payload, images: [] } : payload;
        const created = await createAdminProduct(createPayload as never);
        await saveVariants(created.id);

        if (pendingProductImageFiles.length > 0) {
          setIsUploadingImage(true);
          try {
            const uploaded: ProductImageObject[] = [];
            for (const file of pendingProductImageFiles) {
              const result = await uploadProductImage(created.id, file);
              uploaded.push({
                url: result.url,
                alt_text: name || file.name,
                is_primary: false,
                display_order: 0,
              });
            }

            const normalized = uploaded.map((image, index) => ({
              ...image,
              is_primary: index === 0,
              display_order: index,
            }));

            if (normalized.length > 0) {
              await updateAdminProduct(
                created.id,
                {
                  images: toImageJson(normalized),
                },
                created as never,
              );
            }
            setPendingProductImageFiles([]);
          } finally {
            setIsUploadingImage(false);
          }
        }

        setSaveMessage("Product saved.");
        navigate(`/admin/products/${created.id}/edit`, { replace: true });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (
        message.toLowerCase().includes("unique_option_type") ||
        message.toLowerCase().includes("unique_option_value") ||
        message.toLowerCase().includes("unique_variant_option")
      ) {
        setSaveMessage("Duplicate option or variant combination detected. Ensure each option and value is unique.");
      } else {
        setSaveMessage("Unable to save product. Please review the form and try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async () => {
    if (!id) return;
    if (confirmDeleteValue.trim() !== currentProductName.trim()) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAdminProduct(id, {
        name: currentProductName,
        slug,
      });
      navigate("/admin/products", { replace: true });
    } finally {
      setIsDeleting(false);
    }
  };

  const aiDisabledByName = !name.trim();
  const aiButtonDisabled = aiDisabledByName || aiLoading;
  const hasImageForAI = Boolean(selectedProductImageForAI || pendingProductImageFiles.length > 0);
  const aiButtonLabel = aiLoading ? "AI Filling..." : hasImageForAI ? "AI Fill with Image" : "AI Fill";

  if (isLoading) {
    return <div className="admin-page font-body text-[12px] text-[var(--color-muted)]">Loading product...</div>;
  }

  if (loadError) {
    return (
      <div className="admin-page">
        <p className="font-body text-[12px] text-[var(--color-danger)]">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="admin-page pb-28 md:pb-0">
      <div className="admin-page-header mb-6 flex flex-wrap items-start justify-between gap-3">
        <h1 className="admin-page-title font-display text-[34px] italic text-[var(--color-primary)]">
          {isEditMode ? "Edit Product" : "Add Product"}
        </h1>

        <div className="admin-page-actions flex flex-col items-start gap-2 md:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              to="/admin/products"
              className="font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-accent)] hover:text-[var(--color-primary)]"
            >
              Back to products
            </Link>

            <div className="group relative">
              <button
                type="button"
                disabled={aiButtonDisabled}
                onClick={() => void handleAIFill()}
                className={`rounded-[var(--border-radius)] border border-[var(--color-accent)] bg-transparent px-[24px] py-[10px] font-body text-[11px] uppercase tracking-[0.15em] text-[var(--color-accent)] transition-all duration-200 ease-in-out ${
                  aiLoading
                    ? "cursor-not-allowed opacity-65"
                    : aiDisabledByName
                      ? "cursor-not-allowed opacity-40"
                      : "hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)]"
                }`}
              >
                {aiButtonLabel}
              </button>

              {aiDisabledByName ? (
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-max -translate-x-1/2 rounded-[var(--border-radius)] bg-[var(--color-primary)] px-3 py-1.5 font-body text-[10px] text-[var(--color-secondary)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  Enter a product name first
                </span>
              ) : null}
            </div>
          </div>

          {aiSuccessMessage ? (
            <p
              className={`font-body text-[10px] text-[var(--color-accent)] transition-opacity ease-in-out ${
                aiMessageVisible ? "opacity-100" : "opacity-0"
              }`}
              style={{ transitionDuration: "400ms" }}
            >
              {aiSuccessMessage}
            </p>
          ) : null}

          {aiError ? (
            <p
              className={`font-body text-[11px] text-[var(--color-danger)] transition-opacity ease-in-out ${
                aiMessageVisible ? "opacity-100" : "opacity-0"
              }`}
              style={{ transitionDuration: "400ms" }}
            >
              {aiError}
            </p>
          ) : null}
        </div>
      </div>

      <div className="product-form-layout flex flex-col gap-10 lg:grid lg:grid-cols-[58fr_42fr] lg:gap-[60px]">
        <div className="product-form-left min-w-0">
          <p className={sectionLabelClass}>Basic Information</p>

          <div id="field-name">
            <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">Product Name *</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[14px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
            />
            <div className="mt-2 flex items-center justify-between gap-4">
              <p className="font-body text-[10px] text-[var(--color-muted-soft)]">
                {`${storefrontConfig.storeName.toLowerCase().replace(/\s+/g, "")}.com/shop/${slug || "product-slug"}`}
              </p>
              <button
                type="button"
                onClick={() => setIsSlugEditable((value) => !value)}
                className="font-body text-[10px] text-[var(--color-accent)] hover:text-[var(--color-primary)]"
              >
                {isSlugEditable ? "Lock slug" : "Edit slug"}
              </button>
            </div>
            {isSlugEditable ? (
              <input
                value={slug}
                onChange={(event) => setSlug(slugify(event.target.value))}
                className="mt-2 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[13px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
              />
            ) : null}
          </div>

          <div id="field-category" className="mt-6 rounded-[var(--border-radius)]">
            <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">Category *</label>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="mt-2 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[13px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div id="field-shortDescription" className="mt-6 rounded-[var(--border-radius)]">
            <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">Short Description *</label>
            <textarea
              value={shortDescription}
              onChange={(event) => setShortDescription(event.target.value.slice(0, 500))}
              className="mt-2 min-h-20 w-full resize-y border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[13px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
            />
            <p className="mt-1 text-right font-body text-[10px] text-[var(--color-muted-soft)]">{shortDescription.length}/500</p>
          </div>

          <div id="field-fullDescription" className="mt-6 rounded-[var(--border-radius)]">
            <label className="font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Full Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-2 min-h-40 w-full resize-y border border-[var(--color-border)] bg-transparent p-3 font-body text-[14px] leading-[1.8] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          <p className={`${sectionLabelClass} mt-10`}>Pricing & Inventory</p>

          <div className="grid gap-4 md:grid-cols-2">
            <div id="field-price">
              <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">Selling Price *</label>
              <div className="mt-2 flex items-center border-b border-[var(--color-border)] pb-2">
                <span className="mr-2 font-body text-[14px] text-[var(--color-muted-soft)]">GH&#8373;</span>
                <input
                  value={price}
                  onChange={(event) => setPrice(event.target.value.replace(/[^\d.]/g, ""))}
                  className="w-full border-0 bg-transparent font-body text-[14px] text-[var(--color-primary)] outline-none"
                />
              </div>
            </div>
            <div>
              <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">Compare At Price</label>
              <div className="mt-2 flex items-center border-b border-[var(--color-border)] pb-2">
                <span className="mr-2 font-body text-[14px] text-[var(--color-muted-soft)]">GH&#8373;</span>
                <input
                  value={compareAtPrice}
                  onChange={(event) => setCompareAtPrice(event.target.value.replace(/[^\d.]/g, ""))}
                  className="w-full border-0 bg-transparent font-body text-[14px] text-[var(--color-primary)] outline-none"
                />
              </div>
              <p className="mt-1 font-body text-[10px] text-[var(--color-muted-soft)]">Original price shown crossed out</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">Cost Price</label>
              <div className="mt-2 flex items-center border-b border-[var(--color-border)] pb-2">
                <span className="mr-2 font-body text-[14px] text-[var(--color-muted-soft)]">GH&#8373;</span>
                <input
                  value={costPrice}
                  onChange={(event) => setCostPrice(event.target.value.replace(/[^\d.]/g, ""))}
                  className="w-full border-0 bg-transparent font-body text-[14px] text-[var(--color-primary)] outline-none"
                />
              </div>
              <p className="mt-1 font-body text-[10px] text-[var(--color-muted-soft)]">Internal only. Never shown publicly.</p>
            </div>
            <div id="field-sku" className="rounded-[var(--border-radius)]">
              <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">SKU</label>
              <div className="mt-2 flex items-center border-b border-[var(--color-border)] pb-2">
                <input
                  value={sku}
                  onChange={(event) => setSku(event.target.value.toUpperCase())}
                  className="w-full border-0 bg-transparent font-body text-[14px] text-[var(--color-primary)] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setSku(generateSkuValue(categorySlug))}
                  className="font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-accent)] hover:text-[var(--color-primary)]"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">Stock Quantity *</label>
              <input
                value={stockQuantity}
                onChange={(event) => setStockQuantity(event.target.value.replace(/[^\d]/g, ""))}
                disabled={hasVariants}
                className={`mt-2 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[14px] text-[var(--color-primary)] outline-none ${
                  hasVariants ? "cursor-not-allowed text-[var(--color-muted-soft)]" : "focus:border-[var(--color-primary)]"
                }`}
              />
              {hasVariants ? (
                <p className="mt-1 font-body text-[10px] text-[var(--color-accent)]">
                  Stock is managed per variant when variants are enabled
                </p>
              ) : null}
            </div>
            <div>
              <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">Low Stock Threshold</label>
              <input
                value={lowStockThreshold}
                onChange={(event) => setLowStockThreshold(event.target.value.replace(/[^\d]/g, ""))}
                disabled={hasVariants}
                className={`mt-2 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[14px] text-[var(--color-primary)] outline-none ${
                  hasVariants ? "cursor-not-allowed text-[var(--color-muted-soft)]" : "focus:border-[var(--color-primary)]"
                }`}
              />
              {hasVariants ? (
                <p className="mt-1 font-body text-[10px] text-[var(--color-accent)]">
                  Stock is managed per variant when variants are enabled
                </p>
              ) : (
                <p className="mt-1 font-body text-[10px] text-[var(--color-muted-soft)]">Alert when stock falls below this</p>
              )}
            </div>
          </div>

          <div id="field-weight" className="mt-4 rounded-[var(--border-radius)]">
            <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">Weight (grams)</label>
            <input
              value={weightGrams}
              onChange={(event) => setWeightGrams(event.target.value.replace(/[^\d]/g, ""))}
              className="mt-2 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[14px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
            />
            <p className="mt-1 font-body text-[10px] text-[var(--color-muted-soft)]">Used for shipping calculations</p>
          </div>

          {hasVariants ? (
            <div>
              <p className="mb-6 mt-12 border-t border-[var(--color-border)] pt-8 font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Option Types</p>
              <p className="mb-5 font-body text-[11px] leading-[1.7] text-[var(--color-muted-soft)]">
                Define what makes this product&apos;s variants different. Use any option names that fit this product.
              </p>

              <div className="space-y-4">
                {optionTypes.map((optionType, optionTypeIndex) => {
                  const draft = valueDrafts[optionType.local_id] ?? {
                    value: "",
                    withColor: false,
                    color_hex: primaryThemeColor,
                  };

                  return (
                    <div key={optionType.local_id} className="rounded-[var(--border-radius)] border border-[var(--color-border)] p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-body text-[12px] text-[var(--color-muted)]">&#10303;</span>
                        <input
                          value={optionType.name}
                          onChange={(event) => onUpdateOptionTypeName(optionType.local_id, event.target.value)}
                          className="flex-1 border-0 border-b border-[var(--color-border)] bg-transparent pb-1 font-body text-[13px] font-medium text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
                        />
                        <button
                          type="button"
                          onClick={() => onRemoveOptionType(optionType.local_id)}
                          className="font-body text-[12px] text-[var(--color-muted-soft)] transition-colors hover:text-[var(--color-danger)]"
                        >
                          &times;
                        </button>
                      </div>

                      <p className="mt-3 font-body text-[11px] text-[var(--color-muted)]">Add values for {optionType.name || "option"}:</p>

                      <div className="mt-2 flex flex-wrap items-end gap-3">
                        <input
                          value={draft.value}
                          onChange={(event) =>
                            onUpdateValueDraft(optionType.local_id, (current) => ({ ...current, value: event.target.value }))
                          }
                          placeholder="e.g. Small, Medium, Large..."
                          className="w-full md:w-[170px] border-0 border-b border-[var(--color-border)] bg-transparent pb-1.5 font-body text-[13px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
                        />

                        <label className="flex items-center gap-2 font-body text-[10px] text-[var(--color-muted-soft)]">
                          <input
                            type="checkbox"
                            checked={draft.withColor}
                            onChange={(event) =>
                              onUpdateValueDraft(optionType.local_id, (current) => ({ ...current, withColor: event.target.checked }))
                            }
                            className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                          />
                          Add color swatch
                        </label>

                        {draft.withColor ? (
                          <label className="flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-[var(--color-border)]">
                            <input
                              type="color"
                              value={draft.color_hex}
                              onChange={(event) =>
                                onUpdateValueDraft(optionType.local_id, (current) => ({ ...current, color_hex: event.target.value }))
                              }
                              className="h-7 w-7 cursor-pointer border-0 bg-transparent p-0"
                            />
                          </label>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => onAddOptionValue(optionType.local_id)}
                          className="rounded-[var(--border-radius)] border border-[var(--color-primary)] bg-transparent px-5 py-2 font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)] hover:text-[var(--color-secondary)]"
                        >
                          Add Value
                        </button>
                      </div>

                      {optionType.values.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {optionType.values.map((optionValue) => (
                            <span
                              key={optionValue.local_id}
                              className="inline-flex items-center gap-1 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.06)] px-2.5 py-1 font-body text-[11px] text-[var(--color-primary)]"
                            >
                              {optionValue.color_hex ? (
                                <span
                                  className="inline-block h-2 w-2 rounded-full border border-[rgba(var(--color-navbar-solid-foreground-rgb),0.1)]"
                                  style={{ backgroundColor: optionValue.color_hex }}
                                />
                              ) : null}
                              <span>{optionValue.value}</span>
                              <button
                                type="button"
                                onClick={() => onRemoveOptionValue(optionType.local_id, optionValue.local_id)}
                                className="text-[var(--color-muted-soft)] transition-colors hover:text-[var(--color-danger)]"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {optionTypeIndex < optionTypes.length - 1 ? <div className="mt-4 border-b border-[var(--color-surface)]" /> : null}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <input
                  value={newOptionTypeName}
                  onChange={(event) => setNewOptionTypeName(event.target.value)}
                  placeholder="Option name e.g. Size, Color, Material, Fit..."
                  className="w-full md:w-[240px] border-0 border-b border-[var(--color-border)] bg-transparent pb-1.5 font-body text-[13px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
                />
                <button
                  type="button"
                  onClick={onAddOptionType}
                  className="rounded-[var(--border-radius)] border border-[var(--color-primary)] bg-transparent px-5 py-2 font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)] hover:text-[var(--color-secondary)]"
                >
                  Add Option
                </button>
              </div>

              <p className="mb-4 mt-8 font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Variants</p>
              <button
                type="button"
                onClick={onGenerateVariants}
                className="rounded-[var(--border-radius)] border border-[var(--color-accent)] bg-transparent px-5 py-2 font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)]"
              >
                Generate Variants
              </button>
              <p className="mt-2 font-body text-[10px] text-[var(--color-muted-soft)]">
                Automatically creates combinations from option values. Existing variants are preserved.
              </p>

              <div className="mt-6 hidden overflow-x-auto md:block">
                <div className="grid min-w-[780px] grid-cols-[1.6fr_80px_130px_1.2fr_90px_85px] gap-3 border-b border-[var(--color-border)] pb-3 font-body text-[9px] uppercase tracking-[0.15em] text-[var(--color-muted-soft)]">
                  <span>Variant</span>
                  <span>Stock</span>
                  <span>Price</span>
                  <span>SKU</span>
                  <span>Available</span>
                  <span>Actions</span>
                </div>

                {activeVariants.length === 0 ? (
                  <p className="py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">
                    No variants added yet. Add option types and generate variants above.
                  </p>
                ) : (
                  activeVariants.map((variant) => {
                    const isEditingPrice = editingPriceVariantId === variant.local_id;
                    const stockColorClass =
                      variant.stock_quantity === 0
                        ? "text-[var(--color-danger)]"
                        : variant.stock_quantity <= variant.low_stock_threshold
                          ? "text-[var(--color-accent)]"
                          : "text-[var(--color-primary)]";

                    return (
                      <div
                        key={variant.local_id}
                        className="grid min-w-[780px] grid-cols-[1.6fr_80px_130px_1.2fr_90px_85px] items-center gap-3 border-b border-[var(--color-border)] py-3 font-body text-[13px] text-[var(--color-primary)] transition-colors hover:bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.03)]"
                      >
                        <div>
                          <input
                            value={variant.label}
                            onChange={(event) => onChangeVariantLabel(variant.local_id, event.target.value)}
                            className="w-full border-0 border-b border-transparent bg-transparent pb-1 font-body text-[13px] text-[var(--color-primary)] outline-none focus:border-[var(--color-border)]"
                          />
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {variant.options.map((optionSelection) => {
                              const optionMeta = optionValueByLocalId.get(optionSelection.option_value_local_id);
                              if (!optionMeta) return null;
                              return (
                                <span
                                  key={[variant.local_id, optionSelection.option_type_local_id, optionSelection.option_value_local_id].join("-")}
                                  className="inline-flex items-center gap-1 rounded-[var(--border-radius)] border border-[var(--color-surface)] bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.04)] px-2 py-0.5 font-body text-[9px] text-[var(--color-muted)]"
                                >
                                  {optionMeta.optionValue.color_hex ? (
                                    <span
                                      className="inline-block h-2 w-2 rounded-full border border-[rgba(var(--color-navbar-solid-foreground-rgb),0.1)]"
                                      style={{ backgroundColor: optionMeta.optionValue.color_hex }}
                                    />
                                  ) : null}
                                  <span>{optionMeta.optionType.name}: {optionMeta.optionValue.value}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        <input
                          value={variant.stock_quantity}
                          onChange={(event) => onChangeVariantStock(variant.local_id, event.target.value.replace(/[^\d]/g, ""))}
                          className={["w-[60px] border-0 border-b border-[var(--color-border)] bg-transparent pb-1 font-body text-[13px] outline-none focus:border-[var(--color-primary)]", stockColorClass].join(" ")}
                        />

                        {isEditingPrice ? (
                          <div>
                            <div className="flex items-center border-b border-[var(--color-border)] pb-1">
                              <span className="mr-1 font-body text-[11px] text-[var(--color-muted-soft)]">GH&#8373;</span>
                              <input
                                autoFocus
                                value={editingPriceValue}
                                onChange={(event) => setEditingPriceValue(event.target.value.replace(/[^\d.]/g, ""))}
                                onBlur={() => onSaveEditingVariantPrice(variant.local_id)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    onSaveEditingVariantPrice(variant.local_id);
                                  }
                                }}
                                className="w-full border-0 bg-transparent font-body text-[12px] text-[var(--color-primary)] outline-none"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => onClearVariantPrice(variant.local_id)}
                              className="mt-1 font-body text-[10px] text-[var(--color-muted-soft)] hover:text-[var(--color-primary)]"
                            >
                              Clear
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onStartEditingVariantPrice(variant)}
                            className="text-left font-body text-[12px] text-[var(--color-primary)]"
                          >
                            {variant.price === null
                              ? <span className="font-body text-[11px] text-[var(--color-muted-soft)]">Base</span>
                              : "GH\u20B5" + variant.price.toFixed(2)}
                          </button>
                        )}

                        <input
                          value={variant.sku}
                          onChange={(event) => onChangeVariantSku(variant.local_id, event.target.value)}
                          className="w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-1 font-body text-[11px] text-[var(--color-muted-soft)] outline-none focus:border-[var(--color-primary)]"
                        />

                        <button
                          type="button"
                          onClick={() => onToggleVariantAvailable(variant.local_id)}
                          className={"relative h-5 w-10 overflow-hidden rounded-full border-0 p-0 transition-colors " + (variant.is_available ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]")}
                        >
                          <span
                            className={"pointer-events-none absolute top-[2px] h-4 w-4 rounded-full bg-white transition-[left] duration-200 ease-in " + (variant.is_available ? "left-[22px]" : "left-[2px]")}
                          />
                        </button>

                        {confirmDeleteVariantId === variant.local_id ? (
                          <div>
                            <p className="font-body text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted-soft)]">Delete this variant?</p>
                            <div className="mt-1 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onConfirmDeleteVariant(variant.local_id)}
                                className="font-body text-[10px] uppercase tracking-[0.08em] text-[var(--color-danger)]"
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteVariantId(null)}
                                className="font-body text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)]"
                              >
                                No
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteVariantId(variant.local_id)}
                            className="font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)] transition-colors hover:text-[var(--color-danger)]"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-6 border-t border-[var(--color-border)] md:hidden">
                {activeVariants.length === 0 ? (
                  <p className="py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">
                    No variants added yet. Add option types and generate variants above.
                  </p>
                ) : (
                  activeVariants.map((variant) => {
                    const isEditingPrice = editingPriceVariantId === variant.local_id;
                    const stockColorClass =
                      variant.stock_quantity === 0
                        ? "text-[var(--color-danger)]"
                        : variant.stock_quantity <= variant.low_stock_threshold
                          ? "text-[var(--color-accent)]"
                          : "text-[var(--color-primary)]";

                    return (
                      <div key={`mobile-${variant.local_id}`} className="admin-mobile-card">
                        <input
                          value={variant.label}
                          onChange={(event) => onChangeVariantLabel(variant.local_id, event.target.value)}
                          className="w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-1 font-body text-[13px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
                        />

                        <div className="mt-2 grid grid-cols-2 gap-3">
                          <input
                            value={variant.stock_quantity}
                            onChange={(event) => onChangeVariantStock(variant.local_id, event.target.value.replace(/[^\d]/g, ""))}
                            className={["w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-1 font-body text-[13px] outline-none focus:border-[var(--color-primary)]", stockColorClass].join(" ")}
                            placeholder="Stock"
                          />

                          {isEditingPrice ? (
                            <div>
                              <div className="flex items-center border-b border-[var(--color-border)] pb-1">
                                <span className="mr-1 font-body text-[11px] text-[var(--color-muted-soft)]">GH&#8373;</span>
                                <input
                                  autoFocus
                                  value={editingPriceValue}
                                  onChange={(event) => setEditingPriceValue(event.target.value.replace(/[^\d.]/g, ""))}
                                  onBlur={() => onSaveEditingVariantPrice(variant.local_id)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      onSaveEditingVariantPrice(variant.local_id);
                                    }
                                  }}
                                  className="w-full border-0 bg-transparent font-body text-[12px] text-[var(--color-primary)] outline-none"
                                  placeholder="Price"
                                />
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onStartEditingVariantPrice(variant)}
                              className="text-left border-b border-[var(--color-border)] pb-1 font-body text-[12px] text-[var(--color-primary)]"
                            >
                              {variant.price === null ? "Base price" : "GH\u20B5" + variant.price.toFixed(2)}
                            </button>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-3">
                          <input
                            value={variant.sku}
                            onChange={(event) => onChangeVariantSku(variant.local_id, event.target.value)}
                            className="w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-1 font-body text-[11px] text-[var(--color-muted-soft)] outline-none focus:border-[var(--color-primary)]"
                            placeholder="SKU"
                          />
                          <button
                            type="button"
                            onClick={() => onToggleVariantAvailable(variant.local_id)}
                            className={"relative h-5 w-10 shrink-0 overflow-hidden rounded-full border-0 p-0 transition-colors " + (variant.is_available ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]")}
                          >
                            <span
                              className={"pointer-events-none absolute top-[2px] h-4 w-4 rounded-full bg-white transition-[left] duration-200 ease-in " + (variant.is_available ? "left-[22px]" : "left-[2px]")}
                            />
                          </button>
                        </div>

                        <div className="mt-2 flex justify-end font-body text-[10px] uppercase tracking-[0.1em]">
                          {confirmDeleteVariantId === variant.local_id ? (
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => onConfirmDeleteVariant(variant.local_id)}
                                className="text-[var(--color-danger)]"
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteVariantId(null)}
                                className="text-[var(--color-muted)]"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteVariantId(variant.local_id)}
                              className="text-[var(--color-muted-soft)] transition-colors hover:text-[var(--color-danger)]"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-4">
                <p className="font-body text-[12px] text-[var(--color-muted)]">Total stock across all variants: {totalVariantStock}</p>
                <p className="mt-1 font-body text-[11px] text-[var(--color-muted-soft)]">
                  {availableVariantCount} variants available {" - "}
                  <span className={outOfStockVariantCount > 0 ? "text-[var(--color-danger)]" : ""}>
                    {outOfStockVariantCount} variants out of stock
                  </span>
                </p>
              </div>
            </div>
          ) : null}
          <p className={`${sectionLabelClass} mt-10`}>Organisation</p>

          <div id="field-tags" className="mt-4 rounded-[var(--border-radius)]">
            <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">Tags</label>
            <input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onAddTag();
                }
              }}
              className="mt-2 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[13px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
              placeholder="Type and press Enter"
            />
            {tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.06)] px-2.5 py-1 font-body text-[11px] text-[var(--color-primary)]"
                  >
                    {tag}
                    <button type="button" onClick={() => setTags((current) => current.filter((entry) => entry !== tag))}>
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div id="field-metaTitle" className="mt-4 rounded-[var(--border-radius)]">
            <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">Meta Title</label>
            <input
              value={metaTitle}
              onChange={(event) => setMetaTitle(event.target.value.slice(0, 255))}
              className="mt-2 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[13px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
            />
            <p className="mt-1 font-body text-[10px] text-[var(--color-muted-soft)]">Defaults to product name if empty</p>
          </div>

          <div id="field-metaDescription" className="mt-4 rounded-[var(--border-radius)]">
            <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">Meta Description</label>
            <textarea
              value={metaDescription}
              onChange={(event) => setMetaDescription(event.target.value.slice(0, 500))}
              className="mt-2 min-h-20 w-full resize-y border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[13px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
            />
            <p className="mt-1 text-right font-body text-[10px] text-[var(--color-muted-soft)]">{metaDescription.length}/500</p>
          </div>

          <p className={`${sectionLabelClass} mt-10`}>Product Benefits</p>

          <button
            type="button"
            onClick={onAddBenefit}
            disabled={benefits.length >= 6}
            className="rounded-[var(--border-radius)] border border-[var(--color-border)] px-5 py-2 font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-primary)] transition-colors hover:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Benefit
          </button>

          <div id="field-benefits" className="mt-4 rounded-[var(--border-radius)]">
            {benefits.map((benefit, index) => (
              <div key={benefit.id} className="grid gap-2 border-b border-[var(--color-border)] py-3 md:grid-cols-[120px_1fr_1.4fr_auto]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onMoveBenefit(benefit.id, "up")}
                    disabled={index === 0}
                    className="text-[var(--color-border)] disabled:opacity-40"
                  >
                    &#8593;
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveBenefit(benefit.id, "down")}
                    disabled={index === benefits.length - 1}
                    className="text-[var(--color-border)] disabled:opacity-40"
                  >
                    &#8595;
                  </button>
                  <select
                    value={benefit.icon}
                    onChange={(event) => onUpdateBenefit(benefit.id, "icon", event.target.value)}
                    className="w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-1 font-body text-[11px] text-[var(--color-primary)] outline-none"
                  >
                    {iconOptions.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  value={benefit.label}
                  onChange={(event) => onUpdateBenefit(benefit.id, "label", event.target.value)}
                  placeholder="Label"
                  className="border-0 border-b border-[var(--color-border)] bg-transparent pb-1 font-body text-[13px] text-[var(--color-primary)] outline-none"
                />
                <input
                  value={benefit.description}
                  onChange={(event) => onUpdateBenefit(benefit.id, "description", event.target.value)}
                  placeholder="Brief description..."
                  className="border-0 border-b border-[var(--color-border)] bg-transparent pb-1 font-body text-[12px] text-[var(--color-muted)] outline-none"
                />
                <button type="button" onClick={() => onRemoveBenefit(benefit.id)} className="text-[var(--color-muted-soft)] hover:text-[var(--color-danger)]">
                  &times;
                </button>
              </div>
            ))}
          </div>

        </div>

        <div className="product-form-right min-w-0">
          <p className="mb-4 font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Product Images</p>
          <p className="mb-4 font-body text-[10px] text-[var(--color-muted-soft)]">
            First image is primary. Max 6 images, 2MB each.
          </p>

          <button
            type="button"
            onClick={() => productImagesInputRef.current?.click()}
            disabled={isUploadingImage}
            className="block w-full border-2 border-dashed border-[var(--color-border)] p-8 text-center transition-colors hover:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <p className="font-body text-[12px] text-[var(--color-muted-soft)]">Drag images here</p>
            <p className="mt-1 font-body text-[11px] text-[var(--color-accent)]">or click to upload</p>
          </button>
          <input
            ref={productImagesInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={isUploadingImage}
            onChange={(event) => {
              void onUploadImages(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
            className="hidden"
          />
          {!isEditMode ? (
            <p className="mt-2 font-body text-[10px] text-[var(--color-muted-soft)]">
              Selected images are queued now and uploaded automatically after first save.
            </p>
          ) : null}
          {!isEditMode && queuedImagePreviewUrl ? (
            <div
              className="relative mt-2 overflow-hidden rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]"
              style={{ width: "72px", aspectRatio: "3 / 4" }}
            >
              <img src={queuedImagePreviewUrl} alt="Queued product image preview" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={onRemoveQueuedPreviewImage}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-[var(--border-radius)] bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.78)] font-body text-[12px] leading-none text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-danger)]"
                aria-label="Remove queued image"
              >
                &times;
              </button>
            </div>
          ) : null}
          {isUploadingImage ? <p className="mt-2 font-body text-[10px] text-[var(--color-accent)]">Uploading images...</p> : null}

          {images.length > 0 ? (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {images.map((image, index) => (
                <div key={image.url} className="relative overflow-hidden bg-[var(--color-surface-alt)]" style={{ aspectRatio: "3 / 4" }}>
                  <img src={image.url} alt={image.alt_text || name || "Product image"} className="h-full w-full object-cover" />
                  {index === 0 ? (
                    <span className="absolute top-1 left-1 bg-[var(--color-primary)] px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.08em] text-[var(--color-secondary)]">
                      Primary
                    </span>
                  ) : null}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.45)] py-1 text-white">
                    <button type="button" onClick={() => void onReorderImage(index, "left")} disabled={index === 0}>
                      &#8592;
                    </button>
                    <button
                      type="button"
                      onClick={() => void onReorderImage(index, "right")}
                      disabled={index === images.length - 1}
                    >
                      &#8594;
                    </button>
                    <button type="button" onClick={() => void onRemoveImage(index)}>
                      &times;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <p className={`${sectionLabelClass} mt-10`}>Publishing</p>

          <label className="mb-2 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 pr-2">
              <p className="font-body text-[12px] text-[var(--color-primary)]">This product has variants</p>
              <p className="font-body text-[10px] leading-[1.7] text-[var(--color-muted-soft)]">
                Enable if this product comes in multiple option combinations. Stock and pricing will be managed per
                variant.
              </p>
            </div>
            <div className="flex min-w-[96px] shrink-0 items-center justify-end gap-3">
              <span className="font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-primary)]">
                {hasVariants ? "On" : "Off"}
              </span>
              <button
                type="button"
                onClick={onToggleHasVariants}
                aria-label="Toggle product variants"
                aria-pressed={hasVariants}
                className="relative shrink-0 cursor-pointer p-0"
                style={{
                  width: "52px",
                  height: "30px",
                  minWidth: "52px",
                  borderRadius: "9999px",
                  border: "2px solid var(--color-primary)",
                  background: hasVariants ? "var(--color-primary)" : "var(--color-surface-strong)",
                  display: "inline-flex",
                  alignItems: "center",
                  overflow: "hidden",
                }}
              >
                <span
                  className="pointer-events-none absolute"
                  style={{
                    top: "2px",
                    left: hasVariants ? "24px" : "2px",
                    width: "22px",
                    height: "22px",
                    borderRadius: "9999px",
                    background: hasVariants ? "var(--color-secondary)" : "var(--color-primary)",
                    boxShadow: "0 2px 5px rgba(0,0,0,0.35)",
                    transition: "left 180ms ease-in-out",
                  }}
                />
              </button>
            </div>
          </label>

          {!hasVariants && variantToggleWarning ? (
            <div className="mt-2 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.08)] px-4 py-3">
              <p className="font-body text-[11px] text-[var(--color-accent)]">
                Turning this off will not delete existing variants but stock will no longer be tracked per variant.
              </p>
            </div>
          ) : null}

          <label className="mb-4 mt-4 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 pr-2">
              <p className="font-body text-[12px] text-[var(--color-primary)]">Available for purchase</p>
              <p className="font-body text-[11px] text-[var(--color-muted)]">Make this product available to customers</p>
            </div>
            <div className="flex min-w-[96px] shrink-0 items-center justify-end gap-3">
              <span className="font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-primary)]">
                {isAvailable ? "On" : "Off"}
              </span>
              <button
                type="button"
                onClick={() => setIsAvailable((value) => !value)}
                aria-label="Toggle availability"
                aria-pressed={isAvailable}
                className="relative shrink-0 cursor-pointer p-0"
                style={{
                  width: "52px",
                  height: "30px",
                  minWidth: "52px",
                  borderRadius: "9999px",
                  border: "2px solid var(--color-primary)",
                  background: isAvailable ? "var(--color-primary)" : "var(--color-surface-strong)",
                  display: "inline-flex",
                  alignItems: "center",
                  overflow: "hidden",
                }}
              >
                <span
                  className="pointer-events-none absolute"
                  style={{
                    top: "2px",
                    left: isAvailable ? "24px" : "2px",
                    width: "22px",
                    height: "22px",
                    borderRadius: "9999px",
                    background: isAvailable ? "var(--color-secondary)" : "var(--color-primary)",
                    boxShadow: "0 2px 5px rgba(0,0,0,0.35)",
                    transition: "left 180ms ease-in-out",
                  }}
                />
              </button>
            </div>
          </label>

          <label className="mb-6 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 pr-2">
              <p className="font-body text-[12px] text-[var(--color-primary)]">Featured product</p>
              <p className="font-body text-[11px] text-[var(--color-muted)]">Show in featured sections on homepage</p>
            </div>
            <div className="flex min-w-[96px] shrink-0 items-center justify-end gap-3">
              <span className="font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-primary)]">
                {isFeatured ? "On" : "Off"}
              </span>
              <button
                type="button"
                onClick={() => setIsFeatured((value) => !value)}
                aria-label="Toggle featured product"
                aria-pressed={isFeatured}
                className="relative shrink-0 cursor-pointer p-0"
                style={{
                  width: "52px",
                  height: "30px",
                  minWidth: "52px",
                  borderRadius: "9999px",
                  border: "2px solid var(--color-primary)",
                  background: isFeatured ? "var(--color-primary)" : "var(--color-surface-strong)",
                  display: "inline-flex",
                  alignItems: "center",
                  overflow: "hidden",
                }}
              >
                <span
                  className="pointer-events-none absolute"
                  style={{
                    top: "2px",
                    left: isFeatured ? "24px" : "2px",
                    width: "22px",
                    height: "22px",
                    borderRadius: "9999px",
                    background: isFeatured ? "var(--color-secondary)" : "var(--color-primary)",
                    boxShadow: "0 2px 5px rgba(0,0,0,0.35)",
                    transition: "left 180ms ease-in-out",
                  }}
                />
              </button>
            </div>
          </label>

          <button
            type="button"
            onClick={() => void save(false)}
            disabled={isSaving}
            className="hidden w-full rounded-[var(--border-radius)] bg-[var(--color-primary)] px-5 py-4 font-body text-[11px] uppercase tracking-[0.15em] text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)] disabled:cursor-not-allowed disabled:opacity-65 md:block"
          >
            {isSaving ? "Saving..." : isEditMode ? "Update Product" : "Save Product"}
          </button>

          <button
            type="button"
            onClick={() => void save(true)}
            className="mt-3 font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)] hover:text-[var(--color-primary)]"
          >
            Save as Draft
          </button>

          {saveMessage ? <p className="mt-3 font-body text-[12px] text-[var(--color-accent)]">{saveMessage}</p> : null}

          {isEditMode ? (
            <div className="mt-8 border-t border-[var(--color-border)] pt-6">
              {hasOrderUsage && hasOrderUsage > 0 ? (
                <p className="font-body text-[11px] text-[var(--color-muted)]">
                  This product has {hasOrderUsage} orders and cannot be deleted. Set it to unavailable instead.
                </p>
              ) : (
                <>
                  {!isDeleteOpen ? (
                    <button
                      type="button"
                      onClick={() => setIsDeleteOpen(true)}
                      className="font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)] hover:text-[var(--color-danger)]"
                    >
                      Delete Product
                    </button>
                  ) : (
                    <div>
                      <p className="font-body text-[11px] text-[var(--color-muted)]">Type the product name to confirm:</p>
                      <input
                        value={confirmDeleteValue}
                        onChange={(event) => setConfirmDeleteValue(event.target.value)}
                        className="mt-2 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[13px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => void onDelete()}
                        disabled={confirmDeleteValue.trim() !== currentProductName.trim() || isDeleting}
                        className="mt-3 w-full rounded-[var(--border-radius)] bg-[var(--color-danger)] px-4 py-3 font-body text-[11px] uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isDeleting ? "Deleting..." : "Permanently Delete"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDeleteOpen(false);
                          setConfirmDeleteValue("");
                        }}
                        className="mt-2 font-body text-[10px] text-[var(--color-muted-soft)]"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="fixed inset-x-4 bottom-4 z-[210] md:hidden">
        <button
          type="button"
          onClick={() => void save(false)}
          disabled={isSaving}
          className="w-full rounded-[var(--border-radius)] bg-[var(--color-primary)] px-5 py-4 font-body text-[11px] uppercase tracking-[0.15em] text-[var(--color-secondary)] shadow-[0_12px_30px_rgba(26,28,28,0.24)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {isSaving ? "Saving..." : isEditMode ? "Update Product" : "Add Product"}
        </button>
      </div>
    </div>
  );
};

export default AdminProductEditorPage;


