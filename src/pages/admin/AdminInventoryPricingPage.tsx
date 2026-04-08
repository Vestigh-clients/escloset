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

interface ProductGroup {
  product_id: string;
  product_name: string;
  product_image_url: string | null;
  rowStates: RowState[];
}

interface PanelContentProps {
  group: ProductGroup;
  isSaving: boolean;
  canSave: boolean;
  saveMessage: string | null;
  saveTone: "neutral" | "success" | "danger";
  onSave: () => void;
  onClose: () => void;
  updateRowEdit: (rowId: string, field: keyof RowEditState, value: string) => void;
  onUseBasePrice: (rowId: string) => void;
}

const toEditableNumber = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return "";
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
  if (!trimmed) return { value: null as number | null, error: "Stock is required." };
  if (!/^\d+$/.test(trimmed)) return { value: null as number | null, error: "Use whole numbers only." };
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0) return { value: null as number | null, error: "Stock cannot be negative." };
  return { value: Math.trunc(numeric), error: null as string | null };
};

const parsePriceInput = (value: string, rowType: AdminInventoryPricingRow["row_type"]) => {
  const trimmed = value.trim();
  if (!trimmed) {
    if (rowType === "variant") return { value: null as number | null, error: null as string | null };
    return { value: null as number | null, error: "Price is required." };
  }
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0) return { value: null as number | null, error: "Enter a valid non-negative price." };
  return { value: numeric, error: null as string | null };
};

const saveToneClass = (tone: "neutral" | "success" | "danger") => {
  if (tone === "success") return "text-[var(--color-success)]";
  if (tone === "danger") return "text-[var(--color-danger)]";
  return "text-[var(--color-primary)]";
};

