import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createAdminProduct,
  fetchAdminCategories,
  updateAdminProduct,
  uploadProductImage,
  type ProductImageObject,
} from "@/services/adminService";
import {
  buildVariantPreview,
  type AiDraftBenefit,
  type AiDraftExtractionResult,
  type AiDraftOptionType,
} from "@/lib/adminProductDraftAI";

interface AiDraftFunctionResponse {
  success?: boolean;
  message?: string;
  data?: AiDraftExtractionResult;
}

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const helpItems = [
  {
    title: "What to include",
    description: "Add price, sizes, colors, stock, materials, and any selling points that must survive into the draft.",
  },
  {
    title: "Images",
    description: "Upload up to six JPG, PNG, or WEBP images under 2MB each to help the AI read fabric, shape, and finish.",
  },
  {
    title: "Send",
    description: "Choose a category, then send. You can also press Ctrl/Cmd + Enter to create the draft.",
  },
] as const;

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

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

const normalizeSkuToken = (value: string, fallback = "VAR") => {
  const token = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 4);
  return token || fallback;
};

const buildVariantSku = (
  baseSku: string | null,
  optionValues: Array<{ option_type: string; option_value: string }>,
  index: number,
) => {
  const base = baseSku ? normalizeSkuToken(baseSku, "SKU") : "";
  if (!base) return null;
  const suffix = optionValues.map((entry) => normalizeSkuToken(entry.option_value)).join("-");
  return suffix ? `${base}-${suffix}` : `${base}-${String(index + 1).padStart(2, "0")}`;
};

const normalizeBenefits = (benefits: AiDraftBenefit[]) =>
  benefits
    .map((entry, index) => ({
      id: crypto.randomUUID(),
      icon: entry.icon || "star",
      label: entry.label,
      description: entry.description,
      display_order: index,
    }))
    .filter((entry) => entry.label || entry.description)
    .slice(0, 6);

const normalizeOptionTypes = (optionTypes: AiDraftOptionType[]): AiDraftOptionType[] =>
  optionTypes
    .map((optionType) => ({
      name: optionType.name.trim(),
      values: optionType.values
        .map((optionValue) => ({
          value: optionValue.value.trim(),
          color_hex: optionValue.color_hex,
        }))
        .filter((optionValue) => optionValue.value.length > 0),
    }))
    .filter((optionType) => optionType.name.length > 0 && optionType.values.length > 0);

