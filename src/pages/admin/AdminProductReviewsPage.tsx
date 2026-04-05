import { ChevronDown, ChevronUp, ExternalLink, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDateShort } from "@/lib/adminFormatting";
import {
  fetchAdminProductReviews,
  updateAdminProductReviewStatus,
  type AdminProductReviewRow,
  type ReviewStatus,
} from "@/services/reviewService";

type StatusFilter = "all" | ReviewStatus;

const PAGE_SIZE = 20;

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

const statusTabs: Array<{ label: string; value: StatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Pending", value: "pending" },
  { label: "Hidden", value: "rejected" },
];

const renderStars = (rating: number, sizeClass = "h-3 w-3") => (
  <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
    {STAR_VALUES.map((starValue) => {
      const active = rating >= starValue;
      return (
        <Star
          key={`star-${starValue}`}
          className={`${sizeClass} ${active ? "text-[var(--color-accent)]" : "text-[var(--color-muted-soft)]"}`}
          style={active ? { fill: "currentColor" } : undefined}
        />
      );
    })}
  </div>
);

const statusBadgeClass = (status: ReviewStatus) => {
  if (status === "approved") {
    return "border-[var(--color-accent)] text-[var(--color-accent)]";
  }
  if (status === "rejected") {
    return "border-[var(--color-danger)] text-[var(--color-danger)]";
  }
  return "border-[var(--color-border)] text-[var(--color-muted-soft)]";
};

const snippet = (text: string, max = 140) => {
  const trimmed = text.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max)}...`;
};

const truncateHalf = (value: string, fallback = "-") => {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const keepLength = Math.max(2, Math.ceil(trimmed.length * 0.5));
  return `${trimmed.slice(0, keepLength)}...`;
};

const FilterSheet = ({
  open,
  onClose,
  statusFilter,
  setStatusFilter,
  setPage,
  onClearFilters,
}: {
  open: boolean;
  onClose: () => void;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  setPage: (page: number) => void;
  onClearFilters: () => void;
}) => {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const activeFilterCount = statusFilter !== "all" ? 1 : 0;

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 lg:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out lg:hidden ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "80dvh", overflowY: "auto" }}
      >
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-[rgba(var(--color-primary-rgb),0.15)]" />
        </div>
        <div className="flex items-center justify-between border-b border-[rgba(var(--color-primary-rgb),0.08)] px-5 py-3">
          <p className="font-body text-[14px] font-semibold text-[var(--color-navbar-solid-foreground)]">Filters</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-[rgba(var(--color-primary-rgb),0.06)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          <div>
            <p className="mb-2.5 font-body text-[10px] uppercase tracking-[0.18em] text-[var(--color-primary)]">Status</p>
            <div className="flex flex-wrap gap-2">
              {statusTabs.map((tab) => {
                const active = tab.value === statusFilter;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => {
                      setStatusFilter(tab.value);
                      setPage(1);
                    }}
                    className={`rounded-full border px-4 py-2 font-body text-[10px] uppercase tracking-[0.12em] transition-colors ${
                      active
                        ? "text-white"
                        : "text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
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
            onClick={() => {
              onClearFilters();
              onClose();
            }}
            className="w-full rounded-full border py-3 font-body text-[11px] uppercase tracking-[0.14em] text-[var(--color-primary)]"
            style={{ borderColor: "rgba(var(--color-primary-rgb),0.2)" }}
          >
            Clear Filters
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full py-3 font-body text-[11px] uppercase tracking-[0.14em] text-white"
            style={{ background: "var(--color-primary)" }}
          >
            Done{activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ""}
          </button>
        </div>

        <div className="h-4" />
      </div>
    </>
  );
};

