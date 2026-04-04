import { useEffect, useMemo, useState } from "react";
import {
  createAdminShippingRate,
  deleteAdminShippingRate,
  fetchAdminShippingRates,
  updateAdminShippingRate,
  type AdminShippingRateRow,
} from "@/services/adminManagementService";
import { formatCurrency } from "@/lib/adminFormatting";

const GHANA_REGIONS = [
  "Greater Accra",
  "Ashanti",
  "Western",
  "Central",
  "Eastern",
  "Volta",
  "Northern",
  "Upper East",
  "Upper West",
  "Brong-Ahafo",
  "Western North",
  "Ahafo",
  "Bono East",
  "Oti",
  "North East",
  "Savannah",
];

interface ShippingRateFormState {
  id: string | null;
  name: string;
  states: string[];
  isDefault: boolean;
  baseRate: string;
  minDays: string;
  maxDays: string;
  isActive: boolean;
}

const defaultFormState: ShippingRateFormState = {
  id: null,
  name: "",
  states: [],
  isDefault: true,
  baseRate: "",
  minDays: "1",
  maxDays: "3",
  isActive: true,
};

const AdminShippingRatesPage = () => {
  const [rows, setRows] = useState<AdminShippingRateRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<ShippingRateFormState>(defaultFormState);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [stateSearchInput, setStateSearchInput] = useState("");
  const [dayValidationMessage, setDayValidationMessage] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchAdminShippingRates();
      setRows(data);
    } catch {
      setRows([]);
      setLoadError("Unable to load shipping rates.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const availableStates = useMemo(() => {
    const normalizedSearch = stateSearchInput.trim().toLowerCase();
    return GHANA_REGIONS.filter(
      (state) => !form.states.includes(state) && (!normalizedSearch || state.toLowerCase().includes(normalizedSearch)),
    );
  }, [form.states, stateSearchInput]);

  const existingDefaultRate = useMemo(
    () => rows.find((row) => row.states.length === 0 && row.id !== form.id),
    [rows, form.id],
  );

  const openCreateForm = () => {
    setForm(defaultFormState);
    setDeleteConfirmId(null);
    setStateSearchInput("");
    setDayValidationMessage(null);
    setIsFormOpen(true);
  };

  const openEditForm = (row: AdminShippingRateRow) => {
    setForm({
      id: row.id,
      name: row.name,
      states: row.states,
      isDefault: row.states.length === 0,
      baseRate: String(row.base_rate),
      minDays: row.estimated_days_min ? String(row.estimated_days_min) : "1",
      maxDays: row.estimated_days_max ? String(row.estimated_days_max) : "3",
      isActive: row.is_active ?? true,
    });
    setDeleteConfirmId(null);
    setStateSearchInput("");
    setDayValidationMessage(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setForm(defaultFormState);
    setIsFormOpen(false);
    setStateSearchInput("");
    setDayValidationMessage(null);
  };

  const validateDays = () => {
    const min = Number(form.minDays);
    const max = Number(form.maxDays);
    if (Number.isFinite(min) && Number.isFinite(max) && max < min) {
      setDayValidationMessage("Must be greater than or equal to minimum days");
      return false;
    }
    setDayValidationMessage(null);
    return true;
  };

  const saveForm = async () => {
    const name = form.name.trim();
    const baseRate = Number(form.baseRate);
    const minDays = Number(form.minDays);
    const maxDays = Number(form.maxDays);
    const states = form.isDefault ? [] : form.states;

    if (!name) {
      setMessage("Rate name is required.");
      return;
    }
    if (!Number.isFinite(baseRate) || baseRate < 0) {
      setMessage("Base rate is required.");
      return;
    }
    if (!Number.isFinite(minDays) || minDays < 1) {
      setMessage("Minimum delivery days must be at least 1.");
      return;
    }
    if (!Number.isFinite(maxDays) || maxDays < 1) {
      setMessage("Maximum delivery days must be at least 1.");
      return;
    }
    if (maxDays < minDays) {
      setDayValidationMessage("Must be greater than or equal to minimum days");
      return;
    }
    if (!form.isDefault && states.length === 0) {
      setMessage("Select at least one state, or mark as default.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name,
        states,
        base_rate: baseRate,
        estimated_days_min: minDays,
        estimated_days_max: maxDays,
        is_active: form.isActive,
      };

      if (form.id) {
        const previous = rows.find((entry) => entry.id === form.id);
        await updateAdminShippingRate(form.id, payload, previous);
        setMessage("Shipping rate updated.");
      } else {
        await createAdminShippingRate(payload);
        setMessage("Shipping rate created.");
      }

      await load();
      closeForm();
    } catch {
      setMessage("Unable to save shipping rate.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async (row: AdminShippingRateRow) => {
    if (row.states.length === 0) {
      setMessage("The default rate cannot be deleted. Edit it or create a new default first.");
      return;
    }

    await deleteAdminShippingRate(row);
    setDeleteConfirmId(null);
    setMessage("Shipping rate deleted.");
    await load();
  };

  const addState = (state: string) => {
    if (form.states.includes(state)) return;
    setForm((current) => ({
      ...current,
      isDefault: false,
      states: [...current.states, state],
    }));
  };

  const removeState = (state: string) => {
    setForm((current) => ({
      ...current,
      states: current.states.filter((entry) => entry !== state),
    }));
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title font-display text-[36px] italic text-[var(--color-primary)]">Shipping Rates</h1>
        <div className="admin-page-actions">
          <button
            type="button"
            onClick={openCreateForm}
            className="rounded-[var(--border-radius)] bg-[var(--color-primary)] px-7 py-3 font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)]"
          >
            Add Rate
          </button>
        </div>
      </div>

      <div className="mb-8 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.08)] px-5 py-4">
        <p className="font-body text-[12px] leading-[1.8] text-[var(--color-muted)]">
          Rates are matched by state. If no state-specific rate is found for a customer&apos;s delivery address, the default nationwide
          rate is used. You must always have one active default rate with no states selected.
        </p>
      </div>

      {message ? <p className="mb-4 font-body text-[12px] text-[var(--color-accent)]">{message}</p> : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[1020px] w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {["Name", "States Covered", "Rate", "Est. Delivery", "Status", "Actions"].map((heading) => (
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
                <td colSpan={6} className="px-0 py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">
                  Loading shipping rates...
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={6} className="px-0 py-8 text-center font-body text-[12px] text-[var(--color-danger)]">
                  {loadError}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-0 py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">
                  No shipping rates found.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isDefault = row.states.length === 0;
                const statesText =
                  row.states.length <= 2 ? row.states.join(", ") : `${row.states.slice(0, 2).join(", ")} [${row.states.length - 2}] more`;
                return (
                  <tr key={row.id} className="border-b border-[var(--color-surface-strong)] hover:bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.04)]">
                    <td className="px-2 py-4 pl-0 font-body text-[13px] text-[var(--color-primary)]">{row.name}</td>
                    <td className="px-2 py-4">
                      {isDefault ? (
                        <p className="font-body text-[11px] text-[var(--color-accent)]">All States (Default)</p>
                      ) : (
                        <p title={row.states.join(", ")} className="font-body text-[11px] text-[var(--color-muted)]">
                          {statesText}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-4 font-body text-[13px] text-[var(--color-primary)]">{formatCurrency(row.base_rate)}</td>
                    <td className="px-2 py-4 font-body text-[11px] text-[var(--color-muted)]">
                      {row.estimated_days_min ?? 1}-{row.estimated_days_max ?? row.estimated_days_min ?? 1} business days
                    </td>
                    <td className="px-2 py-4">
                      <span
                        className={`inline-block rounded-[var(--border-radius)] border px-[10px] py-[4px] font-body text-[9px] uppercase tracking-[0.12em] ${
                          row.is_active ? "border-[var(--color-accent)] text-[var(--color-accent)]" : "border-[var(--color-border)] text-[var(--color-muted-soft)]"
                        }`}
                      >
                        {row.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-0 py-4">
                      {deleteConfirmId === row.id ? (
                        <div className="font-body text-[11px] text-[var(--color-danger)]">
                          Delete {row.name}? This cannot be undone.
                          <div className="mt-2 flex items-center gap-3 font-body text-[10px] uppercase tracking-[0.1em]">
                            <button type="button" onClick={() => void confirmDelete(row)} className="text-[var(--color-danger)]">
                              Yes, Delete
                            </button>
                            <button type="button" onClick={() => setDeleteConfirmId(null)} className="text-[var(--color-muted)]">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 font-body text-[10px] uppercase tracking-[0.1em]">
                          <button type="button" onClick={() => openEditForm(row)} className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]">
                            Edit
                          </button>
                          {isDefault ? (
                            <span className="rounded-[var(--border-radius)] border border-[var(--color-accent)] px-[10px] py-[3px] text-[9px] tracking-[0.1em] text-[var(--color-accent)]">
                              Default
                            </span>
                          ) : (
                            <button type="button" onClick={() => setDeleteConfirmId(row.id)} className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-danger)]">
                              Delete
                            </button>
                          )}
                        </div>
                      )}
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
          <p className="py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">Loading shipping rates...</p>
        ) : loadError ? (
          <p className="py-8 text-center font-body text-[12px] text-[var(--color-danger)]">{loadError}</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center font-body text-[12px] text-[var(--color-muted-soft)]">No shipping rates found.</p>
        ) : (
          rows.map((row) => {
            const isDefault = row.states.length === 0;
            const statesText =
              row.states.length <= 2 ? row.states.join(", ") : `${row.states.slice(0, 2).join(", ")} [${row.states.length - 2}] more`;
            return (
              <div key={`mobile-${row.id}`} className="admin-mobile-card">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-body text-[12px] text-[var(--color-primary)]">{row.name}</p>
                  <span
                    className={`inline-block rounded-[var(--border-radius)] border px-[10px] py-[4px] font-body text-[9px] uppercase tracking-[0.12em] ${
                      row.is_active ? "border-[var(--color-accent)] text-[var(--color-accent)]" : "border-[var(--color-border)] text-[var(--color-muted-soft)]"
                    }`}
                  >
                    {row.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <p className="mt-2 font-body text-[11px] text-[var(--color-muted-soft)]">
                  {isDefault ? "All States (Default)" : statesText || "No states"}
                </p>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="font-body text-[12px] text-[var(--color-primary)]">{formatCurrency(row.base_rate)}</p>
                  <p className="font-body text-[11px] text-[var(--color-muted-soft)]">
                    {row.estimated_days_min ?? 1}-{row.estimated_days_max ?? row.estimated_days_min ?? 1} business days
                  </p>
                </div>

                <div className="mt-2 flex justify-end gap-3 font-body text-[10px] uppercase tracking-[0.1em]">
                  {deleteConfirmId === row.id ? (
                    <>
                      <button type="button" onClick={() => void confirmDelete(row)} className="text-[var(--color-danger)]">
                        Yes Delete
                      </button>
                      <button type="button" onClick={() => setDeleteConfirmId(null)} className="text-[var(--color-muted)]">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => openEditForm(row)} className="text-[var(--color-muted)] hover:text-[var(--color-primary)]">
                        Edit
                      </button>
                      {isDefault ? (
                        <span className="text-[var(--color-accent)]">Default</span>
                      ) : (
                        <button type="button" onClick={() => setDeleteConfirmId(row.id)} className="text-[var(--color-muted)] hover:text-[var(--color-danger)]">
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {isFormOpen ? (
        <div className="mt-6 border border-[var(--color-border)] p-6">
          <p className="mb-4 font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">{form.id ? "Edit Rate" : "Add Shipping Rate"}</p>

          <div className="grid gap-5">
            <div>
              <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">Rate Name *</label>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="mt-2 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[13px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
                placeholder="e.g. Greater Accra Standard"
              />
            </div>

            <div>
              <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">States</label>
              <input
                value={stateSearchInput}
                onChange={(event) => setStateSearchInput(event.target.value)}
                disabled={form.isDefault}
                placeholder="Search states..."
                className="mt-2 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[13px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
              />

              {!form.isDefault && availableStates.length > 0 ? (
                <div className="mt-2 max-h-[140px] overflow-y-auto border border-[var(--color-border)]">
                  {availableStates.map((state) => (
                    <button
                      key={state}
                      type="button"
                      onClick={() => addState(state)}
                      className="block w-full border-b border-[var(--color-surface-strong)] px-4 py-2 text-left font-body text-[12px] text-[var(--color-primary)] hover:bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.05)]"
                    >
                      {state}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {form.states.map((state) => (
                  <span
                    key={state}
                    className="inline-flex items-center gap-2 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.06)] px-[10px] py-1 font-body text-[11px] text-[var(--color-primary)]"
                  >
                    {state}
                    <button type="button" onClick={() => removeState(state)} className="text-[var(--color-muted)] hover:text-[var(--color-danger)]">
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <label className="mt-3 inline-flex items-center gap-2 font-body text-[11px] text-[var(--color-muted)]">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isDefault: event.target.checked,
                      states: event.target.checked ? [] : current.states,
                    }))
                  }
                  className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                />
                Applies to all regions (default rate)
              </label>

              {form.isDefault && existingDefaultRate ? (
                <p className="mt-2 font-body text-[11px] text-[var(--color-accent)]">A default rate already exists. Saving this will replace it.</p>
              ) : null}
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div>
                <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">Base Rate GH? *</label>
                <input
                  inputMode="decimal"
                  value={form.baseRate}
                  onChange={(event) => setForm((current) => ({ ...current, baseRate: event.target.value.replace(/[^\d.]/g, "") }))}
                  className="mt-2 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[13px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">Estimated Delivery Min Days *</label>
                <input
                  inputMode="numeric"
                  value={form.minDays}
                  onChange={(event) => setForm((current) => ({ ...current, minDays: event.target.value.replace(/[^\d]/g, "") }))}
                  onBlur={validateDays}
                  className="mt-2 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[13px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">Estimated Delivery Max Days *</label>
                <input
                  inputMode="numeric"
                  value={form.maxDays}
                  onChange={(event) => setForm((current) => ({ ...current, maxDays: event.target.value.replace(/[^\d]/g, "") }))}
                  onBlur={validateDays}
                  className="mt-2 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[13px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>

            {dayValidationMessage ? <p className="font-body text-[11px] text-[var(--color-danger)]">{dayValidationMessage}</p> : null}

            <label className="inline-flex items-center gap-2 font-body text-[12px] text-[var(--color-primary)]">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                className="h-3.5 w-3.5 accent-[var(--color-primary)]"
              />
              Is Active
            </label>

            <div>
              <button
                type="button"
                onClick={() => void saveForm()}
                disabled={isSaving}
                className="w-full rounded-[var(--border-radius)] bg-[var(--color-primary)] px-4 py-4 font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)] disabled:opacity-65"
              >
                {isSaving ? "Saving..." : form.id ? "Update Rate" : "Save Rate"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="mt-3 block w-full font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)] transition-colors hover:text-[var(--color-primary)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminShippingRatesPage;



