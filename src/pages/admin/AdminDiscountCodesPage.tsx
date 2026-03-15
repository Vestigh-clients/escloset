import { useEffect, useMemo, useState } from "react";
import {
  createAdminDiscountCode,
  deleteAdminDiscountCode,
  fetchAdminDiscountCodes,
  fetchCustomerByIdBasic,
  searchCustomersByEmail,
  updateAdminDiscountCode,
  type AdminDiscountCodeRow,
  type CustomerSearchResult,
} from "@/services/adminManagementService";
import { formatCurrency, formatDateShort } from "@/lib/adminFormatting";
import type { Database } from "@/integrations/supabase/types";

type DiscountType = Database["public"]["Enums"]["discount_type"];

type StatusFilter = "all" | "active" | "inactive";
type TypeFilter = "all" | DiscountType;

interface DiscountFormState {
  id: string | null;
  code: string;
  description: string;
  type: DiscountType;
  value: string;
  minimumOrderAmount: string;
  usageLimit: string;
  unlimited: boolean;
  selectedCustomer: CustomerSearchResult | null;
  customerSearchInput: string;
  expiresDate: string;
  noExpiry: boolean;
  isActive: boolean;
}

const defaultFormState: DiscountFormState = {
  id: null,
  code: "",
  description: "",
  type: "percentage",
  value: "",
  minimumOrderAmount: "",
  usageLimit: "",
  unlimited: true,
  selectedCustomer: null,
  customerSearchInput: "",
  expiresDate: "",
  noExpiry: true,
  isActive: true,
};

const isWithinNextSevenDays = (dateValue: string) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 7;
};

const isExpired = (dateValue: string) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
};

const percentage = (value: number, total: number) => {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
};

const codeForDisplay = (value: string) => value.toUpperCase();

