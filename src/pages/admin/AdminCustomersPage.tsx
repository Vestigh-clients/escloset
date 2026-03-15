import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const AdminCustomersPage = () => {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortFilter>("newest");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<AdminCustomerListItem[]>([]);
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
      link.setAttribute("download", `luxuriant-customers-${dateLabel}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-[#F5F0E8] px-6 py-10 lg:px-[60px] lg:py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-[36px] italic text-[#1A1A1A]">Customers</h1>
        <button
          type="button"
          onClick={() => void onExport()}
          disabled={isExporting}
          className="rounded-[2px] border border-[#d4ccc2] bg-transparent px-6 py-2.5 font-body text-[11px] uppercase tracking-[0.1em] text-[#1A1A1A] transition-colors hover:border-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isExporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-4 border-b border-[#d4ccc2] pb-5">
        <div className="w-full max-w-[320px]">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name, email or phone..."
            className="w-full border-0 border-b border-[#d4ccc2] bg-transparent px-0 pb-2 font-body text-[12px] text-[#1A1A1A] outline-none placeholder:text-[#aaaaaa] focus:border-[#1A1A1A]"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {statusTabs.map((tab) => {
            const isActive = tab.value === statusFilter;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.value);
                  setPage(1);
                }}
                className={`border px-7 py-[10px] font-body text-[11px] uppercase tracking-[0.1em] transition-colors duration-300 ${
                  isActive
                    ? "border-[#1A1A1A] bg-[#1A1A1A] text-[#F5F0E8]"
                    : "border-[#d4ccc2] text-[#888888] hover:border-[#1A1A1A] hover:text-[#1A1A1A]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div>
          <label className="font-body text-[11px] text-[#1A1A1A]">
            Sort by:{" "}
            <select
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value as SortFilter);
                setPage(1);
              }}
              className="border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[11px] uppercase tracking-[0.08em] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1080px] w-full border-collapse">
          <thead>
            <tr className="border-b border-[#d4ccc2]">
              {["Customer", "Email", "Phone", "Orders", "Spent", "Joined", "Status", "Actions"].map((heading) => (
                <th
                  key={heading}
                  className="px-2 py-3 text-left font-body text-[10px] uppercase tracking-[0.12em] text-[#aaaaaa] first:pl-0 last:pr-0"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-0 py-8 text-center font-body text-[12px] text-[#aaaaaa]">
                  Loading customers...
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
                <td colSpan={8} className="px-0 py-8 text-center font-body text-[12px] text-[#aaaaaa]">
                  No customers found.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const initials = (row.first_name?.slice(0, 1) || row.email.slice(0, 1) || "C").toUpperCase();
                const isActive = row.is_active ?? true;
                return (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/admin/customers/${row.id}`)}
                    className="cursor-pointer border-b border-[#e4dbd1] transition-colors hover:bg-[rgba(196,168,130,0.04)]"
                  >
                    <td className="px-2 py-4 pl-0">
                      <div className="flex items-center">
                        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#1A1A1A] font-body text-[12px] text-[#F5F0E8]">
                          {row.avatar_url ? <img src={row.avatar_url} alt={row.first_name} className="h-full w-full object-cover" /> : initials}
                        </div>
                        <p className="ml-[10px] font-body text-[12px] text-[#1A1A1A]">{`${row.first_name} ${row.last_name}`.trim()}</p>
                      </div>
                    </td>
                    <td className="px-2 py-4 font-body text-[11px] text-[#aaaaaa]">{row.email}</td>
                    <td className="px-2 py-4 font-body text-[11px] text-[#aaaaaa]">{row.phone || "—"}</td>
                    <td className="px-2 py-4 font-body text-[12px] text-[#1A1A1A]">{(row.total_orders ?? 0).toLocaleString("en-GH")}</td>
                    <td className="px-2 py-4 font-body text-[12px] text-[#1A1A1A]">{formatCurrency(row.total_spent ?? 0)}</td>
                    <td className="px-2 py-4 font-body text-[11px] text-[#aaaaaa]">{formatDateShort(row.created_at)}</td>
                    <td className="px-2 py-4">
                      <span
                        className={`inline-block rounded-[2px] border px-[10px] py-[4px] font-body text-[9px] uppercase tracking-[0.12em] ${
                          isActive ? "border-[#C4A882] text-[#C4A882]" : "border-[#C0392B] text-[#C0392B]"
                        }`}
                      >
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-0 py-4 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/admin/customers/${row.id}`);
                        }}
                        className="font-body text-[10px] uppercase tracking-[0.1em] text-[#C4A882] transition-colors hover:text-[#1A1A1A]"
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 font-body text-[11px] text-[#888888]">
        <button
          type="button"
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          disabled={page <= 1}
          className="transition-colors hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Previous
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
                  : "border-transparent text-[#888888] hover:text-[#1A1A1A]"
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
          Next →
        </button>
      </div>
    </div>
  );
};

export default AdminCustomersPage;