const AdminProductReviewsPage = () => {
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const [rows, setRows] = useState<AdminProductReviewRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actioningReviewId, setActioningReviewId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedCompactRowId, setExpandedCompactRowId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (!message) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setMessage(null);
    }, 3500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const result = await fetchAdminProductReviews({
          searchTerm,
          status: statusFilter,
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
        setLoadError("Unable to load product reviews.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [searchTerm, statusFilter, page]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let current = start; current <= end; current += 1) {
      pages.push(current);
    }
    return pages;
  }, [page, totalPages]);

  const hasActiveFilters = Boolean(searchTerm || statusFilter !== "all");
  const activeFilterCount = statusFilter !== "all" ? 1 : 0;

  const clearFilters = () => {
    setSearchInput("");
    setSearchTerm("");
    setStatusFilter("all");
    setPage(1);
  };

  const onUpdateStatus = async (row: AdminProductReviewRow, status: ReviewStatus) => {
    setActioningReviewId(row.id);
    try {
      await updateAdminProductReviewStatus(row.id, status);
      setRows((current) => current.map((entry) => (entry.id === row.id ? { ...entry, status } : entry)));
      setMessage(status === "approved" ? "Review approved." : "Review hidden.");
    } catch {
      setMessage("Unable to update review status.");
    } finally {
      setActioningReviewId(null);
    }
  };

  return (
    <div className="admin-page lux-page-enter overflow-visible min-h-[calc(100dvh-3.5rem)] md:min-h-[calc(100dvh-4rem)] flex flex-col">
      <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col text-left">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-body text-[11px] uppercase tracking-[0.22em] text-[var(--color-primary)]">Merchandise</p>
            <h1 className="mt-3 font-display text-[38px] italic leading-[1.04] text-[var(--color-navbar-solid-foreground)] sm:text-[50px]">
              Product Reviews
            </h1>
            <p className="mt-2 max-w-[680px] font-body text-[13px] leading-[1.8] text-[var(--color-muted)] sm:text-[14px]">
              Moderate feedback quickly with the same focused table flow used on the Products page.
            </p>
          </div>
        </div>

        {message ? (
          <p className="mt-4 rounded-full border px-4 py-2 text-center font-body text-[11px] uppercase tracking-[0.08em] text-[var(--color-accent)]" style={{ borderColor: "rgba(var(--color-primary-rgb),0.18)" }}>
            {message}
          </p>
        ) : null}

        <section
          className="mt-7 rounded-[28px] border bg-white p-4 shadow-[0_14px_48px_rgba(26,28,28,0.06)] sm:p-5"
          style={{ borderColor: "rgba(var(--color-primary-rgb),0.15)" }}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <label className="relative block flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-primary)]" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search title, body, or author..."
                  className="h-11 w-full rounded-full border bg-white pl-10 pr-4 font-body text-[13px] text-[var(--color-navbar-solid-foreground)] outline-none transition-colors placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)]"
                  style={{ borderColor: "rgba(var(--color-primary-rgb),0.18)" }}
                />
              </label>

              <button
                type="button"
                onClick={() => setFilterSheetOpen(true)}
                className="relative flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 font-body text-[11px] uppercase tracking-[0.12em] text-[var(--color-primary)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.06)] lg:hidden"
                style={{ borderColor: "rgba(var(--color-primary-rgb),0.2)" }}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filter
                {activeFilterCount > 0 ? (
                  <span
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full font-body text-[9px] text-white"
                    style={{ background: "var(--color-primary)" }}
                  >
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </div>

            <div className="hidden border-t border-[rgba(var(--color-primary-rgb),0.1)] pt-4 lg:flex lg:items-center lg:justify-between lg:gap-3">
              <div className="flex flex-wrap gap-2">
                {statusTabs.map((tab) => {
                  const active = tab.value === statusFilter;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => {
                        setStatusFilter(tab.value);
                        setPage(1);
                      }}
                      className={`rounded-full border px-4 py-2 font-body text-[10px] uppercase tracking-[0.12em] transition-colors ${
                        active
                          ? "text-white"
                          : "text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
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
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-full border px-4 py-2 font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-primary)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.06)]"
                  style={{ borderColor: "rgba(var(--color-primary-rgb),0.18)" }}
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[rgba(var(--color-primary-rgb),0.1)] pt-3">
              <p className="font-body text-[11px] uppercase tracking-[0.12em] text-[var(--color-primary)]">
                {totalCount === 0 ? "No reviews found" : `${totalCount} review${totalCount === 1 ? "" : "s"} found`}
              </p>
              <p className="font-body text-[11px] text-[var(--color-muted)]">
                Page {Math.min(page, totalPages)} of {totalPages}
              </p>
            </div>
          </div>
        </section>

        <div
          className="mt-4 hidden overflow-hidden rounded-[24px] border bg-white lg:block"
          style={{ borderColor: "rgba(var(--color-primary-rgb),0.12)" }}
        >
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col style={{ width: "19%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "25%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead className="bg-[rgba(var(--color-primary-rgb),0.03)]">
              <tr>
                {["Product", "Customer", "Rating", "Review", "Status", "Submitted", "Actions"].map((heading) => (
                  <th
                    key={heading}
                    className="px-2 py-2.5 text-left font-body text-[9px] uppercase tracking-[0.11em] text-[var(--color-muted-soft)] first:pl-3 last:pr-3"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-9 text-center font-body text-[12px] text-[var(--color-muted-soft)]">
                    Loading reviews...
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={7} className="px-3 py-9 text-center font-body text-[12px] text-[var(--color-danger)]">
                    {loadError}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-9 text-center font-body text-[12px] text-[var(--color-muted-soft)]">
                    No reviews found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const customerLabel = row.authorDisplayName || row.customerName;
                  return (
                    <tr key={row.id} className="border-t border-[rgba(var(--color-primary-rgb),0.1)] hover:bg-[rgba(var(--color-primary-rgb),0.04)]">
                      <td className="px-2 py-3 pl-3">
                        {row.productSlug ? (
                          <Link
                            to={`/shop/${row.productSlug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate font-body text-[12px] text-[var(--color-primary)] hover:text-[var(--color-accent)]"
                            title={row.productName}
                          >
                            {truncateHalf(row.productName, "Product")}
                          </Link>
                        ) : (
                          <p className="truncate font-body text-[12px] text-[var(--color-navbar-solid-foreground)]" title={row.productName}>
                            {truncateHalf(row.productName, "Product")}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <p className="truncate font-body text-[12px] text-[var(--color-navbar-solid-foreground)]" title={customerLabel}>
                          {truncateHalf(customerLabel, "Customer")}
                        </p>
                        <p className="mt-0.5 truncate font-body text-[9px] text-[var(--color-muted-soft)]" title={row.customerEmail || "-"}>
                          {truncateHalf(row.customerEmail || "-", "-")}
                        </p>
                      </td>
                      <td className="px-2 py-3">
                        {renderStars(row.rating, "h-2.5 w-2.5")}
                        <p className="mt-1 font-body text-[9px] text-[var(--color-muted-soft)]">{row.rating}/5</p>
                      </td>
                      <td className="px-2 py-3">
                        {row.title ? (
                          <p className="truncate font-body text-[11px] text-[var(--color-navbar-solid-foreground)]" title={row.title}>
                            {truncateHalf(row.title, "-")}
                          </p>
                        ) : (
                          <p className="font-body text-[10px] text-[var(--color-muted-soft)]">No title</p>
                        )}
                        <p className="mt-0.5 truncate font-body text-[10px] text-[var(--color-muted)]" title={row.body}>
                          {snippet(row.body, 90)}
                        </p>
                      </td>
                      <td className="px-2 py-3">
                        <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-1 font-body text-[8px] uppercase tracking-[0.08em] ${statusBadgeClass(row.status)}`}>
                          {row.status === "rejected" ? "Hidden" : row.status}
                        </span>
                      </td>
                      <td className="px-2 py-3 font-body text-[10px] text-[var(--color-muted-soft)]">{formatDateShort(row.createdAt)}</td>
                      <td className="px-2 py-3 pr-3">
                        <div className="flex items-center justify-end gap-1">
                          {row.status !== "approved" ? (
                            <button
                              type="button"
                              onClick={() => void onUpdateStatus(row, "approved")}
                              disabled={actioningReviewId === row.id}
                              className="rounded-full border px-2 py-1 font-body text-[8px] uppercase tracking-[0.08em] text-[var(--color-accent)] transition-colors hover:border-[rgba(var(--color-primary-rgb),0.2)] hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                              style={{ borderColor: "rgba(var(--color-primary-rgb),0.16)" }}
                            >
                              Approve
                            </button>
                          ) : null}
                          {row.status !== "rejected" ? (
                            <button
                              type="button"
                              onClick={() => void onUpdateStatus(row, "rejected")}
                              disabled={actioningReviewId === row.id}
                              className="rounded-full border px-2 py-1 font-body text-[8px] uppercase tracking-[0.08em] text-[var(--color-muted)] transition-colors hover:border-[rgba(var(--color-danger-rgb),0.24)] hover:text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-60"
                              style={{ borderColor: "rgba(var(--color-primary-rgb),0.16)" }}
                            >
                              Hide
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div
          className="mt-4 overflow-hidden rounded-[22px] border bg-white lg:hidden"
          style={{ borderColor: "rgba(var(--color-primary-rgb),0.12)" }}
        >
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col style={{ width: "38%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead className="bg-[rgba(var(--color-primary-rgb),0.03)]">
              <tr>
                {["Product", "Rating", "Status", "Action"].map((heading) => (
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
                    Loading reviews...
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
                    No reviews found.
                  </td>
                </tr>
              ) : (
                rows.flatMap((row) => {
                  const isExpanded = expandedCompactRowId === row.id;
                  const customerLabel = row.authorDisplayName || row.customerName;
                  return [
                    <tr key={`${row.id}-main`} className="border-t border-[rgba(var(--color-primary-rgb),0.1)] hover:bg-[rgba(var(--color-primary-rgb),0.04)]">
                      <td className="px-2 py-2.5 pl-3">
                        <p className="truncate font-body text-[12px] text-[var(--color-navbar-solid-foreground)]" title={row.productName}>
                          {truncateHalf(row.productName, "Product")}
                        </p>
                      </td>
                      <td className="px-2 py-2.5">
                        {renderStars(row.rating, "h-2.5 w-2.5")}
                        <p className="mt-1 font-body text-[9px] text-[var(--color-muted-soft)]">{row.rating}/5</p>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-1 font-body text-[8px] uppercase tracking-[0.08em] ${statusBadgeClass(row.status)}`}>
                          {row.status === "rejected" ? "Hidden" : row.status}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 pr-3 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedCompactRowId((current) => (current === row.id ? null : row.id))}
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-1 font-body text-[8px] uppercase tracking-[0.08em] text-[var(--color-primary)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.06)]"
                          style={{ borderColor: "rgba(var(--color-primary-rgb),0.2)" }}
                        >
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          Details
                        </button>
                      </td>
                    </tr>,
                    isExpanded ? (
                      <tr key={`${row.id}-details`} className="border-t border-[rgba(var(--color-primary-rgb),0.08)] bg-[rgba(var(--color-primary-rgb),0.03)]">
                        <td colSpan={4} className="px-3 py-2.5">
                          <div className="space-y-2">
                            <div>
                              <p className="font-body text-[9px] uppercase tracking-[0.08em] text-[var(--color-muted)]">Customer</p>
                              <p className="truncate font-body text-[11px] text-[var(--color-navbar-solid-foreground)]" title={customerLabel}>
                                {truncateHalf(customerLabel, "Customer")}
                              </p>
                              <p className="truncate font-body text-[10px] text-[var(--color-muted-soft)]" title={row.customerEmail || "-"}>
                                {truncateHalf(row.customerEmail || "-", "-")}
                              </p>
                            </div>

                            <div>
                              <p className="font-body text-[9px] uppercase tracking-[0.08em] text-[var(--color-muted)]">Review</p>
                              {row.title ? (
                                <p className="truncate font-body text-[11px] text-[var(--color-navbar-solid-foreground)]" title={row.title}>
                                  {truncateHalf(row.title, "-")}
                                </p>
                              ) : null}
                              <p className="font-body text-[10px] text-[var(--color-muted)]" title={row.body}>{snippet(row.body, 180)}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <p className="font-body text-[10px] text-[var(--color-navbar-solid-foreground)]">
                                <span className="mr-1 text-[var(--color-muted)]">Submitted:</span>
                                {formatDateShort(row.createdAt)}
                              </p>
                              <p className="font-body text-[10px] text-[var(--color-navbar-solid-foreground)]">
                                <span className="mr-1 text-[var(--color-muted)]">Status:</span>
                                {row.status === "rejected" ? "Hidden" : row.status}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                              {row.productSlug ? (
                                <Link
                                  to={`/shop/${row.productSlug}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 font-body text-[9px] uppercase tracking-[0.08em] text-[var(--color-primary)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.06)]"
                                  style={{ borderColor: "rgba(var(--color-primary-rgb),0.2)" }}
                                >
                                  Product
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              ) : (
                                <span className="font-body text-[10px] text-[var(--color-muted-soft)]">Product link unavailable</span>
                              )}

                              <div className="flex items-center gap-1">
                                {row.status !== "approved" ? (
                                  <button
                                    type="button"
                                    onClick={() => void onUpdateStatus(row, "approved")}
                                    disabled={actioningReviewId === row.id}
                                    className="rounded-full border px-2 py-1 font-body text-[8px] uppercase tracking-[0.08em] text-[var(--color-accent)] transition-colors hover:border-[rgba(var(--color-primary-rgb),0.2)] hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                                    style={{ borderColor: "rgba(var(--color-primary-rgb),0.16)" }}
                                  >
                                    Approve
                                  </button>
                                ) : null}
                                {row.status !== "rejected" ? (
                                  <button
                                    type="button"
                                    onClick={() => void onUpdateStatus(row, "rejected")}
                                    disabled={actioningReviewId === row.id}
                                    className="rounded-full border px-2 py-1 font-body text-[8px] uppercase tracking-[0.08em] text-[var(--color-muted)] transition-colors hover:border-[rgba(var(--color-danger-rgb),0.24)] hover:text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-60"
                                    style={{ borderColor: "rgba(var(--color-primary-rgb),0.16)" }}
                                  >
                                    Hide
                                  </button>
                                ) : null}
                              </div>
                            </div>
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

        <div
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border bg-white px-4 py-3"
          style={{ borderColor: "rgba(var(--color-primary-rgb),0.12)" }}
        >
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="rounded-full border px-4 py-2 font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-primary)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.06)] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: "rgba(var(--color-primary-rgb),0.2)" }}
          >
            Previous
          </button>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={`h-8 min-w-8 rounded-full px-3 font-body text-[11px] transition-colors ${
                  pageNumber === page
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-muted)] hover:bg-[rgba(var(--color-primary-rgb),0.08)] hover:text-[var(--color-primary)]"
                }`}
              >
                {pageNumber}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
            className="rounded-full border px-4 py-2 font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-primary)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.06)] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: "rgba(var(--color-primary-rgb),0.2)" }}
          >
            Next
          </button>
        </div>
      </div>

      <FilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        setPage={setPage}
        onClearFilters={clearFilters}
      />
    </div>
  );
};

export default AdminProductReviewsPage;
