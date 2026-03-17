import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { storeKeyPrefix } from "@/config/store.config";
import { clearTestOrders, fetchSiteSettings, saveSiteSetting, buildFullDataExportZip, type SiteSettingRow } from "@/services/adminManagementService";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateShort } from "@/lib/adminFormatting";
import { getGhanaianPhoneError } from "@/lib/phoneValidation";

type SectionKey = "general" | "orders" | "notifications";

const generalKeys = ["site_name", "site_tagline", "support_email", "support_phone", "whatsapp_number"] as const;
const orderKeys = ["free_shipping_threshold", "order_number_prefix", "default_currency"] as const;
const notificationKeys = ["new_order_email", "low_stock_email", "weekly_summary_email"] as const;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (value: string) => {
  if (!value.trim()) return undefined;
  return emailRegex.test(value.trim()) ? undefined : "Enter a valid email address";
};

const sectionLabels: Record<SectionKey, string> = {
  general: "General",
  orders: "Orders",
  notifications: "Notifications",
};

const getSectionKeys = (section: SectionKey): string[] => {
  if (section === "general") return [...generalKeys];
  if (section === "orders") return [...orderKeys];
  return [...notificationKeys];
};

const AdminSettingsPage = () => {
  const { role, user } = useAuth();

  const [settingsMap, setSettingsMap] = useState<Record<string, string>>({});
  const [metaMap, setMetaMap] = useState<Record<string, SiteSettingRow>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sectionSaving, setSectionSaving] = useState<Record<SectionKey, boolean>>({
    general: false,
    orders: false,
    notifications: false,
  });
  const [sectionSaved, setSectionSaved] = useState<Record<SectionKey, boolean>>({
    general: false,
    orders: false,
    notifications: false,
  });
  const [message, setMessage] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [confirmValue, setConfirmValue] = useState("");
  const [isClearingOrders, setIsClearingOrders] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchSiteSettings();
      const values = data.reduce<Record<string, string>>((acc, setting) => {
        acc[setting.key] = setting.value ?? "";
        return acc;
      }, {});
      const metadata = data.reduce<Record<string, SiteSettingRow>>((acc, setting) => {
        acc[setting.key] = setting;
        return acc;
      }, {});

      setSettingsMap(values);
      setMetaMap(metadata);
    } catch {
      setLoadError("Unable to load site settings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (role === "super_admin") {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    const activeSection = (Object.keys(sectionSaved) as SectionKey[]).find((section) => sectionSaved[section]);
    if (!activeSection) return;

    const timeout = window.setTimeout(() => {
      setSectionSaved({
        general: false,
        orders: false,
        notifications: false,
      });
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [sectionSaved]);

  const setSetting = (key: string, value: string) => {
    setSettingsMap((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const setFieldError = (key: string, error?: string) => {
    setFieldErrors((current) => {
      if (!error) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return {
        ...current,
        [key]: error,
      };
    });
  };

  const validateField = (key: string, value: string) => {
    if (key.includes("email")) {
      setFieldError(key, validateEmail(value));
      return;
    }

    if (key === "support_phone" || key === "whatsapp_number") {
      setFieldError(key, getGhanaianPhoneError(value));
      return;
    }

    if (key === "order_number_prefix") {
      const upper = value.toUpperCase();
      if (upper.length > 5) {
        setFieldError(key, "Order number prefix cannot exceed 5 characters");
      } else {
        setFieldError(key, undefined);
      }
    }
  };

  const saveSection = async (section: SectionKey) => {
    if (!user?.id) {
      setMessage("Session missing. Reload and try again.");
      return;
    }

    const keys = getSectionKeys(section);
    let hasError = false;
    keys.forEach((key) => {
      const value = settingsMap[key] ?? "";
      validateField(key, value);
      if (
        (key.includes("email") && Boolean(validateEmail(value))) ||
        ((key === "support_phone" || key === "whatsapp_number") && Boolean(getGhanaianPhoneError(value))) ||
        (key === "order_number_prefix" && value.length > 5)
      ) {
        hasError = true;
      }
    });

    if (hasError) {
      setMessage("Resolve validation errors before saving.");
      return;
    }

    setSectionSaving((current) => ({
      ...current,
      [section]: true,
    }));

    try {
      for (const key of keys) {
        const value = settingsMap[key] ?? "";
        const oldValue = metaMap[key]?.value ?? null;
        await saveSiteSetting({
          key,
          value,
          oldValue,
          sectionName: sectionLabels[section],
          currentAdminId: user.id,
        });
      }

      setSectionSaved((current) => ({
        ...current,
        [section]: true,
      }));
      setMessage("Settings saved.");
      await load();
    } catch {
      setMessage("Unable to save settings.");
    } finally {
      setSectionSaving((current) => ({
        ...current,
        [section]: false,
      }));
    }
  };

  const exportAllData = async () => {
    setIsExporting(true);
    try {
      const zipBlob = await buildFullDataExportZip();
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      const dateLabel = new Date().toISOString().split("T")[0];
      link.href = url;
      link.setAttribute("download", `${storeKeyPrefix}-export-${dateLabel}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setMessage("Unable to export data.");
    } finally {
      setIsExporting(false);
    }
  };

  const clearOrders = async () => {
    setIsClearingOrders(true);
    try {
      const deletedCount = await clearTestOrders();
      setMessage(`Deleted ${deletedCount} test order(s).`);
      setConfirmValue("");
      setShowConfirmClear(false);
    } catch {
      setMessage("Unable to clear test orders.");
    } finally {
      setIsClearingOrders(false);
    }
  };

  const getSectionMeta = (keys: string[]) => {
    const latest = keys
      .map((key) => metaMap[key])
      .filter((entry): entry is SiteSettingRow => Boolean(entry?.updated_at))
      .sort((a, b) => new Date(b.updated_at || "").getTime() - new Date(a.updated_at || "").getTime())[0];

    if (!latest) return null;

    const adminName = latest.updated_by_customer
      ? `${latest.updated_by_customer.first_name} ${latest.updated_by_customer.last_name}`.trim() || "Admin"
      : "Admin";

    return {
      date: latest.updated_at ? formatDateShort(latest.updated_at) : "-",
      adminName,
    };
  };

  const generalMeta = useMemo(() => getSectionMeta([...generalKeys]), [metaMap]);
  const orderMeta = useMemo(() => getSectionMeta([...orderKeys]), [metaMap]);
  const notificationMeta = useMemo(() => getSectionMeta([...notificationKeys]), [metaMap]);

  if (role !== "super_admin") {
    return <Navigate to="/admin" replace />;
  }

  if (isLoading) {
    return <div className="admin-page font-body text-[12px] text-[var(--color-muted)]">Loading settings...</div>;
  }

  return (
    <div className="admin-page">
      <h1 className="admin-page-title mb-8 font-display text-[36px] italic text-[var(--color-primary)]">Site Settings</h1>

      {loadError ? <p className="mb-4 font-body text-[12px] text-[var(--color-danger)]">{loadError}</p> : null}
      {message ? <p className="mb-4 font-body text-[12px] text-[var(--color-accent)]">{message}</p> : null}

      <section className="settings-section-card mb-6 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-transparent px-6 py-7 lg:px-10">
        <h2 className="admin-section-title font-display text-[22px] italic text-[var(--color-primary)]">General</h2>
        <p className="mt-1 font-body text-[11px] text-[var(--color-muted-soft)]">Basic store information</p>
        <div className="my-5 border-b border-[var(--color-border)]" />

        <div className="grid gap-5">
          <Field
            label="Store Name"
            value={settingsMap.site_name || ""}
            onChange={(value) => setSetting("site_name", value)}
          />
          <Field
            label="Store Tagline"
            value={settingsMap.site_tagline || ""}
            onChange={(value) => setSetting("site_tagline", value)}
          />
          <Field
            label="Support Email"
            value={settingsMap.support_email || ""}
            error={fieldErrors.support_email}
            onBlur={(value) => validateField("support_email", value)}
            onChange={(value) => setSetting("support_email", value)}
          />
          <Field
            label="Support Phone"
            value={settingsMap.support_phone || ""}
            error={fieldErrors.support_phone}
            onBlur={(value) => validateField("support_phone", value)}
            onChange={(value) => setSetting("support_phone", value)}
          />
          <Field
            label="WhatsApp Number"
            value={settingsMap.whatsapp_number || ""}
            helper="Used for customer support contact link in footer"
            error={fieldErrors.whatsapp_number}
            onBlur={(value) => validateField("whatsapp_number", value)}
            onChange={(value) => setSetting("whatsapp_number", value)}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="font-body text-[10px] text-[var(--color-muted-soft)]">
            {generalMeta ? `Last updated ${generalMeta.date} by ${generalMeta.adminName}` : "Last updated -"}
          </p>
          <button
            type="button"
            onClick={() => void saveSection("general")}
            disabled={sectionSaving.general}
            className="settings-save-button rounded-[var(--border-radius)] bg-[var(--color-primary)] px-8 py-3 font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-65"
          >
            {sectionSaving.general ? "Saving..." : "Save General"}
          </button>
        </div>
        {sectionSaved.general ? <p className="mt-2 font-body text-[11px] text-[var(--color-accent)]">Settings saved.</p> : null}
      </section>

      <section className="settings-section-card mb-6 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-transparent px-6 py-7 lg:px-10">
        <h2 className="admin-section-title font-display text-[22px] italic text-[var(--color-primary)]">Orders</h2>
        <p className="mt-1 font-body text-[11px] text-[var(--color-muted-soft)]">Order processing settings</p>
        <div className="my-5 border-b border-[var(--color-border)]" />

        <div className="grid gap-5">
          <Field
            label="Free Shipping Threshold"
            value={settingsMap.free_shipping_threshold || ""}
            helper="Orders above this amount qualify for free shipping. Set to 0 to disable free shipping."
            inputMode="decimal"
            onChange={(value) => setSetting("free_shipping_threshold", value.replace(/[^\d.]/g, ""))}
          />
          <Field
            label="Order Number Prefix"
            value={settingsMap.order_number_prefix || "LUX"}
            helper="Prefix used in order numbers e.g. LUX-2026-00001"
            error={fieldErrors.order_number_prefix}
            onBlur={(value) => validateField("order_number_prefix", value)}
            onChange={(value) => setSetting("order_number_prefix", value.toUpperCase().slice(0, 5))}
          />
          <div>
            <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">Default Currency</label>
            <select
              value={settingsMap.default_currency || "GHS"}
              onChange={(event) => setSetting("default_currency", event.target.value)}
              className="mt-2 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[14px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
            >
              <option value="GHS">GHS</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="font-body text-[10px] text-[var(--color-muted-soft)]">
            {orderMeta ? `Last updated ${orderMeta.date} by ${orderMeta.adminName}` : "Last updated -"}
          </p>
          <button
            type="button"
            onClick={() => void saveSection("orders")}
            disabled={sectionSaving.orders}
            className="settings-save-button rounded-[var(--border-radius)] bg-[var(--color-primary)] px-8 py-3 font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-65"
          >
            {sectionSaving.orders ? "Saving..." : "Save Orders"}
          </button>
        </div>
        {sectionSaved.orders ? <p className="mt-2 font-body text-[11px] text-[var(--color-accent)]">Settings saved.</p> : null}
      </section>

      <section className="settings-section-card mb-6 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-transparent px-6 py-7 lg:px-10">
        <h2 className="admin-section-title font-display text-[22px] italic text-[var(--color-primary)]">Notifications</h2>
        <p className="mt-1 font-body text-[11px] text-[var(--color-muted-soft)]">Email addresses for admin alerts and summaries</p>
        <div className="my-5 border-b border-[var(--color-border)]" />

        <div className="grid gap-5">
          <Field
            label="New Order Email"
            value={settingsMap.new_order_email || ""}
            error={fieldErrors.new_order_email}
            helper="Receives an email for every new order placed"
            onBlur={(value) => validateField("new_order_email", value)}
            onChange={(value) => setSetting("new_order_email", value)}
          />
          <Field
            label="Low Stock Alert Email"
            value={settingsMap.low_stock_email || ""}
            error={fieldErrors.low_stock_email}
            helper="Receives alerts when products run low on stock"
            onBlur={(value) => validateField("low_stock_email", value)}
            onChange={(value) => setSetting("low_stock_email", value)}
          />
          <Field
            label="Weekly Summary Email"
            value={settingsMap.weekly_summary_email || ""}
            error={fieldErrors.weekly_summary_email}
            helper="Receives the Monday weekly sales summary"
            onBlur={(value) => validateField("weekly_summary_email", value)}
            onChange={(value) => setSetting("weekly_summary_email", value)}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="font-body text-[10px] text-[var(--color-muted-soft)]">
            {notificationMeta ? `Last updated ${notificationMeta.date} by ${notificationMeta.adminName}` : "Last updated -"}
          </p>
          <button
            type="button"
            onClick={() => void saveSection("notifications")}
            disabled={sectionSaving.notifications}
            className="settings-save-button rounded-[var(--border-radius)] bg-[var(--color-primary)] px-8 py-3 font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-65"
          >
            {sectionSaving.notifications ? "Saving..." : "Save Notifications"}
          </button>
        </div>
        {sectionSaved.notifications ? <p className="mt-2 font-body text-[11px] text-[var(--color-accent)]">Settings saved.</p> : null}
      </section>

      <section className="settings-section-card mb-6 rounded-[var(--border-radius)] border border-[rgba(var(--color-danger-rgb),0.3)] bg-transparent px-6 py-7 lg:px-10">
        <h2 className="admin-section-title font-display text-[22px] italic text-[var(--color-primary)]">Danger Zone</h2>
        <p className="mt-1 font-body text-[11px] text-[var(--color-muted-soft)]">Irreversible actions - proceed with caution</p>
        <div className="my-5 border-b border-[var(--color-border)]" />

        <button
          type="button"
          onClick={() => void exportAllData()}
          disabled={isExporting}
          className="rounded-[var(--border-radius)] border border-[var(--color-border)] bg-transparent px-7 py-3 font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-primary)] transition-colors hover:border-[var(--color-primary)] disabled:opacity-65"
        >
          {isExporting ? "Exporting..." : "Export All Data"}
        </button>

        <div className="my-6 border-b border-[var(--color-border)]" />

        {!showConfirmClear ? (
          <button
            type="button"
            onClick={() => setShowConfirmClear(true)}
            className="rounded-[var(--border-radius)] border border-[rgba(var(--color-danger-rgb),0.3)] bg-transparent px-7 py-3 font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)] hover:text-white"
          >
            Clear All Test Orders
          </button>
        ) : (
          <div className="w-full max-w-[560px]">
            <p className="mb-3 font-body text-[11px] text-[var(--color-muted)]">
              Type CONFIRM to delete all orders where customer email contains &apos;test&apos; or order total is GH₵0.00
            </p>
            <input
              value={confirmValue}
              onChange={(event) => setConfirmValue(event.target.value)}
              className="w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[14px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
            />
            <button
              type="button"
              onClick={() => void clearOrders()}
              disabled={confirmValue !== "CONFIRM" || isClearingOrders}
              className="mt-4 rounded-[var(--border-radius)] bg-[var(--color-danger)] px-6 py-3 font-body text-[11px] uppercase tracking-[0.1em] text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isClearingOrders ? "Deleting..." : "Delete Test Orders"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

const Field = ({
  label,
  value,
  onChange,
  onBlur,
  helper,
  error,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  helper?: string;
  error?: string;
  inputMode?: "text" | "decimal" | "numeric" | "email";
}) => (
  <div>
    <label className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted-soft)]">{label}</label>
    <input
      value={value}
      inputMode={inputMode}
      onBlur={(event) => onBlur?.(event.target.value)}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 font-body text-[14px] text-[var(--color-primary)] outline-none focus:border-[var(--color-primary)]"
    />
    {helper ? <p className="mt-1 font-body text-[10px] text-[var(--color-muted-soft)]">{helper}</p> : null}
    {error ? <p className="mt-1 font-body text-[11px] text-[var(--color-danger)]">{error}</p> : null}
  </div>
);

export default AdminSettingsPage;



