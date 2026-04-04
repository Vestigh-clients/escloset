import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/adminFormatting";
import {
  bulkUpdateAdminInventoryPricingRows,
  fetchAdminInventoryPricingRows,
  type AdminInventoryPricingBulkChange,
  type AdminInventoryPricingRow,
} from "@/services/adminService";

interface RowEditState {
  stock: string;
  price: string;
}

interface RowState {
  row: AdminInventoryPricingRow;
  edit: RowEditState;
  baseline: RowEditState;
  dirty: boolean;
  parsedStock: number | null;
  parsedPrice: number | null;
  stockError: string | null;
  priceError: string | null;
  serverError: string | null;
}

const toEditableNumber = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) {
    return "";
  }

  return Number(value).toString();
};

const createInitialEdits = (rows: AdminInventoryPricingRow[]): Record<string, RowEditState> => {
  const next: Record<string, RowEditState> = {};

  for (const row of rows) {
    next[row.row_id] = {
      stock: String(Math.max(0, Math.trunc(row.stock_quantity))),
      price: row.row_type === "variant" ? toEditableNumber(row.variant_price) : toEditableNumber(row.effective_price),
    };
  }

  return next;
};

const parseStockInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null as number | null, error: "Stock is required." };
  }

  if (!/^\d+$/.test(trimmed)) {
    return { value: null as number | null, error: "Use whole numbers only." };
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return { value: null as number | null, error: "Stock cannot be negative." };
  }

  return { value: Math.trunc(numeric), error: null as string | null };
};

const parsePriceInput = (value: string, rowType: AdminInventoryPricingRow["row_type"]) => {
  const trimmed = value.trim();
  if (!trimmed) {
    if (rowType === "variant") {
      return { value: null as number | null, error: null as string | null };
    }

    return { value: null as number | null, error: "Price is required." };
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return { value: null as number | null, error: "Enter a valid non-negative price." };
  }

  return { value: numeric, error: null as string | null };
};

const saveToneClass = (tone: "neutral" | "success" | "danger") => {
  if (tone === "success") {
    return "text-[var(--color-success)]";
  }

  if (tone === "danger") {
    return "text-[var(--color-danger)]";
  }

  return "text-[var(--color-primary)]";
};

