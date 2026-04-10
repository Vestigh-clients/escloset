import { ChevronDown, ChevronUp, Download, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { storeKeyPrefix } from "@/config/store.config";
import { buildCustomersCsv, fetchAdminCustomers, fetchAdminCustomersForExport, type AdminCustomerListItem } from "@/services/adminManagementService";
import { formatCurrency, formatDateShort } from "@/lib/adminFormatting";

type StatusFilter = "all" | "active" | "inactive";
type SortFilter = "newest" | "oldest" | "most_orders" | "most_spent";

const statusTabs: Array<{ label: string; value: StatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

const sortOptions: Array<{ label: string; value: SortFilter }> = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
  { label: "Most Orders", value: "most_orders" },
  { label: "Most Spent", value: "most_spent" },
];

const PAGE_SIZE = 25;

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
  sortBy,
  setSortBy,
  setPage,
  onClearFilters,
}: {
  open: boolean;
  onClose: () => void;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  sortBy: SortFilter;
  setSortBy: (value: SortFilter) => void;
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

  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (sortBy !== "newest" ? 1 : 0);

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

          <div>
            <p className="mb-2.5 font-body text-[10px] uppercase tracking-[0.18em] text-[var(--color-primary)]">Sort</p>
            <select
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value as SortFilter);
                setPage(1);
              }}
              className="h-11 w-full rounded-full border bg-white px-4 font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
              style={{ borderColor: "rgba(var(--color-primary-rgb),0.16)" }}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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

