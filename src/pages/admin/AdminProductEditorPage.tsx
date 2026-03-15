import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
  "mb-6 border-t border-[#d4ccc2] pt-8 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]";

const AdminProductEditorPage = () => {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const productImagesInputRef = useRef<HTMLInputElement | null>(null);

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
        const [product, usageCount] = await Promise.all([fetchAdminProductById(id), fetchProductOrderCount(id)]);

        if (!isMounted) return;
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
    element.style.background = "rgba(196,168,130,0.15)";

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
        response.used_image ? "✦ Fields filled using product image" : "✦ Fields filled — review before saving",
      );
    } catch {
      setAIError("AI fill failed. Please try again.");
    } finally {
      setAILoading(false);
    }
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

      if (!payload.name || !payload.slug || !payload.price || !categoryId) {
        setSaveMessage("Fill all required fields: name, category, and price.");
        return;
      }

      if (isEditMode && id) {
        const updated = await updateAdminProduct(id, payload as never, currentProductSnapshot as never);
        setCurrentProductSnapshot(updated);
        setCurrentProductName(updated.name || payload.name);
        setSaveMessage("Product updated.");
      } else {
        const createPayload = pendingProductImageFiles.length > 0 ? { ...payload, images: [] } : payload;
        const created = await createAdminProduct(createPayload as never);

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
  const aiButtonLabel = aiLoading ? "✦ Filling..." : hasImageForAI ? "✦ AI Fill with Image" : "✦ AI Fill";

  if (isLoading) {
    return <div className="px-6 py-10 lg:px-[60px] lg:py-12 font-body text-[12px] text-[#888888]">Loading product...</div>;
  }

  if (loadError) {
    return (
      <div className="px-6 py-10 lg:px-[60px] lg:py-12">
        <p className="font-body text-[12px] text-[#C0392B]">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#F5F0E8] px-6 py-10 lg:px-[60px] lg:py-12">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-[34px] italic text-[#1A1A1A]">
          {isEditMode ? "Edit Product" : "Add Product"}
        </h1>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              to="/admin/products"
              className="font-body text-[10px] uppercase tracking-[0.1em] text-[#C4A882] hover:text-[#1A1A1A]"
            >
              Back to products
            </Link>

            <div className="group relative">
              <button
                type="button"
                disabled={aiButtonDisabled}
                onClick={() => void handleAIFill()}
                className={`rounded-[2px] border border-[#C4A882] bg-transparent px-[24px] py-[10px] font-body text-[11px] uppercase tracking-[0.15em] text-[#C4A882] transition-all duration-200 ease-in-out ${
                  aiLoading
                    ? "cursor-not-allowed opacity-65"
                    : aiDisabledByName
                      ? "cursor-not-allowed opacity-40"
                      : "hover:bg-[#C4A882] hover:text-[#1A1A1A]"
                }`}
              >
                {aiButtonLabel}
              </button>

              {aiDisabledByName ? (
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-max -translate-x-1/2 rounded-[2px] bg-[#1A1A1A] px-3 py-1.5 font-body text-[10px] text-[#F5F0E8] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  Enter a product name first
                </span>
              ) : null}
            </div>
          </div>

          {aiSuccessMessage ? (
            <p
              className={`font-body text-[10px] text-[#C4A882] transition-opacity ease-in-out ${
                aiMessageVisible ? "opacity-100" : "opacity-0"
              }`}
              style={{ transitionDuration: "400ms" }}
            >
              {aiSuccessMessage}
            </p>
          ) : null}

          {aiError ? (
            <p
              className={`font-body text-[11px] text-[#C0392B] transition-opacity ease-in-out ${
                aiMessageVisible ? "opacity-100" : "opacity-0"
              }`}
              style={{ transitionDuration: "400ms" }}
            >
              {aiError}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[58%_42%] lg:gap-[60px]">
        <div>
          <p className={sectionLabelClass}>Basic Information</p>

          <div>
            <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">Product Name *</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[14px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
            />
            <div className="mt-2 flex items-center justify-between gap-4">
              <p className="font-body text-[10px] text-[#aaaaaa]">luxuriant.com/shop/{slug || "product-slug"}</p>
              <button
                type="button"
                onClick={() => setIsSlugEditable((value) => !value)}
                className="font-body text-[10px] text-[#C4A882] hover:text-[#1A1A1A]"
              >
                {isSlugEditable ? "Lock slug" : "Edit slug"}
              </button>
            </div>
            {isSlugEditable ? (
              <input
                value={slug}
                onChange={(event) => setSlug(slugify(event.target.value))}
                className="mt-2 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
              />
            ) : null}
          </div>

          <div id="field-shortDescription" className="mt-6 rounded-[2px]">
            <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">Short Description *</label>
            <textarea
              value={shortDescription}
              onChange={(event) => setShortDescription(event.target.value.slice(0, 500))}
              className="mt-2 min-h-20 w-full resize-y border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
            />
            <p className="mt-1 text-right font-body text-[10px] text-[#aaaaaa]">{shortDescription.length}/500</p>
          </div>

          <div id="field-fullDescription" className="mt-6 rounded-[2px]">
            <label className="font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Full Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-2 min-h-40 w-full resize-y border border-[#d4ccc2] bg-transparent p-3 font-body text-[14px] leading-[1.8] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
            />
          </div>

          <p className={`${sectionLabelClass} mt-10`}>Pricing & Inventory</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">Selling Price *</label>
              <div className="mt-2 flex items-center border-b border-[#d4ccc2] pb-2">
                <span className="mr-2 font-body text-[14px] text-[#aaaaaa]">GH&#8373;</span>
                <input
                  value={price}
                  onChange={(event) => setPrice(event.target.value.replace(/[^\d.]/g, ""))}
                  className="w-full border-0 bg-transparent font-body text-[14px] text-[#1A1A1A] outline-none"
                />
              </div>
            </div>
            <div>
              <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">Compare At Price</label>
              <div className="mt-2 flex items-center border-b border-[#d4ccc2] pb-2">
                <span className="mr-2 font-body text-[14px] text-[#aaaaaa]">GH&#8373;</span>
                <input
                  value={compareAtPrice}
                  onChange={(event) => setCompareAtPrice(event.target.value.replace(/[^\d.]/g, ""))}
                  className="w-full border-0 bg-transparent font-body text-[14px] text-[#1A1A1A] outline-none"
                />
              </div>
              <p className="mt-1 font-body text-[10px] text-[#aaaaaa]">Original price shown crossed out</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">Cost Price</label>
              <div className="mt-2 flex items-center border-b border-[#d4ccc2] pb-2">
                <span className="mr-2 font-body text-[14px] text-[#aaaaaa]">GH&#8373;</span>
                <input
                  value={costPrice}
                  onChange={(event) => setCostPrice(event.target.value.replace(/[^\d.]/g, ""))}
                  className="w-full border-0 bg-transparent font-body text-[14px] text-[#1A1A1A] outline-none"
                />
              </div>
              <p className="mt-1 font-body text-[10px] text-[#aaaaaa]">Internal only. Never shown publicly.</p>
            </div>
            <div id="field-sku" className="rounded-[2px]">
              <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">SKU</label>
              <div className="mt-2 flex items-center border-b border-[#d4ccc2] pb-2">
                <input
                  value={sku}
                  onChange={(event) => setSku(event.target.value.toUpperCase())}
                  className="w-full border-0 bg-transparent font-body text-[14px] text-[#1A1A1A] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setSku(generateSkuValue(categorySlug))}
                  className="font-body text-[10px] uppercase tracking-[0.1em] text-[#C4A882] hover:text-[#1A1A1A]"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">Stock Quantity *</label>
              <input
                value={stockQuantity}
                onChange={(event) => setStockQuantity(event.target.value.replace(/[^\d]/g, ""))}
                className="mt-2 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[14px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
              />
            </div>
            <div>
              <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">Low Stock Threshold</label>
              <input
                value={lowStockThreshold}
                onChange={(event) => setLowStockThreshold(event.target.value.replace(/[^\d]/g, ""))}
                className="mt-2 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[14px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
              />
              <p className="mt-1 font-body text-[10px] text-[#aaaaaa]">Alert when stock falls below this</p>
            </div>
          </div>

          <div id="field-weight" className="mt-4 rounded-[2px]">
            <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">Weight (grams)</label>
            <input
              value={weightGrams}
              onChange={(event) => setWeightGrams(event.target.value.replace(/[^\d]/g, ""))}
              className="mt-2 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[14px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
            />
            <p className="mt-1 font-body text-[10px] text-[#aaaaaa]">Used for shipping calculations</p>
          </div>

          <p className={`${sectionLabelClass} mt-10`}>Organisation</p>

          <div>
            <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">Category *</label>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="mt-2 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div id="field-tags" className="mt-4 rounded-[2px]">
            <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">Tags</label>
            <input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onAddTag();
                }
              }}
              className="mt-2 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
              placeholder="Type and press Enter"
            />
            {tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-[2px] border border-[#d4ccc2] bg-[rgba(26,26,26,0.06)] px-2.5 py-1 font-body text-[11px] text-[#1A1A1A]"
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

          <div id="field-metaTitle" className="mt-4 rounded-[2px]">
            <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">Meta Title</label>
            <input
              value={metaTitle}
              onChange={(event) => setMetaTitle(event.target.value.slice(0, 255))}
              className="mt-2 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
            />
            <p className="mt-1 font-body text-[10px] text-[#aaaaaa]">Defaults to product name if empty</p>
          </div>

          <div id="field-metaDescription" className="mt-4 rounded-[2px]">
            <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">Meta Description</label>
            <textarea
              value={metaDescription}
              onChange={(event) => setMetaDescription(event.target.value.slice(0, 500))}
              className="mt-2 min-h-20 w-full resize-y border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
            />
            <p className="mt-1 text-right font-body text-[10px] text-[#aaaaaa]">{metaDescription.length}/500</p>
          </div>

          <p className={`${sectionLabelClass} mt-10`}>Product Benefits</p>

          <button
            type="button"
            onClick={onAddBenefit}
            disabled={benefits.length >= 6}
            className="rounded-[2px] border border-[#d4ccc2] px-5 py-2 font-body text-[10px] uppercase tracking-[0.1em] text-[#1A1A1A] transition-colors hover:border-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Benefit
          </button>

          <div id="field-benefits" className="mt-4 rounded-[2px]">
            {benefits.map((benefit, index) => (
              <div key={benefit.id} className="grid gap-2 border-b border-[#d4ccc2] py-3 sm:grid-cols-[120px_1fr_1.4fr_auto]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onMoveBenefit(benefit.id, "up")}
                    disabled={index === 0}
                    className="text-[#d4ccc2] disabled:opacity-40"
                  >
                    &#8593;
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveBenefit(benefit.id, "down")}
                    disabled={index === benefits.length - 1}
                    className="text-[#d4ccc2] disabled:opacity-40"
                  >
                    &#8595;
                  </button>
                  <select
                    value={benefit.icon}
                    onChange={(event) => onUpdateBenefit(benefit.id, "icon", event.target.value)}
                    className="w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-1 font-body text-[11px] text-[#1A1A1A] outline-none"
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
                  className="border-0 border-b border-[#d4ccc2] bg-transparent pb-1 font-body text-[13px] text-[#1A1A1A] outline-none"
                />
                <input
                  value={benefit.description}
                  onChange={(event) => onUpdateBenefit(benefit.id, "description", event.target.value)}
                  placeholder="Brief description..."
                  className="border-0 border-b border-[#d4ccc2] bg-transparent pb-1 font-body text-[12px] text-[#888888] outline-none"
                />
                <button type="button" onClick={() => onRemoveBenefit(benefit.id)} className="text-[#aaaaaa] hover:text-[#C0392B]">
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-4 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">Product Images</p>
          <p className="mb-4 font-body text-[10px] text-[#aaaaaa]">
            First image is primary. Max 6 images, 2MB each.
          </p>

          <button
            type="button"
            onClick={() => productImagesInputRef.current?.click()}
            disabled={isUploadingImage}
            className="block w-full border-2 border-dashed border-[#d4ccc2] p-8 text-center transition-colors hover:border-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <p className="font-body text-[12px] text-[#aaaaaa]">Drag images here</p>
            <p className="mt-1 font-body text-[11px] text-[#C4A882]">or click to upload</p>
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
            <p className="mt-2 font-body text-[10px] text-[#aaaaaa]">
              Selected images are queued now and uploaded automatically after first save.
            </p>
          ) : null}
          {!isEditMode && queuedImagePreviewUrl ? (
            <div
              className="relative mt-2 overflow-hidden rounded-[2px] border border-[#d4ccc2] bg-[#ede5db]"
              style={{ width: "72px", aspectRatio: "3 / 4" }}
            >
              <img src={queuedImagePreviewUrl} alt="Queued product image preview" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={onRemoveQueuedPreviewImage}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-[2px] bg-[rgba(26,26,26,0.78)] font-body text-[12px] leading-none text-[#F5F0E8] transition-colors hover:bg-[#C0392B]"
                aria-label="Remove queued image"
              >
                &times;
              </button>
            </div>
          ) : null}
          {isUploadingImage ? <p className="mt-2 font-body text-[10px] text-[#C4A882]">Uploading images...</p> : null}

          {images.length > 0 ? (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {images.map((image, index) => (
                <div key={image.url} className="relative overflow-hidden bg-[#ede5db]" style={{ aspectRatio: "3 / 4" }}>
                  <img src={image.url} alt={image.alt_text || name || "Product image"} className="h-full w-full object-cover" />
                  {index === 0 ? (
                    <span className="absolute top-1 left-1 bg-[#1A1A1A] px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.08em] text-[#F5F0E8]">
                      Primary
                    </span>
                  ) : null}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-[rgba(0,0,0,0.45)] py-1 text-white">
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

          <label className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-body text-[12px] text-[#1A1A1A]">Available for purchase</p>
              <p className="font-body text-[11px] text-[#888888]">Make this product available to customers</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAvailable((value) => !value)}
              className={`relative h-6 w-11 shrink-0 cursor-pointer overflow-hidden rounded-full border-0 p-0 transition-colors ${
                isAvailable ? "bg-[#1A1A1A]" : "bg-[#d4ccc2]"
              }`}
            >
              <span
                className={`pointer-events-none absolute top-[2px] h-5 w-5 rounded-full bg-white transition-[left] duration-200 ease-in ${
                  isAvailable ? "left-[22px]" : "left-[2px]"
                }`}
              />
            </button>
          </label>

          <label className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="font-body text-[12px] text-[#1A1A1A]">Featured product</p>
              <p className="font-body text-[11px] text-[#888888]">Show in featured sections on homepage</p>
            </div>
            <button
              type="button"
              onClick={() => setIsFeatured((value) => !value)}
              className={`relative h-6 w-11 shrink-0 cursor-pointer overflow-hidden rounded-full border-0 p-0 transition-colors ${
                isFeatured ? "bg-[#1A1A1A]" : "bg-[#d4ccc2]"
              }`}
            >
              <span
                className={`pointer-events-none absolute top-[2px] h-5 w-5 rounded-full bg-white transition-[left] duration-200 ease-in ${
                  isFeatured ? "left-[22px]" : "left-[2px]"
                }`}
              />
            </button>
          </label>

          <button
            type="button"
            onClick={() => void save(false)}
            disabled={isSaving}
            className="w-full rounded-[2px] bg-[#1A1A1A] px-5 py-4 font-body text-[11px] uppercase tracking-[0.15em] text-[#F5F0E8] transition-colors hover:bg-[#C4A882] hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-65"
          >
            {isSaving ? "Saving..." : isEditMode ? "Update Product" : "Save Product"}
          </button>

          <button
            type="button"
            onClick={() => void save(true)}
            className="mt-3 font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa] hover:text-[#1A1A1A]"
          >
            Save as Draft
          </button>

          {saveMessage ? <p className="mt-3 font-body text-[12px] text-[#C4A882]">{saveMessage}</p> : null}

          {isEditMode ? (
            <div className="mt-8 border-t border-[#d4ccc2] pt-6">
              {hasOrderUsage && hasOrderUsage > 0 ? (
                <p className="font-body text-[11px] text-[#888888]">
                  This product has {hasOrderUsage} orders and cannot be deleted. Set it to unavailable instead.
                </p>
              ) : (
                <>
                  {!isDeleteOpen ? (
                    <button
                      type="button"
                      onClick={() => setIsDeleteOpen(true)}
                      className="font-body text-[10px] uppercase tracking-[0.1em] text-[#aaaaaa] hover:text-[#C0392B]"
                    >
                      Delete Product
                    </button>
                  ) : (
                    <div>
                      <p className="font-body text-[11px] text-[#888888]">Type the product name to confirm:</p>
                      <input
                        value={confirmDeleteValue}
                        onChange={(event) => setConfirmDeleteValue(event.target.value)}
                        className="mt-2 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                      />
                      <button
                        type="button"
                        onClick={() => void onDelete()}
                        disabled={confirmDeleteValue.trim() !== currentProductName.trim() || isDeleting}
                        className="mt-3 w-full rounded-[2px] bg-[#C0392B] px-4 py-3 font-body text-[11px] uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isDeleting ? "Deleting..." : "Permanently Delete"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDeleteOpen(false);
                          setConfirmDeleteValue("");
                        }}
                        className="mt-2 font-body text-[10px] text-[#aaaaaa]"
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
    </div>
  );
};

export default AdminProductEditorPage;