const saveDraftOptionTypesAndVariants = async ({
  productId,
  optionTypes,
  productPrice,
  skuSuggestion,
  variantStockQuantity,
}: {
  productId: string;
  optionTypes: AiDraftOptionType[];
  productPrice: number;
  skuSuggestion: string | null;
  variantStockQuantity: number;
}) => {
  const normalizedOptionTypes = normalizeOptionTypes(optionTypes);
  if (normalizedOptionTypes.length === 0) return;

  const optionTypeIdByName = new Map<string, string>();
  const optionValueIdByTypeAndValue = new Map<string, string>();

  for (const [typeIndex, optionType] of normalizedOptionTypes.entries()) {
    const { data: insertedType, error: insertTypeError } = await (supabase as any)
      .from("product_option_types")
      .insert({ product_id: productId, name: optionType.name, display_order: typeIndex })
      .select("id")
      .single();

    if (insertTypeError || !insertedType?.id) throw insertTypeError || new Error("Failed to create option type");

    const optionTypeId = insertedType.id as string;
    const optionTypeKey = optionType.name.toLowerCase();
    optionTypeIdByName.set(optionTypeKey, optionTypeId);

    for (const [valueIndex, optionValue] of optionType.values.entries()) {
      const { data: insertedValue, error: insertValueError } = await (supabase as any)
        .from("product_option_values")
        .insert({ option_type_id: optionTypeId, value: optionValue.value, color_hex: optionValue.color_hex, display_order: valueIndex })
        .select("id")
        .single();

      if (insertValueError || !insertedValue?.id) throw insertValueError || new Error("Failed to create option value");
      optionValueIdByTypeAndValue.set(`${optionTypeKey}|${optionValue.value.toLowerCase()}`, insertedValue.id as string);
    }
  }

  const previewRows = buildVariantPreview(normalizedOptionTypes);

  for (const [variantIndex, preview] of previewRows.entries()) {
    const variantSku = buildVariantSku(skuSuggestion, preview.options, variantIndex);
    const { data: insertedVariant, error: insertVariantError } = await (supabase as any)
      .from("product_variants")
      .insert({
        product_id: productId,
        label: preview.label,
        price: productPrice,
        compare_at_price: null,
        stock_quantity: variantStockQuantity,
        low_stock_threshold: 5,
        sku: variantSku,
        is_available: true,
        display_order: variantIndex,
      })
      .select("id")
      .single();

    if (insertVariantError || !insertedVariant?.id) throw insertVariantError || new Error("Failed to create variant");

    const variantId = insertedVariant.id as string;
    const optionLinks = preview.options
      .map((entry) => {
        const optionTypeKey = entry.option_type.toLowerCase();
        const optionValueKey = `${optionTypeKey}|${entry.option_value.toLowerCase()}`;
        const optionTypeId = optionTypeIdByName.get(optionTypeKey);
        const optionValueId = optionValueIdByTypeAndValue.get(optionValueKey);
        if (!optionTypeId || !optionValueId) return null;
        return { variant_id: variantId, option_type_id: optionTypeId, option_value_id: optionValueId };
      })
      .filter((entry): entry is { variant_id: string; option_type_id: string; option_value_id: string } => Boolean(entry));

    if (optionLinks.length > 0) {
      const { error: linkError } = await (supabase as any).from("product_variant_options").insert(optionLinks);
      if (linkError) throw linkError;
    }
  }
};