const AdminCustomersPage = () => {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortFilter>("newest");
  const [page, setPage] = useState(1);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const [rows, setRows] = useState<AdminCustomerListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedCompactRowId, setExpandedCompactRowId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchInput]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const result = await fetchAdminCustomers({
          searchTerm,
          status: statusFilter,
          sortBy,
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
        setLoadError("Unable to load customers.");
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
  }, [searchTerm, statusFilter, sortBy, page]);

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

  const hasActiveFilters = Boolean(searchTerm || statusFilter !== "all" || sortBy !== "newest");
  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (sortBy !== "newest" ? 1 : 0);

  const clearFilters = () => {
    setSearchInput("");
    setSearchTerm("");
    setStatusFilter("all");
    setSortBy("newest");
    setPage(1);
  };

  const onExport = async () => {
    setIsExporting(true);
    try {
      const exportRows = await fetchAdminCustomersForExport({
        searchTerm,
        status: statusFilter,
        sortBy,
      });
      const csv = buildCustomersCsv(exportRows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateLabel = new Date().toISOString().split("T")[0];
      link.href = url;
      link.setAttribute("download", `${storeKeyPrefix}-customers-${dateLabel}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="admin-page lux-page-enter overflow-visible min-h-[calc(100dvh-3.5rem)] md:min-h-[calc(100dvh-4rem)] flex flex-col">
      <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col text-left">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-body text-[11px] uppercase tracking-[0.22em] text-[var(--color-primary)]">People</p>
            <h1 className="mt-3 font-display text-[38px] italic leading-[1.04] text-[var(--color-navbar-solid-foreground)] sm:text-[50px]">
              Customers
            </h1>
            <p className="mt-2 max-w-[680px] font-body text-[13px] leading-[1.8] text-[var(--color-muted)] sm:text-[14px]">
              View customer activity, status, and spend with the same smooth table flow used on Products.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void onExport()}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 font-body text-[11px] uppercase tracking-[0.12em] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.08)] disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                borderColor: "rgba(var(--color-primary-rgb),0.2)",
                color: "var(--color-primary)",
                background: "rgba(var(--color-primary-rgb),0.04)",
              }}
            >
              <Download className="h-3.5 w-3.5" />
              {isExporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        </div>

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
                  placeholder="Search by name, email or phone..."
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

            <div className="hidden border-t border-[rgba(var(--color-primary-rgb),0.1)] pt-4 lg:flex lg:items-start lg:justify-between lg:gap-4">
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

              <div className="flex flex-wrap items-center justify-end gap-2">
                <p className="font-body text-[10px] uppercase tracking-[0.16em] text-[var(--color-primary)]">Sort</p>
                <select
                  value={sortBy}
                  onChange={(event) => {
                    setSortBy(event.target.value as SortFilter);
                    setPage(1);
                  }}
                  className="h-10 rounded-full border bg-white px-4 font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
                  style={{ borderColor: "rgba(var(--color-primary-rgb),0.16)" }}
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-full border px-4 py-2 font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-primary)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.06)]"
                    style={{ borderColor: "rgba(var(--color-primary-rgb),0.2)" }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[rgba(var(--color-primary-rgb),0.1)] pt-3">
              <p className="font-body text-[11px] uppercase tracking-[0.12em] text-[var(--color-primary)]">
                {totalCount === 0 ? "No customers found" : `${totalCount} customer${totalCount === 1 ? "" : "s"} found`}
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
              <col style={{ width: "20%" }} />
              <col style={{ width: "19%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
          <thead>
            <tr className="bg-[rgba(var(--color-primary-rgb),0.03)]">
              {["Customer", "Email", "Phone", "Orders", "Spent", "Joined", "Status", "Actions"].map((heading) => (
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
                <td colSpan={8} className="px-3 py-9 text-center font-body text-[12px] text-[var(--color-muted-soft)]">
                  Loading customers...
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={8} className="px-3 py-9 text-center font-body text-[12px] text-[var(--color-danger)]">
                  {loadError}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-9 text-center font-body text-[12px] text-[var(--color-muted-soft)]">
                  No customers found.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const initials = (row.first_name?.slice(0, 1) || row.email.slice(0, 1) || "C").toUpperCase();
                const isActive = row.is_active ?? true;
                const fullName = `${row.first_name} ${row.last_name}`.trim() || "Customer";
                return (
                  <tr
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/admin/customers/${row.id}`)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(`/admin/customers/${row.id}`);
                      }
                    }}
                    className="cursor-pointer border-t border-[rgba(var(--color-primary-rgb),0.1)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                  >
                    <td className="px-2 py-3 pl-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-primary)] font-body text-[10px] text-[var(--color-secondary)]">
                          {row.avatar_url ? <img src={row.avatar_url} alt={row.first_name || "Customer"} className="h-full w-full object-cover" /> : initials}
                        </div>
                        <p className="truncate font-body text-[12px] text-[var(--color-navbar-solid-foreground)]" title={fullName}>
                          {truncateHalf(fullName, "Customer")}
                        </p>
                      </div>
                    </td>
                    <td className="px-2 py-3 font-body text-[10px] text-[var(--color-muted-soft)]">
                      <span className="block truncate" title={row.email}>{truncateHalf(row.email, "-")}</span>
                    </td>
                    <td className="px-2 py-3 font-body text-[10px] text-[var(--color-muted-soft)]">
                      <span className="block truncate" title={row.phone || "-"}>{truncateHalf(row.phone || "-", "-")}</span>
                    </td>
                    <td className="px-2 py-3 font-body text-[11px] text-[var(--color-navbar-solid-foreground)]">{(row.total_orders ?? 0).toLocaleString("en-GH")}</td>
                    <td className="px-2 py-3 font-body text-[11px] text-[var(--color-navbar-solid-foreground)]">{formatCurrency(row.total_spent ?? 0)}</td>
                    <td className="px-2 py-3 font-body text-[10px] text-[var(--color-muted-soft)]">{formatDateShort(row.created_at)}</td>
                    <td className="px-2 py-3">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full border px-2 py-1 font-body text-[8px] uppercase tracking-[0.08em] ${
                          isActive ? "border-[var(--color-accent)] text-[var(--color-accent)]" : "border-[var(--color-danger)] text-[var(--color-danger)]"
                        }`}
                      >
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-2 py-3 pr-3 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/admin/customers/${row.id}`);
                        }}
                        className="rounded-full border border-transparent px-2.5 py-1 font-body text-[8px] uppercase tracking-[0.08em] text-[var(--color-accent)] transition-colors hover:border-[rgba(var(--color-primary-rgb),0.25)] hover:text-[var(--color-primary)]"
                      >
                        View
                      </button>
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
              <col style={{ width: "40%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead className="bg-[rgba(var(--color-primary-rgb),0.03)]">
              <tr>
                {["Customer", "Orders", "Spent", "Action"].map((heading) => (
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
                    Loading customers...
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
                    No customers found.
                  </td>
                </tr>
              ) : (
                rows.flatMap((row) => {
                  const initials = (row.first_name?.slice(0, 1) || row.email.slice(0, 1) || "C").toUpperCase();
                  const isActive = row.is_active ?? true;
                  const fullName = `${row.first_name} ${row.last_name}`.trim() || "Customer";
                  const isExpanded = expandedCompactRowId === row.id;
                  return [
                    <tr
                      key={`${row.id}-main`}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/admin/customers/${row.id}`)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate(`/admin/customers/${row.id}`);
                        }
                      }}
                      className="cursor-pointer border-t border-[rgba(var(--color-primary-rgb),0.1)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                    >
                      <td className="px-2 py-2.5 pl-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-primary)] font-body text-[10px] text-[var(--color-secondary)]">
                            {row.avatar_url ? <img src={row.avatar_url} alt={row.first_name || "Customer"} className="h-full w-full object-cover" /> : initials}
                          </div>
                          <p className="truncate font-body text-[12px] text-[var(--color-navbar-solid-foreground)]" title={fullName}>
                            {truncateHalf(fullName, "Customer")}
                          </p>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 font-body text-[11px] text-[var(--color-navbar-solid-foreground)]">{(row.total_orders ?? 0).toLocaleString("en-GH")}</td>
                      <td className="px-2 py-2.5 font-body text-[11px] text-[var(--color-navbar-solid-foreground)]">{formatCurrency(row.total_spent ?? 0)}</td>
                      <td className="px-2 py-2.5 pr-3">
                        <div className="flex flex-col items-end gap-1.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpandedCompactRowId((current) => (current === row.id ? null : row.id));
                            }}
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-1 font-body text-[8px] uppercase tracking-[0.08em] text-[var(--color-primary)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.06)]"
                            style={{ borderColor: "rgba(var(--color-primary-rgb),0.2)" }}
                          >
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/admin/customers/${row.id}`);
                            }}
                            className="rounded-full border border-transparent px-2.5 py-1 font-body text-[8px] uppercase tracking-[0.08em] text-[var(--color-accent)] transition-colors hover:border-[rgba(var(--color-primary-rgb),0.25)] hover:text-[var(--color-primary)]"
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>,
                    isExpanded ? (
                      <tr key={`${row.id}-details`} className="border-t border-[rgba(var(--color-primary-rgb),0.08)] bg-[rgba(var(--color-primary-rgb),0.03)]">
                        <td colSpan={4} className="px-3 py-2.5">
                          <div className="grid grid-cols-2 gap-x-3 gap-y-2 font-body text-[10px] text-[var(--color-navbar-solid-foreground)]">
                            <p className="truncate" title={row.email}>
                              <span className="mr-1 text-[var(--color-muted)]">Email:</span>
                              {truncateHalf(row.email, "-")}
                            </p>
                            <p className="truncate" title={row.phone || "-"}>
                              <span className="mr-1 text-[var(--color-muted)]">Phone:</span>
                              {truncateHalf(row.phone || "-", "-")}
                            </p>
                            <p>
                              <span className="mr-1 text-[var(--color-muted)]">Joined:</span>
                              {formatDateShort(row.created_at)}
                            </p>
                            <p>
                              <span className="mr-1 text-[var(--color-muted)]">Status:</span>
                              {isActive ? "Active" : "Inactive"}
                            </p>
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
        sortBy={sortBy}
        setSortBy={setSortBy}
        setPage={setPage}
        onClearFilters={clearFilters}
      />
    </div>
  );
};

export default AdminCustomersPage;