const AdminDiscountCodesPage = () => {
  const [rows, setRows] = useState<AdminDiscountCodeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<DiscountFormState>(defaultFormState);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [customerSearchResults, setCustomerSearchResults] = useState<CustomerSearchResult[]>([]);
  const [isCustomerSearching, setIsCustomerSearching] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchAdminDiscountCodes();
      setRows(data);
    } catch {
      setRows([]);
      setLoadError("Unable to load discount codes.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchTerm(searchInput.trim().toLowerCase());
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchInput]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setCustomerSearchTerm(form.customerSearchInput.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [form.customerSearchInput]);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      if (!isFormOpen || customerSearchTerm.length < 2) {
        setCustomerSearchResults([]);
        return;
      }

      setIsCustomerSearching(true);
      try {
        const data = await searchCustomersByEmail(customerSearchTerm);
        if (!isMounted) return;
        setCustomerSearchResults(data);
      } catch {
        if (!isMounted) return;
        setCustomerSearchResults([]);
      } finally {
        if (isMounted) {
          setIsCustomerSearching(false);
        }
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [customerSearchTerm, isFormOpen]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const queryMatch =
        !searchTerm ||
        row.code.toLowerCase().includes(searchTerm) ||
        (row.description || "").toLowerCase().includes(searchTerm);
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "active" && Boolean(row.is_active)) ||
        (statusFilter === "inactive" && !Boolean(row.is_active));
      const typeMatch = typeFilter === "all" || row.type === typeFilter;
      return queryMatch && statusMatch && typeMatch;
    });
  }, [rows, searchTerm, statusFilter, typeFilter]);

  const hasActiveFilters = Boolean(searchTerm || statusFilter !== "all" || typeFilter !== "all");

  const clearFilters = () => {
    setSearchInput("");
    setSearchTerm("");
    setStatusFilter("all");
    setTypeFilter("all");
  };

  const openCreateForm = () => {
    setForm(defaultFormState);
    setDeleteConfirmId(null);
    setIsFormOpen(true);
  };

  const openEditForm = async (row: AdminDiscountCodeRow) => {
    let selectedCustomer: CustomerSearchResult | null = null;
    if (row.customer_id) {
      try {
        selectedCustomer = await fetchCustomerByIdBasic(row.customer_id);
      } catch {
        selectedCustomer = null;
      }
    }

    setForm({
      id: row.id,
      code: row.code,
      description: row.description || "",
      type: row.type,
      value: String(row.value),
      minimumOrderAmount:
        row.minimum_order_amount === null || row.minimum_order_amount === undefined ? "" : String(row.minimum_order_amount),
      usageLimit: row.usage_limit === null || row.usage_limit === undefined ? "" : String(row.usage_limit),
      unlimited: row.usage_limit === null,
      selectedCustomer,
      customerSearchInput: selectedCustomer ? selectedCustomer.email : "",
      expiresDate: row.expires_at ? row.expires_at.slice(0, 10) : "",
      noExpiry: !row.expires_at,
      isActive: row.is_active ?? true,
    });
    setDeleteConfirmId(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setForm(defaultFormState);
  };

  const generateCode = () => {
    const generated = Math.random().toString(36).substring(2, 10).toUpperCase();
    setForm((current) => ({ ...current, code: generated }));
  };

  const saveForm = async () => {
    const code = form.code.trim().toUpperCase();
    const value = Number(form.value);

    if (!code) {
      setMessage("Code is required.");
      return;
    }

    if (!Number.isFinite(value) || value <= 0) {
      setMessage("Value must be greater than 0.");
      return;
    }

    if (!form.unlimited) {
      const usageLimit = Number(form.usageLimit);
      if (!Number.isFinite(usageLimit) || usageLimit <= 0) {
        setMessage("Usage limit must be greater than 0 or set to unlimited.");
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        code,
        description: form.description.trim() || null,
        type: form.type,
        value,
        minimum_order_amount: form.minimumOrderAmount.trim() ? Number(form.minimumOrderAmount) : null,
        usage_limit: form.unlimited ? null : Number(form.usageLimit),
        customer_id: form.selectedCustomer?.id ?? null,
        expires_at: form.noExpiry || !form.expiresDate ? null : new Date(`${form.expiresDate}T23:59:59`).toISOString(),
        is_active: form.isActive,
      };

      if (form.id) {
        const previous = rows.find((entry) => entry.id === form.id);
        await updateAdminDiscountCode(form.id, payload, previous);
        setMessage("Discount code updated.");
      } else {
        await createAdminDiscountCode(payload);
        setMessage("Discount code created.");
      }

      await load();
      closeForm();
    } catch (error) {
      const messageText =
        error instanceof Error && error.message.toLowerCase().includes("duplicate")
          ? "A code with this value already exists."
          : "Unable to save discount code.";
      setMessage(messageText);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async (row: AdminDiscountCodeRow) => {
    await deleteAdminDiscountCode(row.id, row.code);
    setDeleteConfirmId(null);
    setMessage("Discount code deleted.");
    await load();
  };

  return (
    <div className="bg-[#F5F0E8] px-6 py-10 lg:px-[60px] lg:py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-[36px] italic text-[#1A1A1A]">Discount Codes</h1>
        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-[2px] bg-[#1A1A1A] px-7 py-3 font-body text-[11px] uppercase tracking-[0.1em] text-[#F5F0E8] transition-colors hover:bg-[#C4A882] hover:text-[#1A1A1A]"
        >
          Create Code
        </button>
      </div>

      {message ? <p className="mb-4 font-body text-[12px] text-[#C4A882]">{message}</p> : null}

      <div className="mb-5 flex flex-wrap items-end gap-4 border-b border-[#d4ccc2] pb-5">
        <div className="w-full max-w-[280px]">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by code or description..."
            className="w-full border-0 border-b border-[#d4ccc2] bg-transparent px-0 pb-2 font-body text-[12px] text-[#1A1A1A] outline-none placeholder:text-[#aaaaaa] focus:border-[#1A1A1A]"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[12px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
            className="border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[12px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
          >
            <option value="all">All</option>
            <option value="percentage">Percentage</option>
            <option value="fixed_amount">Fixed Amount</option>
          </select>
        </div>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="font-body text-[10px] uppercase tracking-[0.1em] text-[#aaaaaa] transition-colors hover:text-[#1A1A1A]"
          >
            Clear Filters
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1040px] w-full border-collapse">
          <thead>
            <tr className="border-b border-[#d4ccc2]">
              {["Code", "Type", "Value", "Min Order", "Usage", "Expires", "Status", "Actions"].map((heading) => (
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
                  Loading discount codes...
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={8} className="px-0 py-8 text-center font-body text-[12px] text-[#C0392B]">
                  {loadError}
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-0 py-8 text-center font-body text-[12px] text-[#aaaaaa]">
                  No discount codes found.
                </td>
              </tr>
            ) : (
              filteredRows.flatMap((row) => {
                const usedCount = row.usage_count ?? 0;
                const usageLimit = row.usage_limit;
                const hasLimit = usageLimit !== null && usageLimit !== undefined;
                const usagePercent = hasLimit ? percentage(usedCount, usageLimit) : 0;
                const expiringSoon = row.expires_at ? isWithinNextSevenDays(row.expires_at) : false;
                const expired = row.expires_at ? isExpired(row.expires_at) : false;

                return [
                  <tr key={row.id} className="border-b border-[#e4dbd1] hover:bg-[rgba(196,168,130,0.04)]">
                    <td className="px-2 py-4 pl-0 font-mono text-[12px] uppercase tracking-[0.1em] text-[#C4A882]">{codeForDisplay(row.code)}</td>
                    <td className="px-2 py-4">
                      <span className="inline-block rounded-[2px] border border-[#d4ccc2] px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] text-[#888888]">
                        {row.type === "percentage" ? "%" : "GH₵"}
                      </span>
                    </td>
                    <td className="px-2 py-4 font-body text-[13px] text-[#1A1A1A]">
                      {row.type === "percentage" ? `${row.value}%` : formatCurrency(row.value)}
                    </td>
                    <td className="px-2 py-4 font-body text-[11px] text-[#888888]">
                      {row.minimum_order_amount === null ? "—" : formatCurrency(row.minimum_order_amount)}
                    </td>
                    <td className="px-2 py-4">
                      <p className="font-body text-[11px] text-[#888888]">{hasLimit ? `${usedCount} / ${usageLimit}` : "Unlimited"}</p>
                      {hasLimit ? (
                        <div className="mt-1 h-[3px] w-[110px] bg-[#e8e2d9]">
                          <div className="h-full bg-[#C4A882]" style={{ width: `${usagePercent}%` }} />
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-4">
                      {!row.expires_at ? (
                        <span className="font-body text-[11px] text-[#aaaaaa]">No expiry</span>
                      ) : expired ? (
                        <span className="inline-block rounded-[2px] border border-[#C0392B] px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] text-[#C0392B]">
                          Expired
                        </span>
                      ) : (
                        <span className={`font-body text-[11px] ${expiringSoon ? "text-[#C0392B]" : "text-[#aaaaaa]"}`}>
                          {formatDateShort(row.expires_at)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-4">
                      <span
                        className={`inline-block rounded-[2px] border px-[10px] py-[4px] font-body text-[9px] uppercase tracking-[0.12em] ${
                          row.is_active ? "border-[#C4A882] text-[#C4A882]" : "border-[#d4ccc2] text-[#aaaaaa]"
                        }`}
                      >
                        {row.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-0 py-4">
                      {deleteConfirmId === row.id ? (
                        <div className="font-body text-[11px] text-[#C0392B]">
                          Delete {codeForDisplay(row.code)}? This cannot be undone.
                          <div className="mt-2 flex items-center gap-3 font-body text-[10px] uppercase tracking-[0.1em]">
                            <button type="button" onClick={() => void confirmDelete(row)} className="text-[#C0392B]">
                              Yes, Delete
                            </button>
                            <button type="button" onClick={() => setDeleteConfirmId(null)} className="text-[#888888]">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 font-body text-[10px] uppercase tracking-[0.1em]">
                          <button type="button" onClick={() => void openEditForm(row)} className="text-[#888888] transition-colors hover:text-[#1A1A1A]">
                            Edit
                          </button>
                          <button type="button" onClick={() => setDeleteConfirmId(row.id)} className="text-[#888888] transition-colors hover:text-[#C0392B]">
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>,
                ];
              })
            )}
          </tbody>
        </table>
      </div>

      {isFormOpen ? (
        <div className="mt-6 border border-[#d4ccc2] p-6">
          <p className="mb-4 font-body text-[10px] uppercase tracking-[0.2em] text-[#C4A882]">{form.id ? "Edit Code" : "Add Discount Code"}</p>

          <div className="grid gap-5">
            <div>
              <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">Code *</label>
              <div className="mt-2 flex items-end gap-4">
                <input
                  value={form.code}
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                  className="w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[14px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                />
                <button
                  type="button"
                  onClick={generateCode}
                  className="font-body text-[10px] uppercase tracking-[0.1em] text-[#C4A882] transition-colors hover:text-[#1A1A1A]"
                >
                  Generate
                </button>
              </div>
            </div>

            <div>
              <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">Description</label>
              <input
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Internal note about this code"
                className="mt-2 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none placeholder:text-[#aaaaaa] focus:border-[#1A1A1A]"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, type: "percentage" }))}
                className={`rounded-[2px] border px-6 py-6 text-left transition-colors duration-200 ${
                  form.type === "percentage" ? "border-[#1A1A1A]" : "border-[#d4ccc2]"
                }`}
                style={{ backgroundColor: form.type === "percentage" ? "#1A1A1A08" : "transparent" }}
              >
                <p className="font-display text-[18px] italic text-[#1A1A1A]">Percentage (%)</p>
              </button>

              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, type: "fixed_amount" }))}
                className={`rounded-[2px] border px-6 py-6 text-left transition-colors duration-200 ${
                  form.type === "fixed_amount" ? "border-[#1A1A1A]" : "border-[#d4ccc2]"
                }`}
                style={{ backgroundColor: form.type === "fixed_amount" ? "#1A1A1A08" : "transparent" }}
              >
                <p className="font-display text-[18px] italic text-[#1A1A1A]">Fixed Amount (GH₵)</p>
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">
                  {form.type === "percentage" ? "Discount %" : "Discount Amount (GH₵)"}
                </label>
                <input
                  inputMode="decimal"
                  value={form.value}
                  onChange={(event) => setForm((current) => ({ ...current, value: event.target.value.replace(/[^\d.]/g, "") }))}
                  className="mt-2 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">Minimum Order Amount</label>
                <input
                  inputMode="decimal"
                  value={form.minimumOrderAmount}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, minimumOrderAmount: event.target.value.replace(/[^\d.]/g, "") }))
                  }
                  className="mt-2 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A]"
                />
                <p className="mt-1 font-body text-[10px] text-[#aaaaaa]">
                  Minimum cart total to apply this code. Leave empty for no minimum.
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">Usage Limit</label>
                  <input
                    inputMode="numeric"
                    value={form.usageLimit}
                    disabled={form.unlimited}
                    onChange={(event) => setForm((current) => ({ ...current, usageLimit: event.target.value.replace(/[^\d]/g, "") }))}
                    className="mt-2 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A] disabled:opacity-50"
                  />
                </div>

                <label className="mt-6 inline-flex items-center gap-2 font-body text-[11px] text-[#888888]">
                  <input
                    type="checkbox"
                    checked={form.unlimited}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        unlimited: event.target.checked,
                        usageLimit: event.target.checked ? "" : current.usageLimit,
                      }))
                    }
                    className="h-3.5 w-3.5 accent-[#1A1A1A]"
                  />
                  Unlimited
                </label>
              </div>
            </div>

            <div className="relative">
              <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">Specific Customer</label>
              <input
                value={form.customerSearchInput}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    customerSearchInput: event.target.value,
                    selectedCustomer: null,
                  }))
                }
                placeholder="Type email to search"
                className="mt-2 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none placeholder:text-[#aaaaaa] focus:border-[#1A1A1A]"
              />

              {form.selectedCustomer ? (
                <p className="mt-2 font-body text-[11px] text-[#888888]">
                  Selected: {form.selectedCustomer.first_name} {form.selectedCustomer.last_name} ({form.selectedCustomer.email}){" "}
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        selectedCustomer: null,
                        customerSearchInput: "",
                      }))
                    }
                    className="uppercase text-[#aaaaaa] hover:text-[#1A1A1A]"
                  >
                    Clear
                  </button>
                </p>
              ) : null}

              {!form.selectedCustomer && customerSearchTerm.length >= 2 && customerSearchResults.length > 0 ? (
                <div className="absolute z-10 mt-2 max-h-[220px] w-full overflow-y-auto border border-[#d4ccc2] bg-[#F5F0E8]">
                  {customerSearchResults.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          selectedCustomer: customer,
                          customerSearchInput: customer.email,
                        }))
                      }
                      className="block w-full border-b border-[#e4dbd1] px-4 py-3 text-left hover:bg-[rgba(196,168,130,0.05)]"
                    >
                      <p className="font-body text-[12px] text-[#1A1A1A]">{`${customer.first_name} ${customer.last_name}`.trim()}</p>
                      <p className="font-body text-[11px] text-[#888888]">{customer.email}</p>
                    </button>
                  ))}
                </div>
              ) : null}

              {isCustomerSearching ? <p className="mt-2 font-body text-[11px] text-[#aaaaaa]">Searching...</p> : null}
              <p className="mt-1 font-body text-[10px] text-[#aaaaaa]">Leave empty to allow all customers to use this code.</p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa]">Expiry Date</label>
                <input
                  type="date"
                  value={form.expiresDate}
                  min={new Date().toISOString().slice(0, 10)}
                  disabled={form.noExpiry}
                  onChange={(event) => setForm((current) => ({ ...current, expiresDate: event.target.value }))}
                  className="mt-2 w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-2 font-body text-[13px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A] disabled:opacity-50"
                />
              </div>
              <label className="mt-6 inline-flex items-center gap-2 font-body text-[11px] text-[#888888]">
                <input
                  type="checkbox"
                  checked={form.noExpiry}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      noExpiry: event.target.checked,
                      expiresDate: event.target.checked ? "" : current.expiresDate,
                    }))
                  }
                  className="h-3.5 w-3.5 accent-[#1A1A1A]"
                />
                No expiry
              </label>
            </div>

            <label className="inline-flex items-center gap-2 font-body text-[12px] text-[#1A1A1A]">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                className="h-3.5 w-3.5 accent-[#1A1A1A]"
              />
              Is Active
            </label>

            <div>
              <button
                type="button"
                onClick={() => void saveForm()}
                disabled={isSaving}
                className="w-full rounded-[2px] bg-[#1A1A1A] px-4 py-4 font-body text-[11px] uppercase tracking-[0.1em] text-[#F5F0E8] transition-colors hover:bg-[#C4A882] hover:text-[#1A1A1A] disabled:opacity-65"
              >
                {isSaving ? "Saving..." : form.id ? "Update Code" : "Save Code"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="mt-3 block w-full font-body text-[11px] uppercase tracking-[0.1em] text-[#aaaaaa] transition-colors hover:text-[#1A1A1A]"
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

export default AdminDiscountCodesPage;

