import { ChevronDown, ChevronUp, Download, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { storeKeyPrefix } from "@/config/store.config";
import { buildOrdersCsv, fetchAdminOrders, fetchAdminOrdersForExport, type AdminOrderListItem } from "@/services/adminService";
import { formatAdminDate, formatCurrency } from "@/lib/adminFormatting";

type StatusFilter = "" | "pending_payment" | "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
type PaymentFilter = "" | "pending" | "paid" | "failed" | "review";

const statusTabs: Array<{ label: string; value: StatusFilter }> = [
  { label: "All", value: "" },
  { label: "Pending Payment", value: "pending_payment" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Processing", value: "processing" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

const paymentOptions: Array<{ label: string; value: PaymentFilter }> = [
  { label: "All Payments", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Paid", value: "paid" },
  { label: "Failed", value: "failed" },
  { label: "Review", value: "review" },
];

const statusBadgeClass: Record<string, string> = {
  pending_payment: "border border-[var(--color-accent)] text-[var(--color-accent)]",
  pending: "border border-[var(--color-border)] text-[var(--color-muted)]",
  confirmed: "border border-[var(--color-primary)] text-[var(--color-primary)]",
  processing: "border border-[var(--color-accent)] text-[var(--color-accent)]",
  shipped: "bg-[var(--color-accent)] text-[var(--color-secondary)]",
  delivered: "bg-[var(--color-primary)] text-[var(--color-secondary)]",
  cancelled: "border border-[var(--color-danger)] text-[var(--color-danger)]",
};

const paymentBadgeClass: Record<string, string> = {
  pending: "border border-[var(--color-border)] text-[var(--color-muted-soft)]",
  paid: "border border-[var(--color-success)] text-[var(--color-success)]",
  failed: "border border-[var(--color-danger)] text-[var(--color-danger)]",
  review: "border border-[var(--color-accent)] text-[var(--color-accent)]",
};

const toTitleCase = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const paymentMethodLabel = (value: string | null) => {
  if (!value) return "Not specified";
  return toTitleCase(value);
};

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
  paymentFilter,
  setPaymentFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  setPage,
  onClearFilters,
}: {
  open: boolean;
  onClose: () => void;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  paymentFilter: PaymentFilter;
  setPaymentFilter: (value: PaymentFilter) => void;
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
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

  const activeFilterCount =
    (statusFilter ? 1 : 0) + (paymentFilter ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

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
                    key={tab.value || "all"}
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
            <p className="mb-2.5 font-body text-[10px] uppercase tracking-[0.18em] text-[var(--color-primary)]">Payment</p>
            <div className="flex flex-wrap gap-2">
              {paymentOptions.map((option) => {
                const active = option.value === paymentFilter;
                return (
                  <button
                    key={option.value || "all"}
                    type="button"
                    onClick={() => {
                      setPaymentFilter(option.value);
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
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2.5 font-body text-[10px] uppercase tracking-[0.18em] text-[var(--color-primary)]">Date Range</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setPage(1);
                }}
                className="h-11 rounded-full border px-3 font-body text-[11px] text-[var(--color-navbar-solid-foreground)] outline-none focus:border-[var(--color-primary)]"
                style={{ borderColor: "rgba(var(--color-primary-rgb),0.16)" }}
              />
              <input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setPage(1);
                }}
                className="h-11 rounded-full border px-3 font-body text-[11px] text-[var(--color-navbar-solid-foreground)] outline-none focus:border-[var(--color-primary)]"
                style={{ borderColor: "rgba(var(--color-primary-rgb),0.16)" }}
              />
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

const AdminOrdersPage = () => {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const [rows, setRows] = useState<AdminOrderListItem[]>([]);
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
        const result = await fetchAdminOrders({
          searchTerm,
          statusFilter,
          paymentFilter,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
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
        setLoadError("Unable to load orders.");
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
  }, [searchTerm, statusFilter, paymentFilter, dateFrom, dateTo, page]);

  const hasActiveFilters = Boolean(searchTerm || statusFilter || paymentFilter || dateFrom || dateTo);
  const activeFilterCount =
    (statusFilter ? 1 : 0) + (paymentFilter ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);
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

  const onClearFilters = () => {
    setSearchInput("");
    setSearchTerm("");
    setStatusFilter("");
    setPaymentFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const onExport = async () => {
    setIsExporting(true);
    try {
      const exportRows = await fetchAdminOrdersForExport({
        searchTerm,
        statusFilter,
        paymentFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });

      const csv = buildOrdersCsv(exportRows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateLabel = new Date().toISOString().split("T")[0];
      link.href = url;
      link.setAttribute("download", `${storeKeyPrefix}-orders-${dateLabel}.csv`);
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
            <p className="font-body text-[11px] uppercase tracking-[0.22em] text-[var(--color-primary)]">Sales</p>
            <h1 className="mt-3 font-display text-[38px] italic leading-[1.04] text-[var(--color-navbar-solid-foreground)] sm:text-[50px]">
              Orders
            </h1>
            <p className="mt-2 max-w-[680px] font-body text-[13px] leading-[1.8] text-[var(--color-muted)] sm:text-[14px]">
              Track order activity, payment progress, and fulfillment status with the same focused flow as Products.
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
                  placeholder="Search by order #, customer name or email..."
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
                  const isActive = tab.value === statusFilter;
                  return (
                    <button
                      key={tab.value || "all"}
                      type="button"
                      onClick={() => {
                        setStatusFilter(tab.value);
                        setPage(1);
                      }}
                      className={`rounded-full border px-4 py-2 font-body text-[10px] uppercase tracking-[0.12em] transition-colors ${
                        isActive
                          ? "text-white"
                          : "text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                      }`}
                      style={{
                        borderColor: isActive ? "var(--color-primary)" : "rgba(var(--color-primary-rgb),0.16)",
                        background: isActive ? "var(--color-primary)" : "transparent",
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <p className="font-body text-[10px] uppercase tracking-[0.16em] text-[var(--color-primary)]">Payment</p>
                <select
                  value={paymentFilter}
                  onChange={(event) => {
                    setPaymentFilter(event.target.value as PaymentFilter);
                    setPage(1);
                  }}
                  className="h-10 rounded-full border bg-white px-4 font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
                  style={{ borderColor: "rgba(var(--color-primary-rgb),0.16)" }}
                >
                  {paymentOptions.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value);
                    setPage(1);
                  }}
                  className="h-10 rounded-full border bg-white px-4 font-body text-[11px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
                  style={{ borderColor: "rgba(var(--color-primary-rgb),0.16)" }}
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value);
                    setPage(1);
                  }}
                  className="h-10 rounded-full border bg-white px-4 font-body text-[11px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
                  style={{ borderColor: "rgba(var(--color-primary-rgb),0.16)" }}
                />
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={onClearFilters}
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
                {totalCount === 0 ? "No orders found" : `${totalCount} order${totalCount === 1 ? "" : "s"} found`}
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
              <col style={{ width: "13%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead className="bg-[rgba(var(--color-primary-rgb),0.03)]">
              <tr>
                {["Order #", "Customer", "Items", "Payment", "Total", "Status", "Date", "Action"].map((heading) => (
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
                    Loading orders...
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
                    No orders found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/admin/orders/${row.order_number}`)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(`/admin/orders/${row.order_number}`);
                      }
                    }}
                    className="cursor-pointer border-t border-[rgba(var(--color-primary-rgb),0.1)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                  >
                    <td className="px-2 py-3 pl-3 font-body text-[10px] uppercase tracking-[0.06em] text-[var(--color-accent)]">
                      <span className="block truncate" title={row.order_number}>{truncateHalf(row.order_number, "-")}</span>
                    </td>
                    <td className="px-2 py-3">
                      <p className="truncate font-body text-[12px] text-[var(--color-navbar-solid-foreground)]" title={`${row.customer.first_name} ${row.customer.last_name}`.trim()}>
                        {truncateHalf(`${row.customer.first_name} ${row.customer.last_name}`.trim(), "Customer")}
                      </p>
                      <p className="mt-0.5 truncate font-body text-[9px] text-[var(--color-muted-soft)]" title={row.customer.email}>
                        {truncateHalf(row.customer.email, "-")}
                      </p>
                    </td>
                    <td className="px-2 py-3 font-body text-[10px] text-[var(--color-muted)]">
                      {row.items} item{row.items === 1 ? "" : "s"}
                    </td>
                    <td className="px-2 py-3">
                      <p className="truncate font-body text-[10px] text-[var(--color-muted)]" title={paymentMethodLabel(row.payment_method)}>
                        {truncateHalf(paymentMethodLabel(row.payment_method), "-")}
                      </p>
                      <span
                        className={`mt-1 inline-block whitespace-nowrap rounded-full px-2 py-1 font-body text-[8px] uppercase tracking-[0.08em] ${
                          paymentBadgeClass[row.payment_status] ?? "border border-[var(--color-border)] text-[var(--color-muted-soft)]"
                        }`}
                      >
                        {toTitleCase(row.payment_status)}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <p className="whitespace-nowrap font-body text-[12px] text-[var(--color-navbar-solid-foreground)]">{formatCurrency(row.total)}</p>
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2 py-1 font-body text-[8px] uppercase tracking-[0.08em] ${
                          statusBadgeClass[row.status] ?? "border border-[var(--color-border)] text-[var(--color-muted)]"
                        }`}
                      >
                        {toTitleCase(row.status)}
                      </span>
                    </td>
                    <td className="px-2 py-3 font-body text-[10px] text-[var(--color-muted-soft)]">
                      {formatAdminDate(row.created_at)}
                    </td>
                    <td className="px-2 py-3 pr-3 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/admin/orders/${row.order_number}`);
                        }}
                        className="rounded-full border border-transparent px-2.5 py-1 font-body text-[8px] uppercase tracking-[0.08em] text-[var(--color-accent)] transition-colors hover:border-[rgba(var(--color-primary-rgb),0.25)] hover:text-[var(--color-primary)]"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
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
              <col style={{ width: "22%" }} />
              <col style={{ width: "34%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "24%" }} />
            </colgroup>
            <thead className="bg-[rgba(var(--color-primary-rgb),0.03)]">
              <tr>
                {["Order #", "Customer", "Total", "Action"].map((heading) => (
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
                    Loading orders...
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
                    No orders found.
                  </td>
                </tr>
              ) : (
                rows.flatMap((row) => {
                  const isExpanded = expandedCompactRowId === row.id;
                  const customerName = `${row.customer.first_name} ${row.customer.last_name}`.trim();
                  return [
                    <tr
                      key={`${row.id}-main`}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/admin/orders/${row.order_number}`)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate(`/admin/orders/${row.order_number}`);
                        }
                      }}
                      className="cursor-pointer border-t border-[rgba(var(--color-primary-rgb),0.1)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                    >
                      <td className="px-2 py-2.5 pl-3 font-body text-[10px] uppercase tracking-[0.06em] text-[var(--color-accent)]">
                        <span className="block truncate" title={row.order_number}>{truncateHalf(row.order_number, "-")}</span>
                      </td>
                      <td className="px-2 py-2.5">
                        <p className="truncate font-body text-[12px] text-[var(--color-navbar-solid-foreground)]" title={customerName}>
                          {truncateHalf(customerName, "Customer")}
                        </p>
                      </td>
                      <td className="px-2 py-2.5 align-top">
                        <p className="whitespace-nowrap font-body text-[11px] text-[var(--color-navbar-solid-foreground)]">
                          {formatCurrency(row.total)}
                        </p>
                      </td>
                      <td className="px-2 py-2.5 pr-3">
                        <div className="flex flex-col items-end gap-1.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpandedCompactRowId((current) => (current === row.id ? null : row.id));
                            }}
                            className="inline-flex items-center gap-1 rounded-full border px-1.5 py-1 font-body text-[8px] uppercase tracking-[0.08em] text-[var(--color-primary)] transition-colors hover:bg-[rgba(var(--color-primary-rgb),0.06)]"
                            style={{ borderColor: "rgba(var(--color-primary-rgb),0.2)" }}
                          >
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            More
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/admin/orders/${row.order_number}`);
                            }}
                            className="rounded-full border border-transparent px-1.5 py-1 font-body text-[8px] uppercase tracking-[0.08em] text-[var(--color-accent)] transition-colors hover:border-[rgba(var(--color-primary-rgb),0.25)] hover:text-[var(--color-primary)]"
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
                            <p>
                              <span className="mr-1 text-[var(--color-muted)]">Status:</span>
                              {toTitleCase(row.status)}
                            </p>
                            <p>
                              <span className="mr-1 text-[var(--color-muted)]">Payment:</span>
                              {paymentMethodLabel(row.payment_method)}
                            </p>
                            <p>
                              <span className="mr-1 text-[var(--color-muted)]">Payment status:</span>
                              {toTitleCase(row.payment_status)}
                            </p>
                            <p>
                              <span className="mr-1 text-[var(--color-muted)]">Date:</span>
                              {formatAdminDate(row.created_at)}
                            </p>
                            <p className="truncate" title={row.customer.email || "-"}>
                              <span className="mr-1 text-[var(--color-muted)]">Customer:</span>
                              {truncateHalf(row.customer.email || "-", "-")}
                            </p>
                            <p>
                              <span className="mr-1 text-[var(--color-muted)]">Items:</span>
                              {row.items}
                            </p>
                            <p className="truncate" title={row.item_names.join(", ") || "-"}>
                              <span className="mr-1 text-[var(--color-muted)]">Names:</span>
                              {row.item_names.join(", ") || "-"}
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
        paymentFilter={paymentFilter}
        setPaymentFilter={setPaymentFilter}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        setPage={setPage}
        onClearFilters={onClearFilters}
      />
    </div>
  );
};

export default AdminOrdersPage;



