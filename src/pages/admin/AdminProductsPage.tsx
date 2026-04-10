import { Plus, Search, Sparkles, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  deleteAdminProduct,
  fetchAdminCategories,
  fetchAdminProducts,
  fetchProductOrderCount,
  type AdminProductListItem,
} from "@/services/adminService";

const PAGE_SIZE = 20;
const defaultCategoryTabs = [{ label: "All", slug: "" }];
const availabilityTabs = [
  { label: "All", value: "all" },
  { label: "Available", value: "available" },
  { label: "Unavailable", value: "unavailable" },
] as const;

// ── Mobile filter bottom sheet ───────────────────────────────────────────────
const FilterSheet = ({
  open,
  onClose,
  availability,
  setAvailability,
  categorySlug,
  setCategorySlug,
  categoryTabs,
}: {
  open: boolean;
  onClose: () => void;
  availability: "all" | "available" | "unavailable";
  setAvailability: (v: "all" | "available" | "unavailable") => void;
  categorySlug: string;
  setCategorySlug: (v: string) => void;
  categoryTabs: Array<{ label: string; slug: string }>;
}) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const activeFilterCount =
    (availability !== "all" ? 1 : 0) + (categorySlug !== "" ? 1 : 0);

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out lg:hidden ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "80dvh", overflowY: "auto" }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[rgba(var(--color-primary-rgb),0.15)]" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(var(--color-primary-rgb),0.08)]">
          <p className="font-body text-[14px] font-semibold text-[var(--color-navbar-solid-foreground)]">Filters</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-[rgba(var(--color-primary-rgb),0.06)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-5">
          <div>
            <p className="font-body text-[10px] uppercase tracking-[0.18em] text-[var(--color-primary)] mb-2.5">Availability</p>
            <div className="flex flex-wrap gap-2">
              {availabilityTabs.map((opt) => {
                const active = availability === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setAvailability(opt.value); onClose(); }}
                    className={`rounded-full border px-4 py-2 font-body text-[10px] uppercase tracking-[0.12em] transition-colors ${
                      active ? "text-white" : "text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                    }`}
                    style={{
                      borderColor: active ? "var(--color-primary)" : "rgba(var(--color-primary-rgb),0.16)",
                      background: active ? "var(--color-primary)" : "transparent",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="font-body text-[10px] uppercase tracking-[0.18em] text-[var(--color-primary)] mb-2.5">Categories</p>
            <div className="flex flex-wrap gap-2">
              {categoryTabs.map((tab) => {
                const active = categorySlug === tab.slug;
                return (
                  <button
                    key={tab.slug || "all"}
                    type="button"
                    onClick={() => { setCategorySlug(tab.slug); onClose(); }}
                    className={`rounded-full border px-4 py-2 font-body text-[10px] uppercase tracking-[0.12em] transition-colors ${
                      active ? "text-white" : "text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                    }`}
                    style={{
                      borderColor: active ? "var(--color-primary)" : "rgba(var(--color-primary-rgb),0.16)",
                      background: active ? "var(--color-primary)" : "transparent",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full py-3 font-body text-[11px] uppercase tracking-[0.14em] text-white"
            style={{ background: "var(--color-primary)" }}
          >
            Done{activeFilterCount > 0 ? ` · ${activeFilterCount} active` : ""}
          </button>
        </div>
        <div className="h-4" />
      </div>
    </>
  );
};

// ── Product grid tile ────────────────────────────────────────────────────────
const ProductTile = ({
  product,
  onClick,
  onDelete,
  isDeleting,
}: {
  product: AdminProductListItem;
  onClick: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) => {
  const threshold = product.low_stock_threshold ?? 5;
  const isOut = product.stock_quantity === 0;
  const isLow = product.stock_quantity <= threshold && product.stock_quantity > 0;
  const isUnavailable = !product.is_available;

  const dotColor = isOut || isUnavailable
    ? "bg-[var(--color-danger)]"
    : isLow
    ? "bg-[var(--color-accent)]"
    : "bg-emerald-400";

  const letter = product.name.trim().charAt(0).toUpperCase();

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-square w-full overflow-hidden rounded-[12px] border border-[rgba(var(--color-primary-rgb),0.1)] bg-[var(--color-surface-alt)] transition-transform duration-200 group-hover:scale-[1.03]"
    >
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[rgba(var(--color-primary-rgb),0.06)]">
          <span className="font-display text-[22px] italic text-[rgba(var(--color-primary-rgb),0.35)]">
            {letter}
          </span>
        </div>
      )}

      {/* Status dot — top-right */}
      <span className={`absolute right-2 top-2 h-2.5 w-2.5 rounded-full shadow-sm ${dotColor}`} />

      {/* Delete button — bottom-right */}
      <span
        role="button"
        aria-label={`Delete ${product.name}`}
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className={`absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity duration-150 hover:bg-[var(--color-danger)] ${
          isDeleting ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {isDeleting ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </span>
    </button>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────
const AdminProductsPage = () => {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [availability, setAvailability] = useState<"all" | "available" | "unavailable">("all");
  const [categoryTabs, setCategoryTabs] = useState<Array<{ label: string; slug: string }>>(defaultCategoryTabs);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const [rows, setRows] = useState<AdminProductListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const offsetRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);

  // Keep hasMoreRef in sync
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);

  // Debounce search
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  // Reset and load first page when filters/search change
  useEffect(() => {
    let isMounted = true;
    setRows([]);
    setTotalCount(0);
    setHasMore(false);
    setIsLoading(true);
    setLoadError(null);
    offsetRef.current = 0;

    const load = async () => {
      try {
        const result = await fetchAdminProducts({
          searchTerm,
          categorySlug: categorySlug || undefined,
          availability,
          page: 1,
          pageSize: PAGE_SIZE,
        });
        if (!isMounted) return;
        setRows(result.rows);
        setTotalCount(result.totalCount);
        offsetRef.current = result.rows.length;
        setHasMore(result.rows.length < result.totalCount);
      } catch {
        if (!isMounted) return;
        setLoadError("Unable to load products.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void load();
    return () => { isMounted = false; };
  }, [searchTerm, categorySlug, availability]);

  // Load next batch of products
  const loadMore = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMoreRef.current) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const nextPage = Math.floor(offsetRef.current / PAGE_SIZE) + 1;
      const result = await fetchAdminProducts({
        searchTerm,
        categorySlug: categorySlug || undefined,
        availability,
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      setRows((prev) => [...prev, ...result.rows]);
      setTotalCount(result.totalCount);
      offsetRef.current += result.rows.length;
      setHasMore(offsetRef.current < result.totalCount);
    } catch {
      // silently ignore load-more errors
    } finally {
      setIsLoadingMore(false);
      isLoadingMoreRef.current = false;
    }
  }, [searchTerm, categorySlug, availability]);

  // Scroll listener for infinite load
  useEffect(() => {
    const handleScroll = () => {
      if (!hasMoreRef.current || isLoadingMoreRef.current) return;
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      if (total - scrolled < 400) {
        void loadMore();
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMore]);

  // Trigger loadMore if content doesn't fill the viewport after initial load
  useEffect(() => {
    if (isLoading || !hasMore) return;
    if (document.documentElement.scrollHeight <= window.innerHeight) {
      void loadMore();
    }
  }, [isLoading, hasMore, loadMore]);

  // Load categories
  useEffect(() => {
    let isMounted = true;
    const loadCategoryTabs = async () => {
      try {
        const categories = await fetchAdminCategories();
        if (!isMounted) return;
        const tabs = [
          ...defaultCategoryTabs,
          ...categories.map((c) => ({ label: c.name, slug: c.slug })),
        ];
        setCategoryTabs(tabs);
        setCategorySlug((cur) => (!cur ? cur : tabs.some((t) => t.slug === cur) ? cur : ""));
      } catch {
        if (!isMounted) return;
        setCategoryTabs(defaultCategoryTabs);
      }
    };
    void loadCategoryTabs();
    return () => { isMounted = false; };
  }, []);

  const onDelete = async (product: AdminProductListItem) => {
    setDeletingId(product.id);
    try {
      const usageCount = await fetchProductOrderCount(product.id);
      if (usageCount > 0) {
        window.alert(`This product has ${usageCount} orders and cannot be deleted. Set it to unavailable instead.`);
        return;
      }
      const shouldDelete = window.confirm(`Delete ${product.name}? This cannot be undone.`);
      if (!shouldDelete) return;
      await deleteAdminProduct(product.id, { name: product.name, slug: product.slug });
      setRows((prev) => prev.filter((r) => r.id !== product.id));
      setTotalCount((prev) => prev - 1);
    } finally {
      setDeletingId(null);
    }
  };

  const activeFilterCount =
    (availability !== "all" ? 1 : 0) + (categorySlug !== "" ? 1 : 0);

  return (
    <div className="admin-page lux-page-enter overflow-visible min-h-[calc(100dvh-3.5rem)] md:min-h-[calc(100dvh-4rem)] flex flex-col">
      <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col text-left">

        {/* ── Page header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-body text-[11px] uppercase tracking-[0.22em] text-[var(--color-primary)]">Catalog</p>
            <h1 className="mt-3 font-display text-[38px] italic leading-[1.04] text-[var(--color-navbar-solid-foreground)] sm:text-[50px]">
              Products
            </h1>
            <p className="mt-2 max-w-[680px] font-body text-[13px] leading-[1.8] text-[var(--color-muted)] sm:text-[14px]">
              Browse inventory, filter quickly, and jump into editing with the same smooth admin flow as Add with AI.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/products/add-with-ai"
              className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 font-body text-[11px] uppercase tracking-[0.12em] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.08)]"
              style={{
                borderColor: "rgba(var(--color-primary-rgb),0.2)",
                color: "var(--color-primary)",
                background: "rgba(var(--color-primary-rgb),0.04)",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Add with AI
            </Link>
            <Link
              to="/admin/products/new"
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-body text-[11px] uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--color-primary)" }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add New Product
            </Link>
          </div>
        </div>

        {/* ── Filter card ───────────────────────────────────────────────────────── */}
        <section
          className="mt-7 rounded-[28px] border bg-white p-4 shadow-[0_14px_48px_rgba(26,28,28,0.06)] sm:p-5"
          style={{ borderColor: "rgba(var(--color-primary-rgb),0.15)" }}
        >
          <div className="flex flex-col gap-4">

            {/* Search row */}
            <div className="flex items-center gap-2">
              <label className="relative block flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-primary)]" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by name or SKU..."
                  className="h-11 w-full rounded-full border bg-white pl-10 pr-4 font-body text-[13px] text-[var(--color-navbar-solid-foreground)] outline-none transition-colors placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)]"
                  style={{ borderColor: "rgba(var(--color-primary-rgb),0.18)" }}
                />
              </label>

              {/* Mobile: Filter button */}
              <button
                type="button"
                onClick={() => setFilterSheetOpen(true)}
                className="relative flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 font-body text-[11px] uppercase tracking-[0.12em] text-[var(--color-primary)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.06)] lg:hidden"
                style={{ borderColor: "rgba(var(--color-primary-rgb),0.2)" }}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filter
                {activeFilterCount > 0 && (
                  <span
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full font-body text-[9px] text-white"
                    style={{ background: "var(--color-primary)" }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Desktop/tablet filters */}
            <div className="hidden border-t border-[rgba(var(--color-primary-rgb),0.1)] pt-4 lg:flex lg:items-start lg:justify-between lg:gap-4">
              <div className="flex flex-wrap gap-2">
                {availabilityTabs.map((opt) => {
                  const active = availability === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAvailability(opt.value)}
                      className={`rounded-full border px-4 py-2 font-body text-[10px] uppercase tracking-[0.12em] transition-colors ${
                        active ? "text-white" : "text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                      }`}
                      style={{
                        borderColor: active ? "var(--color-primary)" : "rgba(var(--color-primary-rgb),0.16)",
                        background: active ? "var(--color-primary)" : "transparent",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="min-w-0 lg:max-w-[56%]">
                <p className="text-right font-body text-[10px] uppercase tracking-[0.16em] text-[var(--color-primary)]">Categories</p>
                <div className="admin-filter-scroll mt-2 flex justify-end gap-2 overflow-x-auto pb-1">
                  {categoryTabs.map((tab) => {
                    const active = categorySlug === tab.slug;
                    return (
                      <button
                        key={tab.slug || "all"}
                        type="button"
                        onClick={() => setCategorySlug(tab.slug)}
                        className={`shrink-0 rounded-full border px-4 py-2 font-body text-[10px] uppercase tracking-[0.12em] transition-colors ${
                          active ? "text-white" : "text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                        }`}
                        style={{
                          borderColor: active ? "var(--color-primary)" : "rgba(var(--color-primary-rgb),0.16)",
                          background: active ? "var(--color-primary)" : "transparent",
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Count */}
            <div className="border-t border-[rgba(var(--color-primary-rgb),0.1)] pt-3">
              <p className="font-body text-[11px] uppercase tracking-[0.12em] text-[var(--color-primary)]">
                {totalCount === 0 ? "No products found" : `${totalCount} product${totalCount === 1 ? "" : "s"} found`}
              </p>
            </div>
          </div>
        </section>

        {/* ── Product image grid ────────────────────────────────────────────────── */}
        <div className="mt-6 pb-10">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <p className="font-body text-[12px] text-[var(--color-muted-soft)]">Loading products...</p>
            </div>
          ) : loadError ? (
            <div className="flex items-center justify-center py-16">
              <p className="font-body text-[12px] text-[var(--color-danger)]">{loadError}</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="font-body text-[12px] text-[var(--color-muted-soft)]">No products found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                {rows.map((product) => (
                  <ProductTile
                    key={product.id}
                    product={product}
                    onClick={() => navigate(`/admin/products/${product.id}/edit`)}
                    onDelete={() => void onDelete(product)}
                    isDeleting={deletingId === product.id}
                  />
                ))}
              </div>

              {/* Infinite scroll status */}
              {isLoadingMore && (
                <div className="flex items-center justify-center py-8">
                  <p className="font-body text-[12px] text-[var(--color-muted-soft)]">Loading more...</p>
                </div>
              )}
              {!hasMore && rows.length > 0 && (
                <p className="mt-8 text-center font-body text-[11px] uppercase tracking-[0.12em] text-[var(--color-muted-soft)]">
                  All {totalCount} product{totalCount === 1 ? "" : "s"} loaded
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Mobile filter bottom sheet ─────────────────────────────────────────── */}
      <FilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        availability={availability}
        setAvailability={setAvailability}
        categorySlug={categorySlug}
        setCategorySlug={setCategorySlug}
        categoryTabs={categoryTabs}
      />
    </div>
  );
};

export default AdminProductsPage;