const AdminAddWithAIPage = () => {
  const navigate = useNavigate();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [categoryId, setCategoryId] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const categoryRows = await fetchAdminCategories();
        if (!isMounted) return;
        setCategories(categoryRows);
      } catch {
        if (!isMounted) return;
        setErrorMessage("Unable to load categories.");
      } finally {
        if (isMounted) setIsLoadingCategories(false);
      }
    };
    void loadCategories();
    return () => { isMounted = false; };
  }, []);

  const imagePreviewUrls = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(() => {
    return () => { imagePreviewUrls.forEach((entry) => URL.revokeObjectURL(entry.url)); };
  }, [imagePreviewUrls]);

  const selectedCategoryName = useMemo(
    () => categories.find((category) => category.id === categoryId)?.name ?? "",
    [categories, categoryId],
  );

  const categorySelectWidthCh = useMemo(() => {
    const label = selectedCategoryName || (isLoadingCategories ? "Loading..." : "Category");
    return Math.min(24, Math.max(14, label.length + 5));
  }, [isLoadingCategories, selectedCategoryName]);

  const onSelectFiles = (inputFiles: FileList | null) => {
    if (!inputFiles?.length) return;
    const incoming = Array.from(inputFiles).filter(
      (file) => ALLOWED_IMAGE_TYPES.has(file.type) && file.size <= MAX_IMAGE_BYTES,
    );
    setFiles((current) => {
      const availableSlots = Math.max(0, MAX_IMAGES - current.length);
      return [...current, ...incoming.slice(0, availableSlots)];
    });
    setErrorMessage(null);
  };

  const onRemoveFile = (targetIndex: number) => {
    setFiles((current) => current.filter((_, index) => index !== targetIndex));
  };

  useEffect(() => {
    const textarea = promptTextareaRef.current;
    if (!textarea) return;
    const isMobile =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 640px)").matches;
    const minHeight = isMobile ? 92 : 110;
    const maxHeight = isMobile ? 220 : 280;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(maxHeight, Math.max(minHeight, textarea.scrollHeight))}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [rawInput]);

  const createDraft = async () => {
    if (!categoryId) { setErrorMessage("Select a category before creating with AI."); return; }
    if (!rawInput.trim()) { setErrorMessage("Enter product notes in the prompt field."); return; }

    setIsSubmitting(true);
    setErrorMessage(null);
    setWarnings([]);

    try {
      const imagePayloads = await Promise.all(
        files.map(async (file) => ({ data: await fileToBase64(file), mimeType: file.type })),
      );

      const { data, error } = await supabase.functions.invoke("ai_product_draft_extract", {
        body: { raw_input: rawInput.trim(), category: selectedCategoryName || undefined, images: imagePayloads },
      });

      const response = (data ?? {}) as AiDraftFunctionResponse;
      if (error || !response.success || !response.data) {
        setErrorMessage(response.message || "AI extraction failed. Please try again.");
        return;
      }

      const extraction = response.data;
      setWarnings(extraction.warnings ?? []);

      const extractedName = extraction.core_fields.name?.trim() || "Untitled Product";
      const extractedPrice =
        typeof extraction.core_fields.price === "number" && Number.isFinite(extraction.core_fields.price)
          ? Math.max(0, extraction.core_fields.price) : 0;
      const extractedStockQuantity =
        typeof extraction.core_fields.stock_quantity === "number" && Number.isFinite(extraction.core_fields.stock_quantity)
          ? Math.max(0, Math.trunc(extraction.core_fields.stock_quantity)) : null;
      const extractedStockPerVariant =
        typeof extraction.core_fields.stock_per_variant === "number" && Number.isFinite(extraction.core_fields.stock_per_variant)
          ? Math.max(0, Math.trunc(extraction.core_fields.stock_per_variant)) : null;
      const hasVariants = extraction.option_types.length > 0;
      const variantCount = Math.max(1, extraction.variant_preview.length || 0);
      const variantStockQuantity = hasVariants ? extractedStockPerVariant ?? extractedStockQuantity ?? 0 : 0;
      const initialProductStock = hasVariants
        ? variantStockQuantity * variantCount
        : extractedStockQuantity ?? extractedStockPerVariant ?? 0;
      const draftSlug = `${slugify(extractedName) || "product"}-${Math.random().toString(36).slice(2, 8)}`;

      const created = await createAdminProduct({
        name: extractedName,
        slug: draftSlug,
        short_description: extraction.core_fields.short_description || null,
        description: extraction.core_fields.full_description || null,
        category_id: categoryId,
        price: extractedPrice,
        compare_at_price: null,
        cost_price: null,
        sku: extraction.core_fields.sku_suggestion || null,
        stock_quantity: initialProductStock,
        low_stock_threshold: 5,
        has_variants: hasVariants,
        is_available: false,
        is_featured: false,
        images: [],
        benefits: normalizeBenefits(extraction.core_fields.benefits),
        tags: extraction.core_fields.tags,
        weight_grams: null,
        meta_title: extraction.core_fields.meta_title || null,
        meta_description: extraction.core_fields.meta_description || null,
      } as never);

      if (hasVariants) {
        await saveDraftOptionTypesAndVariants({
          productId: created.id,
          optionTypes: extraction.option_types,
          productPrice: extractedPrice,
          skuSuggestion: extraction.core_fields.sku_suggestion,
          variantStockQuantity,
        });
      }

      if (files.length > 0) {
        const uploaded: ProductImageObject[] = [];
        for (const file of files) {
          const result = await uploadProductImage(created.id, file);
          uploaded.push({ url: result.url, alt_text: extractedName || file.name, is_primary: false, display_order: 0 });
        }
        const normalizedImages = uploaded.map((image, index) => ({ ...image, is_primary: index === 0, display_order: index }));
        if (normalizedImages.length > 0) {
          await updateAdminProduct(created.id, { images: toImageJson(normalizedImages) }, created as never);
        }
      }

      navigate(`/admin/products/${created.id}/edit`, { replace: true });
    } catch {
      setErrorMessage("Unable to create AI draft right now. Your prompt and images are still here to retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void createDraft();
    }
  };

  const canSubmit = !isSubmitting && !isLoadingCategories;

  return (
    <div className="admin-page lux-page-enter overflow-visible min-h-[calc(100dvh-3.5rem)] md:min-h-[calc(100dvh-4rem)] flex flex-col">
      <div className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col text-left">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/admin/products"
            className="inline-flex items-center gap-2 rounded-full px-2 py-1 font-body text-[11px] text-[var(--color-navbar-solid-foreground)] transition-colors hover:text-[var(--color-primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to products
          </Link>

          <details className="group relative">
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-[rgba(var(--color-primary-rgb),0.18)] bg-white font-body text-[15px] text-[var(--color-primary)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.06)] [&::-webkit-details-marker]:hidden">
              ?
            </summary>
            <div className="absolute right-0 top-12 z-20 w-[min(92vw,320px)] rounded-[24px] border border-[rgba(var(--color-primary-rgb),0.12)] bg-white p-4 shadow-[0_24px_80px_rgba(26,28,28,0.10)]">
              <p className="font-body text-[10px] uppercase tracking-[0.16em] text-[var(--color-primary)]">Help</p>
              <div className="mt-3 space-y-3">
                {helpItems.map((item) => (
                  <div key={item.title}>
                    <p className="font-body text-[11px] uppercase tracking-[0.12em] text-[var(--color-navbar-solid-foreground)]">
                      {item.title}
                    </p>
                    <p className="mt-1 font-body text-[12px] leading-[1.75] text-[var(--color-muted)]">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>

        {/* ── Hero ── */}
        <div className="mx-auto mt-12 max-w-[760px] text-center md:mt-14">
          <p className="font-body text-[11px] uppercase tracking-[0.22em] text-[var(--color-primary)]">Add with AI</p>
          <h1 className="mt-4 font-display text-[40px] italic leading-[1.04] text-[var(--color-navbar-solid-foreground)] sm:text-[56px]">
            Start with a prompt.
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] font-body text-[13px] leading-[1.85] text-[var(--color-muted)] sm:text-[14px]">
            Paste the product notes, attach images if needed, choose a category, and send.
          </p>
        </div>

        {/* ── Composer ── */}
        <section className="mx-auto mt-auto w-full max-w-[860px] pt-8 md:pt-10">

          {errorMessage ? (
            <div className="mb-4 rounded-[22px] border border-[rgba(var(--color-danger-rgb),0.28)] bg-[rgba(var(--color-danger-rgb),0.07)] px-4 py-3 font-body text-[12px] text-[var(--color-danger)]">
              {errorMessage}
            </div>
          ) : null}

          {/* Card */}
          <div
            className="overflow-hidden rounded-[28px] border bg-white transition-shadow focus-within:shadow-[0_8px_40px_rgba(var(--color-primary-rgb),0.10)]"
            style={{ borderColor: "rgba(var(--color-primary-rgb),0.15)" }}
          >
            {/* Image previews */}
            {imagePreviewUrls.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto px-4 pb-1 pt-4 sm:px-5 lux-hide-scrollbar">
                {imagePreviewUrls.map((entry, index) => (
                  <div
                    key={`${entry.file.name}-${index}`}
                    className="relative h-[84px] w-[68px] shrink-0 overflow-hidden rounded-[16px] border bg-[var(--color-surface-alt)]"
                    style={{ borderColor: "rgba(var(--color-primary-rgb),0.12)" }}
                  >
                    <img src={entry.url} alt={entry.file.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => onRemoveFile(index)}
                      disabled={isSubmitting}
                      className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary)] text-white transition-colors hover:opacity-80 disabled:opacity-50"
                      aria-label={`Remove ${entry.file.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Textarea */}
            <div className="px-5 pt-3">
              <textarea
                ref={promptTextareaRef}
                aria-label="Product notes"
                value={rawInput}
                onChange={(event) => {
                  setRawInput(event.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                onKeyDown={handlePromptKeyDown}
                disabled={isSubmitting}
               
                placeholder={`Describe the product naturally.\nExample: Three-piece set, GH180, cream/yellow/violet, sizes S-L, soft stretch fabric, stock 12.`}
                className="w-full resize-none border-0 bg-transparent font-body text-[15px] leading-[1.6] outline-none disabled:opacity-60 sm:text-[16px]"
                style={{ color: "var(--color-navbar-solid-foreground)" }}
              />
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 px-5 pb-3 pt-1">

              {/* Image attach */}
              <button
                type="button"
                aria-label="Add Images"
                title="Add Images"
                onClick={() => imageInputRef.current?.click()}
                disabled={isSubmitting}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  borderColor: "rgba(var(--color-primary-rgb),0.20)",
                  color: "var(--color-primary)",
                  background: "rgba(var(--color-primary-rgb),0.04)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(var(--color-primary-rgb),0.10)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(var(--color-primary-rgb),0.04)")}
              >
                <ImagePlus className="h-4 w-4" />
              </button>

              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={isSubmitting}
                onChange={(event) => { onSelectFiles(event.currentTarget.files); event.currentTarget.value = ""; }}
                className="hidden"
              />

              {/* Category dropdown */}
              <div className="min-w-0 flex-shrink-0">
                <Select
                  value={categoryId}
                  onValueChange={(value) => {
                    setCategoryId(value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  disabled={isLoadingCategories || isSubmitting}
                >
                  <SelectTrigger
                    aria-label="Category"
                    style={{
                      width: `${categorySelectWidthCh}ch`,
                      minWidth: "14ch",
                      borderColor: "rgba(var(--color-primary-rgb),0.20)",
                      color: "var(--color-primary)",
                    }}
                    className="h-10 max-w-[58vw] rounded-full border bg-white pl-4 pr-3 font-body text-[12px] outline-none transition-colors focus:border-[var(--color-primary)] data-[placeholder]:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-none [&>svg]:text-[var(--color-primary)] [&>svg]:opacity-100"
                  >
                    <SelectValue placeholder={isLoadingCategories ? "Loading..." : "Category"} />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    className="z-[240] max-h-[300px] rounded-[20px] border border-[rgba(var(--color-primary-rgb),0.14)] bg-white p-1 shadow-[0_20px_60px_rgba(26,28,28,0.14)]"
                  >
                    {categories.map((category) => (
                      <SelectItem
                        key={category.id}
                        value={category.id}
                        className="rounded-[12px] py-2 pl-8 pr-3 font-body text-[12px] text-[var(--color-navbar-solid-foreground)] focus:bg-[rgba(var(--color-primary-rgb),0.08)] focus:text-[var(--color-primary)]"
                      >
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* File count */}
              {files.length > 0 && (
                <p className="min-w-0 flex-1 font-body text-[11px]" style={{ color: "var(--color-primary)" }}>
                  {files.length}/{MAX_IMAGES} images attached
                </p>
              )}

              {/* Send button */}
              <button
                type="button"
                aria-label="Create Draft with AI"
                title="Create Draft with AI"
                onClick={() => void createDraft()}
                disabled={!canSubmit}
                className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: canSubmit ? "var(--color-primary)" : "rgba(var(--color-primary-rgb),0.15)",
                  color: "white",
                }}
              >
                {isSubmitting
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <ArrowUp className="h-4 w-4" />
                }
              </button>
            </div>
          </div>

          {/* Warnings */}
          {warnings.length > 0 ? (
            <details
              className="mt-3 rounded-[22px] border px-4 py-3"
              style={{ borderColor: "rgba(var(--color-primary-rgb),0.12)", background: "rgba(var(--color-primary-rgb),0.03)" }}
            >
              <summary
                className="cursor-pointer list-none font-body text-[11px] uppercase tracking-[0.14em] [&::-webkit-details-marker]:hidden"
                style={{ color: "var(--color-primary)" }}
              >
                AI notes ({warnings.length})
              </summary>
              <ul className="mt-3 space-y-2">
                {warnings.map((warning) => (
                  <li key={warning} className="font-body text-[12px] leading-[1.75] text-[var(--color-muted)]">
                    {warning}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default AdminAddWithAIPage;
