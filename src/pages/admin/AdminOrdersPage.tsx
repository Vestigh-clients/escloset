import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildOrdersCsv, fetchAdminOrders, fetchAdminOrdersForExport, type AdminOrderListItem } from "@/services/adminService";
import { formatAdminDate, formatCurrency } from "@/lib/adminFormatting";

type StatusFilter = "" | "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
type PaymentFilter = "" | "unpaid" | "paid" | "refunded" | "partially_refunded";

const statusTabs: Array<{ label: string; value: StatusFilter }> = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Processing", value: "processing" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

const paymentOptions: Array<{ label: string; value: PaymentFilter }> = [
  { label: "All Payments", value: "" },
  { label: "Unpaid", value: "unpaid" },
  { label: "Paid", value: "paid" },
  { label: "Refunded", value: "refunded" },
  { label: "Partially Refunded", value: "partially_refunded" },
];

const statusBadgeClass: Record<string, string> = {
  pending: "border border-[#d4ccc2] text-[#555555]",
  confirmed: "border border-[#1A1A1A] text-[#1A1A1A]",
  processing: "border border-[#C4A882] text-[#C4A882]",
  shipped: "bg-[#C4A882] text-[#1A1A1A]",
  delivered: "bg-[#1A1A1A] text-[#F5F0E8]",
  cancelled: "border border-[#C0392B] text-[#C0392B]",
};

