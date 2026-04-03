import { useEffect, useState } from "react";
import { canConfigurePaymentMethods } from "@/services/paystackService";
import { getPaymentSettings, updatePaymentSettings, type PaymentSettings } from "@/services/paymentSettingsService";

const PaymentMethodsConfig = () => {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [initialSettings, setInitialSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canConfigurePaymentMethods()) return;

    let isMounted = true;
    const load = async () => {
      try {
        const data = await getPaymentSettings();
        if (isMounted) {
          setSettings(data);
          setInitialSettings(data);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) setError("Failed to load payment settings.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  if (!canConfigurePaymentMethods()) {
    return null;
  }

  if (loading) {
    return (
      <div className="rounded-[var(--border-radius)] border border-[var(--color-border)] p-6">
        <p className="font-body text-[12px] text-[var(--color-muted-soft)]">Loading settings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[var(--border-radius)] border border-[var(--color-border)] p-6">
        <p className="font-body text-[12px] text-[var(--color-danger)]">{error}</p>
      </div>
    );
  }

  if (!settings) return null;

  const hasChanges =
    initialSettings &&
    (settings.online_payment_enabled !== initialSettings.online_payment_enabled ||
      settings.cash_on_delivery_enabled !== initialSettings.cash_on_delivery_enabled);

  const handleOnlineChange = (checked: boolean) => {
    if (!checked && !settings.cash_on_delivery_enabled) {
      setError("At least one payment method must be enabled.");
      return;
    }
    setError(null);
    setSettings((prev) => (prev ? { ...prev, online_payment_enabled: checked } : null));
  };

  const handleCashChange = (checked: boolean) => {
    if (!checked && !settings.online_payment_enabled) {
      setError("At least one payment method must be enabled.");
      return;
    }
    setError(null);
    setSettings((prev) => (prev ? { ...prev, cash_on_delivery_enabled: checked } : null));
  };

  const onSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await updatePaymentSettings({
        online_payment_enabled: settings.online_payment_enabled,
        cash_on_delivery_enabled: settings.cash_on_delivery_enabled,
      });
      setInitialSettings(settings);
      setMessage("Payment methods updated.");
    } catch (err) {
      console.error(err);
      setError("Unable to save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-[var(--border-radius)] border border-[var(--color-border)] bg-transparent px-6 py-7 lg:px-10">
      <h2 className="font-display text-[22px] italic text-[var(--color-primary)]">PAYMENT METHODS</h2>
      <p className="mt-1 font-body text-[11px] text-[var(--color-muted-soft)]">
        Choose which payment methods are available to your customers at checkout.
      </p>
      
      <div className="my-5 border-b border-[var(--color-border)]" />

      <div className="grid gap-6">
        <div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.online_payment_enabled}
              onChange={(e) => handleOnlineChange(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-[var(--color-primary)]"
            />
            <div>
              <p className="font-body text-[12px] text-[var(--color-primary)]">Online payment</p>
              <p className="font-body text-[11px] text-[var(--color-muted-soft)]">Customers pay with card or mobile money via Paystack</p>
            </div>
          </label>
        </div>

        <div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.cash_on_delivery_enabled}
              onChange={(e) => handleCashChange(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-[var(--color-primary)]"
            />
            <div>
              <p className="font-body text-[12px] text-[var(--color-primary)]">Cash on delivery</p>
              <p className="font-body text-[11px] text-[var(--color-muted-soft)]">Customers pay cash when their order is delivered</p>
            </div>
          </label>
        </div>
      </div>

      {error ? <p className="mt-4 font-body text-[11px] text-[var(--color-danger)]">{error}</p> : null}
      
      <div className="mt-6">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={!hasChanges || saving}
          className="rounded-[var(--border-radius)] bg-[var(--color-primary)] px-8 py-3 font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
        {message ? <p className="mt-3 font-body text-[11px] text-[var(--color-accent)]">{message}</p> : null}
      </div>
    </section>
  );
};

export default PaymentMethodsConfig;
