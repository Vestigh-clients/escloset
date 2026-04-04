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

const AdminProductsPage = () => {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [availability, setAvailability] = useState<"all" | "available" | "unavailable">("all");
  const [page, setPage] = useState(1);
  const [categoryTabs, setCategoryTabs] = useState<Array<{ label: string; slug: string }>>(defaultCategoryTabs);

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

  useEffect(() => {
    let isMounted = true;

    const loadCategoryTabs = async () => {
      try {
        const categories = await fetchAdminCategories();
        if (!isMounted) return;

        const tabs = [
          ...defaultCategoryTabs,
          ...categories.map((category) => ({
            label: category.name,
            slug: category.slug,
          })),
        ];

        setCategoryTabs(tabs);
        setCategorySlug((currentSlug) => {
          if (!currentSlug) return currentSlug;
          return tabs.some((tab) => tab.slug === currentSlug) ? currentSlug : "";
        });
      } catch {
        if (!isMounted) return;
        setCategoryTabs(defaultCategoryTabs);
      }
    };

    void loadCategoryTabs();

    return () => {
      isMounted = false;
    };
  }, []);

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

  const openEditor = (productId: string) => {
    navigate(`/admin/products/${productId}/edit`);
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title font-display text-[36px] italic text-[var(--color-primary)]">Products</h1>
        <div className="admin-page-actions">
          <Link
            to="/admin/products/new"
            className="rounded-[var(--border-radius)] bg-[var(--color-primary)] px-7 py-3 text-center font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)]"
          >
            Add New Product
          </Link>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-4 border-b border-[var(--color-border)] pb-5">
        <div className="admin-search-wrap w-full max-w-[280px]">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name or SKU..."
            className="w-full border-0 border-b border-[var(--color-border)] bg-transparent px-0 pb-2 font-body text-[12px] text-[var(--color-primary)] outline-none placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)]"
          />
        </div>

        <div className="admin-filter-pills flex flex-wrap gap-2">
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
                className={`rounded-[var(--border-radius)] border px-4 py-2 font-body text-[10px] uppercase tracking-[0.1em] transition-colors ${
                  isActive
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-secondary)]"
                    : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
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
            className="border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[12px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
          >
            <option value="all">All</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[980px] w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {["Image", "Name & SKU", "Category", "Price", "Stock", "Status", "Actions"].map((heading) => (
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
                  Loading products...
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
                  No products found.
                </td>
              </tr>
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
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) {
                        return;
                      }
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openEditor(product.id);
                      }
                    }}
                    className="cursor-pointer border-b border-[var(--color-surface-strong)] hover:bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                  >
                    <td className="px-2 py-4 pl-0">
                      <div className="h-16 w-12 overflow-hidden bg-[var(--color-surface-alt)]">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-[var(--color-surface-strong)]" />
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-4">
                      <p className="font-body text-[13px] text-[var(--color-primary)]">{product.name}</p>
                      <p className="mt-0.5 font-body text-[10px] text-[var(--color-muted-soft)]">{product.sku || "No SKU"}</p>
                    </td>
                    <td className="px-2 py-4 font-body text-[11px] uppercase tracking-[0.08em] text-[var(--color-accent)]">
                      {product.category_name || "Uncategorized"}
                    </td>
                    <td className="px-2 py-4">
                      <p className="font-body text-[13px] text-[var(--color-primary)]">{formatCurrency(product.price)}</p>
                      {product.compare_at_price ? (
                        <p className="font-body text-[11px] text-[var(--color-muted-soft)] line-through">
                          {formatCurrency(product.compare_at_price)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-4">
                      <p
                        className={`font-body text-[13px] ${
                          isOut ? "text-[var(--color-danger)]" : isLow ? "text-[var(--color-accent)]" : "text-[var(--color-primary)]"
                        }`}
                      >
                        {product.stock_quantity}
                      </p>
                      {isLow ? (
                        <span className="mt-1 inline-block rounded-[var(--border-radius)] bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.15)] px-1.5 py-0.5 font-body text-[8px] uppercase tracking-[0.08em] text-[var(--color-accent)]">
                          Low
                        </span>
                      ) : null}
                      {isOut ? (
                        <span className="mt-1 inline-block rounded-[var(--border-radius)] bg-[rgba(var(--color-danger-rgb),0.15)] px-1.5 py-0.5 font-body text-[8px] uppercase tracking-[0.08em] text-[var(--color-danger)]">
                          Out
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-4">
                      <span
                        className={`inline-block rounded-[var(--border-radius)] px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${
                          product.is_available
                            ? "border border-[var(--color-accent)] text-[var(--color-accent)]"
                            : "border border-[var(--color-danger)] text-[var(--color-danger)]"
                        }`}
                      >
                        {product.is_available ? "Available" : "Unavailable"}
                      </span>
                    </td>
                    <td className="px-0 py-4">
                      <div className="flex items-center gap-2 font-body text-[10px] uppercase tracking-[0.1em]">
                        <button
                          type="button"
                          disabled={deletingId === product.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void onDelete(product);
                          }}
                          className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-50"
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

      <div className="border-t border-[var(--color-border)] md:hidden">
        {isLoading ? (
          <p className="py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">Loading products...</p>
        ) : loadError ? (
          <p className="py-8 text-center font-body text-[12px] text-[var(--color-danger)]">{loadError}</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">No products found.</p>
        ) : (
          rows.map((product) => {
            const threshold = product.low_stock_threshold ?? 5;
            const isLow = product.stock_quantity <= threshold && product.stock_quantity > 0;
            const isOut = product.stock_quantity === 0;

            return (
              <div
                key={product.id}
                role="button"
                tabIndex={0}
                onClick={() => openEditor(product.id)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) {
                    return;
                  }
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openEditor(product.id);
                  }
                }}
                className="admin-mobile-card cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                <div className="flex gap-3">
                  <div className="h-[53px] w-[40px] overflow-hidden bg-[var(--color-surface-alt)]">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-[var(--color-surface-strong)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-[12px] text-[var(--color-primary)]">{product.name}</p>
                    <p className="mt-1 truncate font-body text-[10px] text-[var(--color-muted-soft)]">{product.sku || "No SKU"}</p>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="font-body text-[10px] uppercase tracking-[0.08em] text-[var(--color-accent)]">
                    {product.category_name || "Uncategorized"}
                  </p>
                  <p className="font-body text-[12px] text-[var(--color-primary)]">{formatCurrency(product.price)}</p>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <p
                    className={`font-body text-[12px] ${
                      isOut ? "text-[var(--color-danger)]" : isLow ? "text-[var(--color-accent)]" : "text-[var(--color-primary)]"
                    }`}
                  >
                    Stock {product.stock_quantity}
                  </p>
                  <span
                    className={`inline-block rounded-[var(--border-radius)] px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${
                      product.is_available
                        ? "border border-[var(--color-accent)] text-[var(--color-accent)]"
                        : "border border-[var(--color-danger)] text-[var(--color-danger)]"
                    }`}
                  >
                    {product.is_available ? "Available" : "Unavailable"}
                  </span>
                </div>

                <div className="mt-2 flex justify-end gap-3 font-body text-[10px] uppercase tracking-[0.1em]">
                  <button
                    type="button"
                    disabled={deletingId === product.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onDelete(product);
                    }}
                    className="text-[var(--color-muted)] hover:text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId === product.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 font-body text-[11px] text-[var(--color-muted)]">
        <button
          type="button"
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          disabled={page <= 1}
          className="transition-colors hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
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
                  ? "border-[var(--color-primary)] font-medium text-[var(--color-primary)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-primary)]"
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
          className="transition-colors hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
};

export default AdminProductsPage;