const paymentBadgeClass: Record<string, string> = {
  unpaid: "border border-[#d4ccc2] text-[#777777]",
  paid: "border border-[#27AE60] text-[#27AE60]",
  refunded: "border border-[#C0392B] text-[#C0392B]",
  partially_refunded: "border border-[#C4A882] text-[#C4A882]",
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

const AdminOrdersPage = () => {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<AdminOrderListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      link.setAttribute("download", `luxuriant-orders-${dateLabel}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title font-display text-[36px] italic text-[#1A1A1A]">Orders</h1>
        <div className="admin-page-actions">
          <button
            type="button"
            onClick={() => void onExport()}
            disabled={isExporting}
            className="rounded-[2px] border border-[#d4ccc2] bg-transparent px-6 py-2.5 font-body text-[11px] uppercase tracking-[0.1em] text-[#1A1A1A] transition-colors hover:border-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-4 border-b border-[#d4ccc2] pb-5">
        <div className="admin-search-wrap w-full max-w-[320px]">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by order #, customer name or email..."
            className="w-full border-0 border-b border-[#d4ccc2] bg-transparent px-0 pb-2 font-body text-[12px] text-[#1A1A1A] outline-none placeholder:text-[#999999] focus:border-[#1A1A1A]"
          />
        </div>

        <div className="admin-filter-pills flex flex-wrap gap-2">
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
                className={`rounded-[2px] border px-4 py-2 font-body text-[10px] uppercase tracking-[0.1em] transition-colors ${
                  isActive
                    ? "border-[#1A1A1A] bg-[#1A1A1A] text-[#F5F0E8]"
                    : "border-[#d4ccc2] text-[#555555] hover:border-[#1A1A1A] hover:text-[#1A1A1A]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div>
          <select
            value={paymentFilter}
            onChange={(event) => {
              setPaymentFilter(event.target.value as PaymentFilter);
              setPage(1);
            }}
            className="border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[12px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
          >
            {paymentOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            className="border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[12px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
          />
          <span className="font-body text-[12px] text-[#777777]">-</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            className="border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[12px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
          />
        </div>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="font-body text-[10px] uppercase tracking-[0.1em] text-[#777777] transition-colors hover:text-[#1A1A1A]"
          >
            Clear Filters
          </button>
        ) : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[1040px] w-full border-collapse">
          <thead>
            <tr className="border-b border-[#d4ccc2]">
              {["Order #", "Customer", "Items", "Payment", "Total", "Status", "Date", "Action"].map((heading) => (
                <th
                  key={heading}
                  className="px-2 py-3 text-left font-body text-[10px] uppercase tracking-[0.12em] text-[#777777] first:pl-0 last:pr-0"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-0 py-8 text-center font-body text-[12px] text-[#777777]">
                  Loading orders...
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={8} className="px-0 py-8 text-center font-body text-[12px] text-[#C0392B]">
                  {loadError}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-0 py-8 text-center font-body text-[12px] text-[#777777]">
                  No orders found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => navigate(`/admin/orders/${row.order_number}`)}
                  className="cursor-pointer border-b border-[#e4dbd1] transition-colors hover:bg-[rgba(196,168,130,0.04)]"
                >
                  <td className="px-2 py-4 pl-0 font-body text-[11px] uppercase tracking-[0.08em] text-[#C4A882]">
                    {row.order_number}
                  </td>
                  <td className="px-2 py-4">
                    <p className="font-body text-[12px] text-[#1A1A1A]">{`${row.customer.first_name} ${row.customer.last_name}`.trim()}</p>
                    <p className="mt-0.5 font-body text-[10px] text-[#777777]">{row.customer.email}</p>
                  </td>
                  <td className="group relative px-2 py-4">
                    <p className="font-body text-[11px] text-[#555555]">
                      {row.items} item{row.items === 1 ? "" : "s"}
                    </p>
                    {row.item_names.length > 0 ? (
                      <div className="pointer-events-none absolute top-1/2 left-0 z-10 hidden -translate-y-1/2 rounded-[2px] bg-[#1A1A1A] px-3 py-2 font-body text-[11px] text-[#F5F0E8] group-hover:block">
                        {row.item_names.join(", ")}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-2 py-4">
                    <p className="font-body text-[11px] text-[#555555]">{paymentMethodLabel(row.payment_method)}</p>
                    <span
                      className={`mt-1 inline-block rounded-[2px] px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${
                        paymentBadgeClass[row.payment_status] ?? "border border-[#d4ccc2] text-[#777777]"
                      }`}
                    >
                      {toTitleCase(row.payment_status)}
                    </span>
                  </td>
                  <td className="px-2 py-4 font-body text-[13px] text-[#1A1A1A]">{formatCurrency(row.total)}</td>
                  <td className="px-2 py-4">
                    <span
                      className={`inline-block rounded-[2px] px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${
                        statusBadgeClass[row.status] ?? "border border-[#d4ccc2] text-[#555555]"
                      }`}
                    >
                      {toTitleCase(row.status)}
                    </span>
                  </td>
                  <td className="px-2 py-4 font-body text-[11px] text-[#777777]">{formatAdminDate(row.created_at)}</td>
                  <td className="px-0 py-4 text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/admin/orders/${row.order_number}`);
                      }}
                      className="font-body text-[10px] uppercase tracking-[0.1em] text-[#C4A882] transition-colors hover:text-[#1A1A1A]"
                    >
                      View &rarr;
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[#d4ccc2] md:hidden">
        {isLoading ? (
          <p className="py-8 text-center font-body text-[12px] text-[#777777]">Loading orders...</p>
        ) : loadError ? (
          <p className="py-8 text-center font-body text-[12px] text-[#C0392B]">{loadError}</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center font-body text-[12px] text-[#777777]">No orders found.</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="admin-mobile-card" onClick={() => navigate(`/admin/orders/${row.order_number}`)}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-body text-[11px] uppercase tracking-[0.08em] text-[#C4A882]">{row.order_number}</p>
                <span
                  className={`rounded-[2px] px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${
                    statusBadgeClass[row.status] ?? "border border-[#d4ccc2] text-[#555555]"
                  }`}
                >
                  {toTitleCase(row.status)}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="font-body text-[12px] text-[#1A1A1A]">{`${row.customer.first_name} ${row.customer.last_name}`.trim()}</p>
                <p className="font-body text-[13px] text-[#1A1A1A]">{formatCurrency(row.total)}</p>
              </div>

              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="font-body text-[10px] text-[#777777]">{formatAdminDate(row.created_at)}</p>
                <span
                  className={`rounded-[2px] px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${
                    paymentBadgeClass[row.payment_status] ?? "border border-[#d4ccc2] text-[#777777]"
                  }`}
                >
                  {toTitleCase(row.payment_status)}
                </span>
              </div>

              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/admin/orders/${row.order_number}`);
                  }}
                  className="font-body text-[10px] uppercase tracking-[0.1em] text-[#C4A882]"
                >
                  View &rarr;
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 font-body text-[11px] text-[#555555]">
        <button
          type="button"
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          disabled={page <= 1}
          className="transition-colors hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-40"
        >
          &larr; Previous
        </button>

        <div className="flex items-center gap-3">
          {pageNumbers.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setPage(pageNumber)}
              className={`border-b pb-1 ${
                pageNumber === page
                  ? "border-[#1A1A1A] font-medium text-[#1A1A1A]"
                  : "border-transparent text-[#555555] hover:text-[#1A1A1A]"
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
          className="transition-colors hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
};

export default AdminOrdersPage;

