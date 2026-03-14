import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  deleteAdminProduct,
  fetchAdminProducts,
  fetchProductOrderCount,
  type AdminProductListItem,
} from "@/services/adminService";
import { formatCurrency } from "@/lib/adminFormatting";

const categoryTabs = [
  { label: "All", slug: "" },
  { label: "Hair Care", slug: "hair-care" },
  { label: "Men", slug: "mens-fashion" },
  { label: "Women", slug: "womens-fashion" },
  { label: "Bags", slug: "bags" },
  { label: "Shoes", slug: "shoes" },
];

const PAGE_SIZE = 20;

const AdminProductsPage = () => {
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [availability, setAvailability] = useState<"all" | "available" | "unavailable">("all");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<AdminProductListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadProducts();

    return () => {
      isMounted = false;
    };
  }, [searchTerm, categorySlug, availability, page]);

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

  const onDelete = async (product: AdminProductListItem) => {
    setDeletingId(product.id);
    try {
      const usageCount = await fetchProductOrderCount(product.id);
      if (usageCount > 0) {
        window.alert(
          `This product has ${usageCount} orders and cannot be deleted. Set it to unavailable instead.`,
        );
        return;
      }

      const shouldDelete = window.confirm(`Delete ${product.name}? This cannot be undone.`);
      if (!shouldDelete) {
        return;
      }

      await deleteAdminProduct(product.id, {
        name: product.name,
        slug: product.slug,
      });

      const refreshed = await fetchAdminProducts({
        searchTerm,
        categorySlug: categorySlug || undefined,
        availability,
        page,
        pageSize: PAGE_SIZE,
      });
      setRows(refreshed.rows);
      setTotalCount(refreshed.totalCount);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-[#F5F0E8] px-6 py-10 lg:px-[60px] lg:py-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="font-display text-[36px] italic text-[#1A1A1A]">Products</h1>
        <Link
          to="/admin/products/new"
          className="rounded-[2px] bg-[#1A1A1A] px-7 py-3 font-body text-[11px] uppercase tracking-[0.1em] text-[#F5F0E8] transition-colors hover:bg-[#C4A882] hover:text-[#1A1A1A]"
        >
          Add New Product
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-4 border-b border-[#d4ccc2] pb-5">
        <div className="w-full max-w-[280px]">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name or SKU..."
            className="w-full border-0 border-b border-[#d4ccc2] bg-transparent px-0 pb-2 font-body text-[12px] text-[#1A1A1A] outline-none placeholder:text-[#aaaaaa] focus:border-[#1A1A1A]"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {categoryTabs.map((tab) => {
            const isActive = categorySlug === tab.slug;
            return (
              <button
                key={tab.slug || "all"}
                type="button"
                onClick={() => {
                  setCategorySlug(tab.slug);
                  setPage(1);
                }}
                className={`rounded-[2px] border px-4 py-2 font-body text-[10px] uppercase tracking-[0.1em] transition-colors ${
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
          <select
            value={availability}
            onChange={(event) => {
              setAvailability(event.target.value as "all" | "available" | "unavailable");
              setPage(1);
            }}
            className="border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[12px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
          >
            <option value="all">All</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse">
          <thead>
            <tr className="border-b border-[#d4ccc2]">
              {["Image", "Name & SKU", "Category", "Price", "Stock", "Status", "Actions"].map((heading) => (
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
                <td colSpan={7} className="px-0 py-8 text-center font-body text-[12px] text-[#aaaaaa]">
                  Loading products...
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={7} className="px-0 py-8 text-center font-body text-[12px] text-[#C0392B]">
                  {loadError}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-0 py-8 text-center font-body text-[12px] text-[#aaaaaa]">
                  No products found.
                </td>
              </tr>
            ) : (
              rows.map((product) => {
                const threshold = product.low_stock_threshold ?? 5;
                const isLow = product.stock_quantity <= threshold && product.stock_quantity > 0;
                const isOut = product.stock_quantity === 0;

                return (
                  <tr key={product.id} className="border-b border-[#e4dbd1] hover:bg-[rgba(196,168,130,0.04)]">
                    <td className="px-2 py-4 pl-0">
                      <div className="h-16 w-12 overflow-hidden bg-[#ede5db]">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-[#e2d9cf]" />
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-4">
                      <p className="font-body text-[13px] text-[#1A1A1A]">{product.name}</p>
                      <p className="mt-0.5 font-body text-[10px] text-[#aaaaaa]">{product.sku || "No SKU"}</p>
                    </td>
                    <td className="px-2 py-4 font-body text-[11px] uppercase tracking-[0.08em] text-[#C4A882]">
                      {product.category_name || "Uncategorized"}
                    </td>
                    <td className="px-2 py-4">
                      <p className="font-body text-[13px] text-[#1A1A1A]">{formatCurrency(product.price)}</p>
                      {product.compare_at_price ? (
                        <p className="font-body text-[11px] text-[#aaaaaa] line-through">
                          {formatCurrency(product.compare_at_price)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-4">
                      <p
                        className={`font-body text-[13px] ${
                          isOut ? "text-[#C0392B]" : isLow ? "text-[#C4A882]" : "text-[#1A1A1A]"
                        }`}
                      >
                        {product.stock_quantity}
                      </p>
                      {isLow ? (
                        <span className="mt-1 inline-block rounded-[2px] bg-[rgba(196,168,130,0.15)] px-1.5 py-0.5 font-body text-[8px] uppercase tracking-[0.08em] text-[#C4A882]">
                          Low
                        </span>
                      ) : null}
                      {isOut ? (
                        <span className="mt-1 inline-block rounded-[2px] bg-[rgba(192,57,43,0.15)] px-1.5 py-0.5 font-body text-[8px] uppercase tracking-[0.08em] text-[#C0392B]">
                          Out
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-4">
                      <span
                        className={`inline-block rounded-[2px] px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${
                          product.is_available
                            ? "border border-[#C4A882] text-[#C4A882]"
                            : "border border-[#C0392B] text-[#C0392B]"
                        }`}
                      >
                        {product.is_available ? "Available" : "Unavailable"}
                      </span>
                    </td>
                    <td className="px-0 py-4">
                      <div className="flex items-center gap-2 font-body text-[10px] uppercase tracking-[0.1em]">
                        <Link to={`/admin/products/${product.id}/edit`} className="text-[#888888] transition-colors hover:text-[#1A1A1A]">
                          Edit
                        </Link>
                        <span className="text-[#d4ccc2]">·</span>
                        <button
                          type="button"
                          disabled={deletingId === product.id}
                          onClick={() => void onDelete(product)}
                          className="text-[#888888] transition-colors hover:text-[#C0392B] disabled:cursor-not-allowed disabled:opacity-50"
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

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 font-body text-[11px] text-[#888888]">
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
          Next &rarr;
        </button>
      </div>
    </div>
  );
};

export default AdminProductsPage;
