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

const renderStars = (rating: number) => (
  <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
    {STAR_VALUES.map((starValue) => (
      <span
        key={`star-${starValue}`}
        className={`text-[12px] leading-none ${rating >= starValue ? "text-[var(--color-accent)]" : "text-[var(--color-muted-soft)]"}`}
      >
        ★
      </span>
    ))}
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

const AdminProductReviewsPage = () => {
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<AdminProductReviewRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actioningReviewId, setActioningReviewId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title font-display text-[36px] italic text-[var(--color-primary)]">Product Reviews</h1>
      </div>

      {message ? <p className="mb-4 font-body text-[12px] text-[var(--color-accent)]">{message}</p> : null}

      <div className="mb-5 flex flex-wrap items-end gap-4 border-b border-[var(--color-border)] pb-5">
        <div className="admin-search-wrap w-full max-w-[300px]">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search title, body, author..."
            className="w-full border-0 border-b border-[var(--color-border)] bg-transparent px-0 pb-2 font-body text-[12px] text-[var(--color-primary)] outline-none placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)]"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              setPage(1);
            }}
            className="border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[12px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
          >
            <option value="all">All</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Hidden</option>
          </select>
        </div>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)] transition-colors hover:text-[var(--color-primary)]"
          >
            Clear Filters
          </button>
        ) : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[1100px] w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {["Product", "Customer", "Rating", "Review", "Status", "Submitted", "Actions"].map((heading) => (
                <th
                  key={heading}
                  className="px-2 py-3 text-left font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted-soft)] first:pl-0 last:pr-0"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-0 py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">
                  Loading reviews...
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={7} className="px-0 py-8 text-center font-body text-[12px] text-[var(--color-danger)]">
                  {loadError}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-0 py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">
                  No reviews found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--color-surface-strong)] hover:bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.04)]">
                  <td className="px-2 py-4 pl-0">
                    {row.productSlug ? (
                      <Link
                        to={`/shop/${row.productSlug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-body text-[12px] text-[var(--color-primary)] hover:text-[var(--color-accent)]"
                      >
                        {row.productName}
                      </Link>
                    ) : (
                      <p className="font-body text-[12px] text-[var(--color-primary)]">{row.productName}</p>
                    )}
                  </td>
                  <td className="px-2 py-4">
                    <p className="font-body text-[12px] text-[var(--color-primary)]">{row.authorDisplayName || row.customerName}</p>
                    <p className="mt-0.5 font-body text-[10px] text-[var(--color-muted-soft)]">{row.customerEmail || "-"}</p>
                  </td>
                  <td className="px-2 py-4">
                    {renderStars(row.rating)}
                    <p className="mt-1 font-body text-[10px] text-[var(--color-muted-soft)]">{row.rating}/5</p>
                  </td>
                  <td className="px-2 py-4">
                    {row.title ? <p className="font-body text-[12px] text-[var(--color-primary)]">{row.title}</p> : null}
                    <p className="mt-1 font-body text-[11px] text-[var(--color-muted)]">{snippet(row.body)}</p>
                  </td>
                  <td className="px-2 py-4">
                    <span className={`inline-block rounded-[var(--border-radius)] border px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${statusBadgeClass(row.status)}`}>
                      {row.status === "rejected" ? "Hidden" : row.status}
                    </span>
                  </td>
                  <td className="px-2 py-4 font-body text-[11px] text-[var(--color-muted-soft)]">{formatDateShort(row.createdAt)}</td>
                  <td className="px-0 py-4">
                    <div className="flex items-center gap-3 font-body text-[10px] uppercase tracking-[0.1em]">
                      {row.status !== "approved" ? (
                        <button
                          type="button"
                          onClick={() => void onUpdateStatus(row, "approved")}
                          disabled={actioningReviewId === row.id}
                          className="text-[var(--color-accent)] transition-colors hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Approve
                        </button>
                      ) : null}
                      {row.status !== "rejected" ? (
                        <button
                          type="button"
                          onClick={() => void onUpdateStatus(row, "rejected")}
                          disabled={actioningReviewId === row.id}
                          className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Hide
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[var(--color-border)] md:hidden">
        {isLoading ? (
          <p className="py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">Loading reviews...</p>
        ) : loadError ? (
          <p className="py-8 text-center font-body text-[12px] text-[var(--color-danger)]">{loadError}</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">No reviews found.</p>
        ) : (
          rows.map((row) => (
            <div key={`mobile-review-${row.id}`} className="admin-mobile-card">
              <div className="flex items-start justify-between gap-3">
                <p className="font-body text-[12px] text-[var(--color-primary)]">{row.productName}</p>
                <span className={`inline-block rounded-[var(--border-radius)] border px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${statusBadgeClass(row.status)}`}>
                  {row.status === "rejected" ? "Hidden" : row.status}
                </span>
              </div>

              <p className="mt-1 font-body text-[10px] text-[var(--color-muted-soft)]">{row.authorDisplayName || row.customerName}</p>
              <div className="mt-2">{renderStars(row.rating)}</div>
              {row.title ? <p className="mt-2 font-body text-[12px] text-[var(--color-primary)]">{row.title}</p> : null}
              <p className="mt-1 font-body text-[11px] text-[var(--color-muted)]">{snippet(row.body, 180)}</p>
              <p className="mt-2 font-body text-[10px] text-[var(--color-muted-soft)]">{formatDateShort(row.createdAt)}</p>

              <div className="mt-3 flex items-center justify-end gap-3 font-body text-[10px] uppercase tracking-[0.1em]">
                {row.status !== "approved" ? (
                  <button
                    type="button"
                    onClick={() => void onUpdateStatus(row, "approved")}
                    disabled={actioningReviewId === row.id}
                    className="text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Approve
                  </button>
                ) : null}
                {row.status !== "rejected" ? (
                  <button
                    type="button"
                    onClick={() => void onUpdateStatus(row, "rejected")}
                    disabled={actioningReviewId === row.id}
                    className="text-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Hide
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="rounded-[var(--border-radius)] border border-[var(--color-border)] px-3 py-1.5 font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-muted)] disabled:opacity-50"
          >
            Prev
          </button>
          {pageNumbers.map((pageNumber) => (
            <button
              key={`review-page-${pageNumber}`}
              type="button"
              onClick={() => setPage(pageNumber)}
              className={`rounded-[var(--border-radius)] border px-3 py-1.5 font-body text-[10px] uppercase tracking-[0.1em] ${
                pageNumber === page
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-secondary)]"
                  : "border-[var(--color-border)] text-[var(--color-muted)]"
              }`}
            >
              {pageNumber}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page === totalPages}
            className="rounded-[var(--border-radius)] border border-[var(--color-border)] px-3 py-1.5 font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-muted)] disabled:opacity-50"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default AdminProductReviewsPage;