const PanelContent = ({
  group,
  isSaving,
  canSave,
  saveMessage,
  saveTone,
  onSave,
  onClose,
  updateRowEdit,
  onUseBasePrice,
}: PanelContentProps) => (
  <div className="flex h-full flex-col">
    {/* Drag handle — mobile only */}
    <div className="flex justify-center pt-3 md:hidden">
      <div className="h-1 w-10 rounded-full bg-[var(--color-border)]" />
    </div>

    {/* Header */}
    <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        {group.product_image_url ? (
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[8px]">
            <img src={group.product_image_url} alt={group.product_name} className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-surface-strong)] font-body text-[16px] uppercase text-[var(--color-muted)]">
            {group.product_name.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-body text-[14px] text-[var(--color-primary)]">{group.product_name}</p>
          <p className="font-body text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
            {group.rowStates.length === 1 ? "Base product" : `${group.rowStates.length} variants`}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close panel"
        className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-alt)] font-body text-[13px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-primary)]"
      >
        ✕
      </button>
    </div>

    {/* Rows */}
    <div className="flex-1 overflow-y-auto px-5">
      {group.rowStates.map((state) => (
        <div key={state.row.row_id} className="border-b border-[var(--color-surface-strong)] py-5 last:border-0">
          {/* Row label + meta */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="font-body text-[12px] text-[var(--color-primary)]">
              {state.row.variant_label ?? "Base product"}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {state.row.sku ? (
                <span className="font-body text-[10px] text-[var(--color-muted-soft)]">SKU: {state.row.sku}</span>
              ) : null}
              {state.dirty ? (
                <span className="rounded-[var(--border-radius)] border border-[var(--color-accent)] px-2 py-0.5 font-body text-[9px] uppercase tracking-[0.08em] text-[var(--color-accent)]">
                  Edited
                </span>
              ) : null}
            </div>
          </div>

          {/* Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="font-body text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted-soft)]">Stock</span>
              <input
                type="number"
                min={0}
                step={1}
                value={state.edit.stock}
                onChange={(e) => updateRowEdit(state.row.row_id, "stock", e.target.value)}
                className="mt-1 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-1 font-body text-[15px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
              />
              {state.stockError ? (
                <p className="mt-1 font-body text-[10px] text-[var(--color-danger)]">{state.stockError}</p>
              ) : null}
            </label>

            <label className="block">
              <span className="font-body text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted-soft)]">Price</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={state.edit.price}
                onChange={(e) => updateRowEdit(state.row.row_id, "price", e.target.value)}
                placeholder={state.row.row_type === "variant" ? "Use base" : ""}
                className="mt-1 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-1 font-body text-[15px] text-[var(--color-primary)] outline-none placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)]"
              />
              {state.priceError ? (
                <p className="mt-1 font-body text-[10px] text-[var(--color-danger)]">{state.priceError}</p>
              ) : null}
            </label>
          </div>

          {/* Variant: use base price */}
          {state.row.row_type === "variant" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
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

          {/* Server error */}
          {state.serverError ? (
            <p className="mt-2 font-body text-[10px] text-[var(--color-danger)]">{state.serverError}</p>
          ) : null}
        </div>
      ))}
    </div>

    {/* Footer */}
    <div className="shrink-0 border-t border-[var(--color-border)] bg-white px-5 pb-6 pt-4">
      {saveMessage ? (
        <p className={`mb-3 font-body text-[11px] ${saveToneClass(saveTone)}`}>{saveMessage}</p>
      ) : null}
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave}
        className="w-full rounded-[var(--border-radius)] bg-[var(--color-primary)] py-3 font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSaving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  </div>
);

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
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

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

  const productGroups = useMemo<ProductGroup[]>(() => {
    const map = new Map<string, ProductGroup>();
    for (const state of rowStates) {
      const existing = map.get(state.row.product_id);
      if (existing) {
        existing.rowStates.push(state);
      } else {
        map.set(state.row.product_id, {
          product_id: state.row.product_id,
          product_name: state.row.product_name,
          product_image_url: state.row.product_image_url,
          rowStates: [state],
        });
      }
    }
    return Array.from(map.values());
  }, [rowStates]);

  const normalizedSearch = searchInput.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!normalizedSearch) return productGroups;
    return productGroups.filter((group) =>
      group.rowStates.some(({ row }) => {
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
      }),
    );
  }, [normalizedSearch, productGroups]);

  const dirtyStates = useMemo(() => rowStates.filter((s) => s.dirty), [rowStates]);

  const hasInvalidDirtyRows = useMemo(
    () => dirtyStates.some((s) => Boolean(s.stockError) || Boolean(s.priceError)),
    [dirtyStates],
  );

  const validDirtyChanges = useMemo<AdminInventoryPricingBulkChange[]>(
    () =>
      dirtyStates
        .filter(
          (s) =>
            !s.stockError &&
            !s.priceError &&
            typeof s.parsedStock === "number" &&
            (s.parsedPrice === null || typeof s.parsedPrice === "number"),
        )
        .map((s) => ({
          row_id: s.row.row_id,
          row_type: s.row.row_type,
          product_id: s.row.product_id,
          variant_id: s.row.variant_id,
          stock_quantity: s.parsedStock as number,
          price: s.parsedPrice,
        })),
    [dirtyStates],
  );

  const canSaveAll = validDirtyChanges.length > 0 && !hasInvalidDirtyRows && !isSaving;

  const selectedGroup = useMemo(
    () => (selectedProductId ? (productGroups.find((g) => g.product_id === selectedProductId) ?? null) : null),
    [selectedProductId, productGroups],
  );

  const selectedGroupValidChanges = useMemo(
    () => validDirtyChanges.filter((c) => c.product_id === selectedProductId),
    [validDirtyChanges, selectedProductId],
  );

  const selectedGroupHasErrors =
    selectedGroup?.rowStates.some((s) => s.dirty && (s.stockError || s.priceError)) ?? false;

  const canSaveProduct = selectedGroupValidChanges.length > 0 && !selectedGroupHasErrors && !isSaving;

  const updateRowEdit = (rowId: string, field: keyof RowEditState, value: string) => {
    setEdits((current) => {
      const existing = current[rowId] ?? baselineEdits[rowId] ?? { stock: "0", price: "" };
      return { ...current, [rowId]: { ...existing, [field]: value } };
    });
    setRowErrors((current) => {
      if (!(rowId in current)) return current;
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  };

  const onUseBasePrice = (rowId: string) => {
    updateRowEdit(rowId, "price", "");
  };

  const openProduct = (productId: string) => {
    setSelectedProductId(productId);
    setSaveMessage(null);
  };

  const closePanel = () => {
    setSelectedProductId(null);
    setSaveMessage(null);
  };

  const onSaveChanges = async (changes: AdminInventoryPricingBulkChange[]) => {
    if (changes.length === 0 || isSaving) return;
    setIsSaving(true);
    setSaveMessage(null);
    setRowErrors({});
    const previousEdits = edits;

    try {
      const result = await bulkUpdateAdminInventoryPricingRows(changes);
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
          // Keep current state if refresh fails.
        }
      }

      if (result.updatedCount > 0 && result.failedCount === 0) {
        setSaveTone("success");
        setSaveMessage(`Updated ${result.updatedCount} row${result.updatedCount === 1 ? "" : "s"} successfully.`);
      } else if (result.updatedCount > 0) {
        setSaveTone("neutral");
        setSaveMessage(`Updated ${result.updatedCount}; ${result.failedCount} failed.`);
      } else {
        setSaveTone("danger");
        setSaveMessage("No rows updated. Fix errors and retry.");
      }
    } catch {
      setSaveTone("danger");
      setSaveMessage("Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const panelOpen = selectedProductId !== null;

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title font-display text-[36px] italic text-[var(--color-primary)]">
            Inventory & Pricing
          </h1>
          <p className="mt-2 font-body text-[12px] text-[var(--color-muted)]">
            Tap a product image to manage its stock and pricing.
          </p>
        </div>

        <div className="admin-page-actions">
          <p className="font-body text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
            Unsaved: {dirtyStates.length}
          </p>
          <button
            type="button"
            onClick={() => void onSaveChanges(validDirtyChanges)}
            disabled={!canSaveAll}
            className="rounded-[var(--border-radius)] bg-[var(--color-primary)] px-7 py-3 text-center font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Saving..." : "Save All"}
          </button>
        </div>
      </div>

      {/* Search + count */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-border)] pb-5">
        <div className="admin-search-wrap w-full max-w-[360px]">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search product or variant..."
            className="w-full border-0 border-b border-[var(--color-border)] bg-transparent px-0 pb-2 font-body text-[12px] text-[var(--color-primary)] outline-none placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)]"
          />
        </div>
        <p className="font-body text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
          {filteredGroups.length} products
        </p>
      </div>

      {/* Product grid */}
      {isLoading ? (
        <p className="py-12 text-center font-body text-[12px] text-[var(--color-muted-soft)]">Loading products...</p>
      ) : loadError ? (
        <p className="py-12 text-center font-body text-[12px] text-[var(--color-danger)]">{loadError}</p>
      ) : filteredGroups.length === 0 ? (
        <p className="py-12 text-center font-body text-[12px] text-[var(--color-muted-soft)]">No products found.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {filteredGroups.map((group) => {
            const hasUnsaved = group.rowStates.some((s) => s.dirty);
            const hasErrors = group.rowStates.some((s) => s.dirty && (s.stockError || s.priceError || s.serverError));
            const isSelected = group.product_id === selectedProductId;

            return (
              <button
                key={group.product_id}
                type="button"
                onClick={() => openProduct(group.product_id)}
                className="group flex flex-col gap-1.5 text-left"
              >
                <div
                  className={`relative aspect-square w-full overflow-hidden rounded-[12px] bg-[var(--color-surface-alt)] transition-transform duration-150 group-active:scale-95 ${
                    isSelected ? "ring-2 ring-[var(--color-primary)] ring-offset-1" : ""
                  }`}
                >
                  {group.product_image_url ? (
                    <img
                      src={group.product_image_url}
                      alt={group.product_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--color-surface-strong)] font-body text-[20px] uppercase text-[var(--color-muted)]">
                      {group.product_name.slice(0, 1)}
                    </div>
                  )}

                  {/* Status dot */}
                  {hasErrors ? (
                    <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[var(--color-danger)] shadow-sm" />
                  ) : hasUnsaved ? (
                    <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[var(--color-accent)] shadow-sm" />
                  ) : null}
                </div>

                <p className="truncate font-body text-[10px] text-[var(--color-primary)]">{group.product_name}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Backdrop */}
      {panelOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          onClick={closePanel}
          aria-hidden="true"
        />
      ) : null}

      {/* Mobile — bottom sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[78vh] rounded-t-[20px] bg-white shadow-2xl transition-transform duration-300 md:hidden ${
          panelOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {selectedGroup ? (
          <PanelContent
            group={selectedGroup}
            isSaving={isSaving}
            canSave={canSaveProduct}
            saveMessage={saveMessage}
            saveTone={saveTone}
            onSave={() => void onSaveChanges(selectedGroupValidChanges)}
            onClose={closePanel}
            updateRowEdit={updateRowEdit}
            onUseBasePrice={onUseBasePrice}
          />
        ) : null}
      </div>

      {/* Tablet / Desktop — side drawer */}
      <div
        className={`fixed bottom-0 right-0 top-0 z-50 hidden w-[400px] bg-white shadow-2xl transition-transform duration-300 md:block ${
          panelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {selectedGroup ? (
          <PanelContent
            group={selectedGroup}
            isSaving={isSaving}
            canSave={canSaveProduct}
            saveMessage={saveMessage}
            saveTone={saveTone}
            onSave={() => void onSaveChanges(selectedGroupValidChanges)}
            onClose={closePanel}
            updateRowEdit={updateRowEdit}
            onUseBasePrice={onUseBasePrice}
          />
        ) : null}
      </div>
    </div>
  );
};

export default AdminInventoryPricingPage;