const AdminInventoryPricingPage = () => {
  const [rows, setRows] = useState<AdminInventoryPricingRow[]>([]);
  const [edits, setEdits] = useState<Record<string, RowEditState>>({});
  const [searchInput, setSearchInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveTone, setSaveTone] = useState<"neutral" | "success" | "danger">("neutral");
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await fetchAdminInventoryPricingRows();
      setRows(data);
      setEdits(createInitialEdits(data));
      setRowErrors({});
    } catch {
      setRows([]);
      setEdits({});
      setLoadError("Unable to load inventory and pricing rows.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const baselineEdits = useMemo(() => createInitialEdits(rows), [rows]);

  const rowStates = useMemo<RowState[]>(() => {
    return rows.map((row) => {
      const baseline = baselineEdits[row.row_id] ?? {
        stock: String(Math.max(0, Math.trunc(row.stock_quantity))),
        price: row.row_type === "variant" ? toEditableNumber(row.variant_price) : toEditableNumber(row.effective_price),
      };
      const edit = edits[row.row_id] ?? baseline;
      const stockParse = parseStockInput(edit.stock);
      const priceParse = parsePriceInput(edit.price, row.row_type);
      const dirty = edit.stock !== baseline.stock || edit.price !== baseline.price;

      return {
        row,
        edit,
        baseline,
        dirty,
        parsedStock: stockParse.value,
        parsedPrice: priceParse.value,
        stockError: dirty ? stockParse.error : null,
        priceError: dirty ? priceParse.error : null,
        serverError: rowErrors[row.row_id] ?? null,
      };
    });
  }, [baselineEdits, edits, rowErrors, rows]);

  const normalizedSearch = searchInput.trim().toLowerCase();

  const filteredStates = useMemo(() => {
    if (!normalizedSearch) {
      return rowStates;
    }

    return rowStates.filter(({ row }) => {
      const searchable = [
        row.item_label,
        row.product_name,
        row.variant_label ?? "",
        row.sku ?? "",
        row.product_sku ?? "",
        row.variant_sku ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [normalizedSearch, rowStates]);

  const dirtyStates = useMemo(() => rowStates.filter((state) => state.dirty), [rowStates]);

  const hasInvalidDirtyRows = useMemo(
    () => dirtyStates.some((state) => Boolean(state.stockError) || Boolean(state.priceError)),
    [dirtyStates],
  );

  const validDirtyChanges = useMemo<AdminInventoryPricingBulkChange[]>(
    () =>
      dirtyStates
        .filter(
          (state) =>
            !state.stockError &&
            !state.priceError &&
            typeof state.parsedStock === "number" &&
            (state.parsedPrice === null || typeof state.parsedPrice === "number"),
        )
        .map((state) => ({
          row_id: state.row.row_id,
          row_type: state.row.row_type,
          product_id: state.row.product_id,
          variant_id: state.row.variant_id,
          stock_quantity: state.parsedStock as number,
          price: state.parsedPrice,
        })),
    [dirtyStates],
  );

  const canSave = validDirtyChanges.length > 0 && !hasInvalidDirtyRows && !isSaving;

  const updateRowEdit = (rowId: string, field: keyof RowEditState, value: string) => {
    setEdits((current) => {
      const existing = current[rowId] ?? baselineEdits[rowId] ?? { stock: "0", price: "" };
      return {
        ...current,
        [rowId]: {
          ...existing,
          [field]: value,
        },
      };
    });

    setRowErrors((current) => {
      if (!(rowId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[rowId];
      return next;
    });
  };

  const onUseBasePrice = (rowId: string) => {
    updateRowEdit(rowId, "price", "");
  };

  const onBulkUpdate = async () => {
    if (!canSave) {
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);
    setRowErrors({});
    const previousEdits = edits;

    try {
      const result = await bulkUpdateAdminInventoryPricingRows(validDirtyChanges);
      setRowErrors(result.rowErrors);

      if (result.updatedCount > 0) {
        try {
          const refreshedRows = await fetchAdminInventoryPricingRows();
          const refreshedEdits = createInitialEdits(refreshedRows);

          for (const failedRowId of Object.keys(result.rowErrors)) {
            if (previousEdits[failedRowId] && refreshedEdits[failedRowId]) {
              refreshedEdits[failedRowId] = previousEdits[failedRowId];
            }
          }

          setRows(refreshedRows);
          setEdits(refreshedEdits);
        } catch {
          // Keep current state if refresh fails; row-level save result is already known.
        }
      }

      if (result.updatedCount > 0 && result.failedCount === 0) {
        setSaveTone("success");
        setSaveMessage(`Updated ${result.updatedCount} row${result.updatedCount === 1 ? "" : "s"} successfully.`);
      } else if (result.updatedCount > 0) {
        setSaveTone("neutral");
        setSaveMessage(
          `Updated ${result.updatedCount} row${result.updatedCount === 1 ? "" : "s"}; ${result.failedCount} failed.`,
        );
      } else {
        setSaveTone("danger");
        setSaveMessage("No rows were updated. Fix highlighted rows and try again.");
      }
    } catch {
      setSaveTone("danger");
      setSaveMessage("Bulk update failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title font-display text-[36px] italic text-[var(--color-primary)]">Inventory & Pricing</h1>
          <p className="mt-2 font-body text-[12px] text-[var(--color-muted)]">
            Update stock and pricing quickly across variant and base-product rows.
          </p>
        </div>

        <div className="admin-page-actions">
          <p className="font-body text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
            Unsaved changes: {dirtyStates.length}
          </p>
          <button
            type="button"
            onClick={() => void onBulkUpdate()}
            disabled={!canSave}
            className="rounded-[var(--border-radius)] bg-[var(--color-primary)] px-7 py-3 text-center font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Updating..." : "Update Bulk"}
          </button>
        </div>
      </div>

      {saveMessage ? (
        <p className={`mb-4 font-body text-[12px] ${saveToneClass(saveTone)}`}>{saveMessage}</p>
      ) : null}

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-border)] pb-5">
        <div className="admin-search-wrap w-full max-w-[360px]">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search item, variant label or SKU..."
            className="w-full border-0 border-b border-[var(--color-border)] bg-transparent px-0 pb-2 font-body text-[12px] text-[var(--color-primary)] outline-none placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)]"
          />
        </div>

        <p className="font-body text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
          {filteredStates.length} rows
        </p>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {["Item", "Stock", "Price"].map((heading) => (
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
                <td colSpan={3} className="px-0 py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">
                  Loading rows...
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={3} className="px-0 py-8 text-center font-body text-[12px] text-[var(--color-danger)]">
                  {loadError}
                </td>
              </tr>
            ) : filteredStates.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-0 py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">
                  No matching rows found.
                </td>
              </tr>
            ) : (
              filteredStates.map((state) => (
                <tr
                  key={state.row.row_id}
                  className={`border-b border-[var(--color-surface-strong)] ${
                    state.dirty ? "bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.04)]" : ""
                  }`}
                >
                  <td className="px-2 py-4 pl-0 align-top">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="h-[52px] w-[40px] shrink-0 overflow-hidden rounded-[10px] bg-[var(--color-surface-alt)]">
                        {state.row.product_image_url ? (
                          <img src={state.row.product_image_url} alt={state.row.product_name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[var(--color-surface-strong)] font-body text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
                            {state.row.product_name.slice(0, 1)}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="break-words font-body text-[13px] text-[var(--color-primary)]">{state.row.item_label}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-[var(--border-radius)] border border-[var(--color-border)] px-2 py-0.5 font-body text-[9px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
                            {state.row.row_type === "variant" ? "Variant" : "Base"}
                          </span>
                          <span className="font-body text-[10px] text-[var(--color-muted-soft)]">
                            {state.row.sku ? `SKU: ${state.row.sku}` : "No SKU"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-2 py-4 align-top">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={state.edit.stock}
                      onChange={(event) => updateRowEdit(state.row.row_id, "stock", event.target.value)}
                      className="w-full max-w-[120px] border-0 border-b border-[var(--color-border)] bg-transparent pb-1 font-body text-[13px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
                    />
                    {state.stockError ? (
                      <p className="mt-1 font-body text-[10px] text-[var(--color-danger)]">{state.stockError}</p>
                    ) : null}
                  </td>

                  <td className="px-0 py-4 align-top">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={state.edit.price}
                      onChange={(event) => updateRowEdit(state.row.row_id, "price", event.target.value)}
                      placeholder={state.row.row_type === "variant" ? "Use base price" : ""}
                      className="w-full max-w-[180px] border-0 border-b border-[var(--color-border)] bg-transparent pb-1 font-body text-[13px] text-[var(--color-primary)] outline-none placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)]"
                    />

                    {state.row.row_type === "variant" ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onUseBasePrice(state.row.row_id)}
                          className="font-body text-[10px] uppercase tracking-[0.08em] text-[var(--color-accent)] transition-colors hover:text-[var(--color-primary)]"
                        >
                          Use base price
                        </button>

                        {state.parsedPrice === null ? (
                          <span className="rounded-[var(--border-radius)] border border-[var(--color-border)] px-2 py-0.5 font-body text-[9px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
                            Base: {formatCurrency(state.row.product_base_price)}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {state.priceError ? (
                      <p className="mt-1 font-body text-[10px] text-[var(--color-danger)]">{state.priceError}</p>
                    ) : null}
                    {state.serverError ? (
                      <p className="mt-1 font-body text-[10px] text-[var(--color-danger)]">{state.serverError}</p>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[var(--color-border)] md:hidden">
        {isLoading ? (
          <p className="py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">Loading rows...</p>
        ) : loadError ? (
          <p className="py-8 text-center font-body text-[12px] text-[var(--color-danger)]">{loadError}</p>
        ) : filteredStates.length === 0 ? (
          <p className="py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">No matching rows found.</p>
        ) : (
          filteredStates.map((state) => (
            <div key={state.row.row_id} className="admin-mobile-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="h-[52px] w-[40px] shrink-0 overflow-hidden rounded-[10px] bg-[var(--color-surface-alt)]">
                    {state.row.product_image_url ? (
                      <img src={state.row.product_image_url} alt={state.row.product_name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[var(--color-surface-strong)] font-body text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
                        {state.row.product_name.slice(0, 1)}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="break-words font-body text-[12px] text-[var(--color-primary)]">{state.row.item_label}</p>
                    <p className="mt-1 font-body text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted-soft)]">
                      {state.row.row_type === "variant" ? "Variant" : "Base product"}
                    </p>
                    <p className="mt-1 break-all font-body text-[10px] text-[var(--color-muted-soft)]">
                      {state.row.sku ? `SKU: ${state.row.sku}` : "No SKU"}
                    </p>
                  </div>
                </div>

                {state.dirty ? (
                  <span className="rounded-[var(--border-radius)] border border-[var(--color-accent)] px-2 py-1 font-body text-[9px] uppercase tracking-[0.08em] text-[var(--color-accent)]">
                    Unsaved
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block min-w-0">
                  <span className="font-body text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted-soft)]">Stock</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={state.edit.stock}
                    onChange={(event) => updateRowEdit(state.row.row_id, "stock", event.target.value)}
                    className="mt-1 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-1 font-body text-[13px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
                  />
                </label>

                <label className="block min-w-0">
                  <span className="font-body text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted-soft)]">Price</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={state.edit.price}
                    onChange={(event) => updateRowEdit(state.row.row_id, "price", event.target.value)}
                    placeholder={state.row.row_type === "variant" ? "Use base" : ""}
                    className="mt-1 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-1 font-body text-[13px] text-[var(--color-primary)] outline-none placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)]"
                  />
                </label>
              </div>

              {state.row.row_type === "variant" ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUseBasePrice(state.row.row_id)}
                    className="font-body text-[10px] uppercase tracking-[0.08em] text-[var(--color-accent)] transition-colors hover:text-[var(--color-primary)]"
                  >
                    Use base price
                  </button>

                  {state.parsedPrice === null ? (
                    <span className="rounded-[var(--border-radius)] border border-[var(--color-border)] px-2 py-0.5 font-body text-[9px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
                      Base: {formatCurrency(state.row.product_base_price)}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {state.stockError ? <p className="mt-1 font-body text-[10px] text-[var(--color-danger)]">{state.stockError}</p> : null}
              {state.priceError ? <p className="mt-1 font-body text-[10px] text-[var(--color-danger)]">{state.priceError}</p> : null}
              {state.serverError ? <p className="mt-1 font-body text-[10px] text-[var(--color-danger)]">{state.serverError}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminInventoryPricingPage;
