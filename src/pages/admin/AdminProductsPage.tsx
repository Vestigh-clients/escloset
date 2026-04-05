import { ChevronDown, ChevronUp, Plus, Search, Sparkles, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  deleteAdminProduct,
  fetchAdminCategories,
  fetchAdminProducts,
  fetchProductOrderCount,
  type AdminProductListItem,
} from "@/services/adminService";
import { formatCurrency } from "@/lib/adminFormatting";

const PAGE_SIZE = 20;
const defaultCategoryTabs = [{ label: "All", slug: "" }];
const availabilityTabs = [
  { label: "All", value: "all" },
  { label: "Available", value: "available" },
  { label: "Unavailable", value: "unavailable" },
] as const;

const truncateSkuByHalf = (sku: string | null) => {
  const value = sku?.trim();
  if (!value) return "No SKU";
  const keepLength = Math.max(2, Math.ceil(value.length * 0.5));
  return `${value.slice(0, keepLength)}...`;
};

const truncateNameByHalf = (name: string) => {
  const value = name.trim();
  if (!value) return "Untitled product";
  const keepLength = Math.max(2, Math.ceil(value.length * 0.5));
  return `${value.slice(0, keepLength)}...`;
};

// ── Bottom sheet for mobile filters ─────────────────────────────────────────
const FilterSheet = ({
  open,
  onClose,
  availability,
  setAvailability,
  categorySlug,
  setCategorySlug,
  categoryTabs,
  setPage,
}: {
  open: boolean;
  onClose: () => void;
  availability: "all" | "available" | "unavailable";
  setAvailability: (v: "all" | "available" | "unavailable") => void;
  categorySlug: string;
  setCategorySlug: (v: string) => void;
  categoryTabs: Array<{ label: string; slug: string }>;
  setPage: (p: number) => void;
}) => {
  // close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const activeFilterCount =
    (availability !== "all" ? 1 : 0) + (categorySlug !== "" ? 1 : 0);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out lg:hidden ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "80dvh", overflowY: "auto" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[rgba(var(--color-primary-rgb),0.15)]" />
        </div>

        {/* Header */}
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
          {/* Availability */}
          <div>
            <p className="font-body text-[10px] uppercase tracking-[0.18em] text-[var(--color-primary)] mb-2.5">Availability</p>
            <div className="flex flex-wrap gap-2">
              {availabilityTabs.map((opt) => {
                const active = availability === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setAvailability(opt.value); setPage(1); }}
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

          {/* Categories */}
          <div>
            <p className="font-body text-[10px] uppercase tracking-[0.18em] text-[var(--color-primary)] mb-2.5">Categories</p>
            <div className="flex flex-wrap gap-2">
              {categoryTabs.map((tab) => {
                const active = categorySlug === tab.slug;
                return (
                  <button
                    key={tab.slug || "all"}
                    type="button"
                    onClick={() => { setCategorySlug(tab.slug); setPage(1); }}
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

          {/* Done button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full py-3 font-body text-[11px] uppercase tracking-[0.14em] text-white"
            style={{ background: "var(--color-primary)" }}
          >
            Done{activeFilterCount > 0 ? ` · ${activeFilterCount} active` : ""}
          </button>
        </div>

        {/* Safe-area spacer */}
        <div className="h-4" />
      </div>
    </>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────
const AdminProductsPage = () => {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [availability, setAvailability] = useState<"all" | "available" | "unavailable">("all");
  const [page, setPage] = useState(1);
  const [categoryTabs, setCategoryTabs] = useState<Array<{ label: string; slug: string }>>(defaultCategoryTabs);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const [rows, setRows] = useState<AdminProductListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedCompactRowId, setExpandedCompactRowId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let isMounted = true;
    const loadProducts = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const result = await fetchAdminProducts({
          searchTerm,
          categorySlug: categorySlug || undefined,
          availability,
          page,
          pageSize: PAGE_SIZE,
        });
        if (!isMounted) return;
        setRows(result.rows);
        setTotalCount(result.totalCount);
      } catch {
        if (!isMounted) return;
        setRows([]);
        setTotalCount(0);
        setLoadError("Unable to load products.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    void loadProducts();
    return () => { isMounted = false; };
  }, [searchTerm, categorySlug, availability, page]);

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

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let cur = start; cur <= end; cur++) pages.push(cur);
    return pages;
  }, [page, totalPages]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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
      const refreshed = await fetchAdminProducts({
        searchTerm, categorySlug: categorySlug || undefined, availability, page, pageSize: PAGE_SIZE,
      });
      setRows(refreshed.rows);
      setTotalCount(refreshed.totalCount);
    } finally {
      setDeletingId(null);
    }
  };

  const openEditor = (productId: string) => navigate(`/admin/products/${productId}/edit`);

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

        {/* ── Filter card ───────────────────────────────────────────────────────
            Desktop: search + availability + categories
            Mobile:  search + "Filter" button that opens the bottom sheet
        ────────────────────────────────────────────────────────────────────── */}
        <section
          className="mt-7 rounded-[28px] border bg-white p-4 shadow-[0_14px_48px_rgba(26,28,28,0.06)] sm:p-5"
          style={{ borderColor: "rgba(var(--color-primary-rgb),0.15)" }}
        >
          <div className="flex flex-col gap-4">

            {/* Search row */}
            <div className="flex items-center gap-2">
              {/* Search input — full width on mobile, capped on desktop */}
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

            {/* Desktop/tablet filters under search */}
            <div className="hidden border-t border-[rgba(var(--color-primary-rgb),0.1)] pt-4 lg:flex lg:items-start lg:justify-between lg:gap-4">
              <div className="flex flex-wrap gap-2">
                {availabilityTabs.map((opt) => {
                  const active = availability === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setAvailability(opt.value); setPage(1); }}
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
                        onClick={() => { setCategorySlug(tab.slug); setPage(1); }}
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

            {/* Count + page */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[rgba(var(--color-primary-rgb),0.1)] pt-3">
              <p className="font-body text-[11px] uppercase tracking-[0.12em] text-[var(--color-primary)]">
                {totalCount === 0 ? "No products found" : `${totalCount} product${totalCount === 1 ? "" : "s"} found`}
              </p>
              <p className="font-body text-[11px] text-[var(--color-muted)]">
                Page {Math.min(page, totalPages)} of {totalPages}
              </p>
            </div>
          </div>
        </section>

        {/* ── Desktop table (lg+) ───────────────────────────────────────────────── */}
        <div
          className="mt-4 hidden overflow-hidden rounded-[24px] border bg-white lg:block"
          style={{ borderColor: "rgba(var(--color-primary-rgb),0.12)" }}
        >
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col style={{ width: "8%" }} />
              <col style={{ width: "29%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>
              <thead className="bg-[rgba(var(--color-primary-rgb),0.03)]">
                <tr>
                  {["Image", "Name & SKU", "Category", "Price", "Stock", "Status", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="px-2 py-2.5 text-left font-body text-[9px] uppercase tracking-[0.11em] text-[var(--color-muted-soft)] first:pl-3 last:pr-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="px-3 py-9 text-center font-body text-[12px] text-[var(--color-muted-soft)]">Loading products...</td></tr>
                ) : loadError ? (
                  <tr><td colSpan={7} className="px-3 py-9 text-center font-body text-[12px] text-[var(--color-danger)]">{loadError}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-9 text-center font-body text-[12px] text-[var(--color-muted-soft)]">No products found.</td></tr>
                ) : (
                  rows.map((product) => {
                    const threshold = product.low_stock_threshold ?? 5;
                    const isLow = product.stock_quantity <= threshold && product.stock_quantity > 0;
                    const isOut = product.stock_quantity === 0;
                    return (
                      <tr
                        key={product.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openEditor(product.id)}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEditor(product.id); }
                        }}
                        className="cursor-pointer border-t border-[rgba(var(--color-primary-rgb),0.1)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                      >
                        <td className="px-2 py-3 pl-3">
                          <div className="h-14 w-10 overflow-hidden rounded-[10px] border border-[rgba(var(--color-primary-rgb),0.12)] bg-[var(--color-surface-alt)]">
                            {product.image_url
                              ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                              : <div className="h-full w-full bg-[var(--color-surface-strong)]" />}
                          </div>
                        </td>
                        <td className="px-2 py-3">
                          <p className="truncate font-body text-[12px] text-[var(--color-navbar-solid-foreground)]" title={product.name}>
                            {truncateNameByHalf(product.name)}
                          </p>
                          <p className="mt-0.5 truncate font-body text-[9px] uppercase tracking-[0.05em] text-[var(--color-muted-soft)]">
                            {truncateSkuByHalf(product.sku)}
                          </p>
                        </td>
                        <td className="px-2 py-3 font-body text-[10px] uppercase tracking-[0.06em] text-[var(--color-accent)]">
                          <span className="block truncate" title={product.category_name || "Uncategorized"}>
                            {product.category_name || "Uncategorized"}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <p className="whitespace-nowrap font-body text-[12px] text-[var(--color-navbar-solid-foreground)]">{formatCurrency(product.price)}</p>
                          {product.compare_at_price && (
                            <p className="whitespace-nowrap font-body text-[10px] text-[var(--color-muted-soft)] line-through">{formatCurrency(product.compare_at_price)}</p>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          <p className={`font-body text-[12px] ${isOut ? "text-[var(--color-danger)]" : isLow ? "text-[var(--color-accent)]" : "text-[var(--color-navbar-solid-foreground)]"}`}>
                            {product.stock_quantity}
                          </p>
                          {isLow && <span className="mt-1 inline-block rounded-full bg-[rgba(var(--color-accent-rgb),0.15)] px-1.5 py-0.5 font-body text-[7px] uppercase tracking-[0.06em] text-[var(--color-accent)]">Low</span>}
                          {isOut && <span className="mt-1 inline-block rounded-full bg-[rgba(var(--color-danger-rgb),0.15)] px-1.5 py-0.5 font-body text-[7px] uppercase tracking-[0.06em] text-[var(--color-danger)]">Out</span>}
                        </td>
                        <td className="px-2 py-3">
                          <span className={`inline-block whitespace-nowrap rounded-full px-2 py-1 font-body text-[8px] uppercase tracking-[0.08em] ${product.is_available ? "border border-[var(--color-accent)] text-[var(--color-accent)]" : "border border-[var(--color-danger)] text-[var(--color-danger)]"}`}>
                            {product.is_available ? "Available" : "Unavailable"}
                          </span>
                        </td>
                        <td className="px-2 py-3 pr-3">
                          <div className="flex items-center justify-end gap-1.5 font-body text-[9px] uppercase tracking-[0.08em]">
                            <button
                              type="button"
                              disabled={deletingId === product.id}
                              onClick={(e) => { e.stopPropagation(); void onDelete(product); }}
                              className="whitespace-nowrap rounded-full border border-transparent px-2.5 py-1 text-[var(--color-muted)] transition-colors hover:border-[rgba(var(--color-danger-rgb),0.25)] hover:text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingId === product.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
        </div>

        {/* Compact table (mobile/tablet) */}
        <div
          className="mt-4 overflow-hidden rounded-[22px] border bg-white lg:hidden"
          style={{ borderColor: "rgba(var(--color-primary-rgb),0.12)" }}
        >
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col style={{ width: "18%" }} />
              <col style={{ width: "42%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "22%" }} />
            </colgroup>
            <thead className="bg-[rgba(var(--color-primary-rgb),0.03)]">
              <tr>
                {["Image", "Product", "Price", "Action"].map((heading) => (
                  <th
                    key={heading}
                    className="px-2 py-2 text-left font-body text-[9px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)] first:pl-3 last:pr-3"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-9 text-center font-body text-[12px] text-[var(--color-muted-soft)]">
                    Loading products...
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={4} className="px-3 py-9 text-center font-body text-[12px] text-[var(--color-danger)]">
                    {loadError}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-9 text-center font-body text-[12px] text-[var(--color-muted-soft)]">
                    No products found.
                  </td>
                </tr>
              ) : (
                rows.flatMap((product) => {
                  const threshold = product.low_stock_threshold ?? 5;
                  const isLow = product.stock_quantity <= threshold && product.stock_quantity > 0;
                  const isOut = product.stock_quantity === 0;
                  const isExpanded = expandedCompactRowId === product.id;

                  return [
                    <tr
                      key={`${product.id}-main`}
                      role="button"
                      tabIndex={0}
                      onClick={() => openEditor(product.id)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openEditor(product.id);
                        }
                      }}
                      className="cursor-pointer border-t border-[rgba(var(--color-primary-rgb),0.1)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                    >
                      <td className="px-2 py-2.5 pl-3">
                        <div className="h-12 w-9 overflow-hidden rounded-[8px] border border-[rgba(var(--color-primary-rgb),0.12)] bg-[var(--color-surface-alt)]">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full bg-[var(--color-surface-strong)]" />
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <p className="truncate font-body text-[12px] text-[var(--color-navbar-solid-foreground)]" title={product.name}>
                          {truncateNameByHalf(product.name)}
                        </p>
                        <p className="mt-0.5 truncate font-body text-[9px] uppercase tracking-[0.05em] text-[var(--color-muted-soft)]" title={product.sku || "No SKU"}>
                          {truncateSkuByHalf(product.sku)}
                        </p>
                      </td>
                      <td className="px-2 py-2.5 align-top">
                        <p className="whitespace-nowrap font-body text-[12px] text-[var(--color-navbar-solid-foreground)]">
                          {formatCurrency(product.price)}
                        </p>
                        {product.compare_at_price ? (
                          <p className="whitespace-nowrap font-body text-[10px] text-[var(--color-muted-soft)] line-through">
                            {formatCurrency(product.compare_at_price)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2 py-2.5 pr-3">
                        <div className="flex flex-col items-end gap-1.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpandedCompactRowId((current) => (current === product.id ? null : product.id));
                            }}
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-1 font-body text-[8px] uppercase tracking-[0.08em] text-[var(--color-primary)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.06)]"
                            style={{ borderColor: "rgba(var(--color-primary-rgb),0.2)" }}
                          >
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            Details
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === product.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void onDelete(product);
                            }}
                            className="rounded-full border border-transparent px-2.5 py-1 font-body text-[8px] uppercase tracking-[0.08em] text-[var(--color-muted)] transition-colors hover:border-[rgba(var(--color-danger-rgb),0.25)] hover:text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingId === product.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>,
                    isExpanded ? (
                      <tr key={`${product.id}-details`} className="border-t border-[rgba(var(--color-primary-rgb),0.08)] bg-[rgba(var(--color-primary-rgb),0.03)]">
                        <td colSpan={4} className="px-3 py-2.5">
                          <div className="grid grid-cols-2 gap-x-3 gap-y-2 font-body text-[10px] text-[var(--color-navbar-solid-foreground)]">
                            <p className="truncate" title={product.category_name || "Uncategorized"}>
                              <span className="mr-1 text-[var(--color-muted)]">Category:</span>
                              {product.category_name || "Uncategorized"}
                            </p>
                            <p>
                              <span className="mr-1 text-[var(--color-muted)]">Status:</span>
                              <span className={product.is_available ? "text-[var(--color-accent)]" : "text-[var(--color-danger)]"}>
                                {product.is_available ? "Available" : "Unavailable"}
                              </span>
                            </p>
                            <p>
                              <span className="mr-1 text-[var(--color-muted)]">Stock:</span>
                              <span className={isOut ? "text-[var(--color-danger)]" : isLow ? "text-[var(--color-accent)]" : ""}>
                                {product.stock_quantity}
                              </span>
                              {isLow ? <span className="ml-1 text-[var(--color-accent)]">(Low)</span> : null}
                              {isOut ? <span className="ml-1 text-[var(--color-danger)]">(Out)</span> : null}
                            </p>
                            {product.compare_at_price ? (
                              <p>
                                <span className="mr-1 text-[var(--color-muted)]">Compare:</span>
                                {formatCurrency(product.compare_at_price)}
                              </p>
                            ) : (
                              <p />
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null,
                  ];
                })
              )}
            </tbody>
          </table>
        </div>
        {/* ── Pagination ────────────────────────────────────────────────────────── */}
        <div
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border bg-white px-4 py-3"
          style={{ borderColor: "rgba(var(--color-primary-rgb),0.12)" }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-full border px-4 py-2 font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-primary)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.06)] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: "rgba(var(--color-primary-rgb),0.2)" }}
          >
            Previous
          </button>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {pageNumbers.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`h-8 min-w-8 rounded-full px-3 font-body text-[11px] transition-colors ${
                  n === page
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-muted)] hover:bg-[rgba(var(--color-primary-rgb),0.08)] hover:text-[var(--color-primary)]"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-full border px-4 py-2 font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-primary)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.06)] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: "rgba(var(--color-primary-rgb),0.2)" }}
          >
            Next
          </button>
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
        setPage={setPage}
      />
    </div>
  );
};

export default AdminProductsPage;

