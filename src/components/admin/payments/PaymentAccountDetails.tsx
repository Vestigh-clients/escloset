import { useEffect, useState } from "react";
import { storeConfig } from "@/config/store.config";
import {
  fetchOwnAccountData,
  fetchSubaccountData,
  getPaystackConfig,
  type OwnAccountData,
  type SubaccountData,
} from "@/services/paystackService";
import OwnAccountDetails from "@/components/admin/payments/OwnAccountDetails";
import SubaccountDetails from "@/components/admin/payments/SubaccountDetails";

const keyMask = "\u2022".repeat(8);

const maskPublicKey = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Not set";
  }

  return `${trimmed.slice(0, 8)}${keyMask}`;
};

const LoadingState = ({ items }: { items: number }) => (
  <>
    <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
      {Array.from({ length: items }).map((_, index) => (
        <div key={`payment-detail-skeleton-${index}`}>
          <div className="h-3 w-28 animate-pulse bg-[var(--color-surface-alt)]" />
          <div className="mt-3 h-4 w-full animate-pulse bg-[var(--color-surface-alt)]" />
        </div>
      ))}
    </div>
    <div className="mt-6 h-20 animate-pulse rounded-[var(--border-radius)] bg-[var(--color-surface-alt)]" />
  </>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.03)] px-4 py-5">
    <p className="font-body text-[12px] text-[var(--color-muted)]">{message}</p>
  </div>
);

const PaymentAccountDetails = () => {
  const config = getPaystackConfig();
  const mode = config.mode;
  const publicKey = config.publicKey;
  const subaccountCode = config.subaccountCode;

  const [subaccountData, setSubaccountData] = useState<SubaccountData | null>(null);
  const [ownAccountData, setOwnAccountData] = useState<OwnAccountData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadAccountDetails = async () => {
      setIsLoading(true);
      setLoadError(null);
      setSubaccountData(null);
      setOwnAccountData(null);

      try {
        if (mode === "subaccount") {
          const data = await fetchSubaccountData();
          if (!isMounted) return;
          setSubaccountData(data);
          return;
        }

        const data = await fetchOwnAccountData();
        if (!isMounted) return;
        setOwnAccountData(data);
      } catch (error) {
        if (!isMounted) return;
        console.error("[payments] Failed to load Paystack account details:", error);
        setLoadError("Could not load payment account details.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadAccountDetails();

    return () => {
      isMounted = false;
    };
  }, [mode, publicKey, retryCount, subaccountCode]);

  return (
    <section className="rounded-[var(--border-radius)] border border-[var(--color-border)] bg-transparent px-6 py-7 lg:px-10">
      <div className="mb-6">
        <p className="font-body text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)]">Account Details</p>
      </div>

      {isLoading ? <LoadingState items={mode === "subaccount" ? 8 : 5} /> : null}

      {!isLoading && loadError ? (
        <div className="rounded-[var(--border-radius)] border border-[rgba(var(--color-danger-rgb),0.3)] bg-[rgba(var(--color-danger-rgb),0.04)] px-4 py-5">
          <p className="font-body text-[12px] text-[var(--color-primary)]">Could not load payment account details.</p>
          <p className="mt-1 font-body text-[12px] text-[var(--color-muted)]">
            Check your Paystack configuration in your environment variables.
          </p>
          <button
            type="button"
            onClick={() => setRetryCount((current) => current + 1)}
            className="mt-4 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-transparent px-4 py-2 font-body text-[10px] uppercase tracking-[0.1em] text-[var(--color-primary)] transition-colors hover:border-[var(--color-primary)]"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!isLoading && !loadError && mode === "subaccount" && subaccountData ? (
        <SubaccountDetails data={subaccountData} platformFeePercent={config.platformFeePercent} />
      ) : null}

      {!isLoading && !loadError && mode === "subaccount" && !subaccountData ? (
        <EmptyState message="No subaccount details are available for the current configuration." />
      ) : null}

      {!isLoading && !loadError && mode === "own_account" && ownAccountData ? (
        <OwnAccountDetails
          data={ownAccountData}
          publicKeyPreview={maskPublicKey(publicKey)}
          currencyFallback={storeConfig.currency.code}
        />
      ) : null}

      {!isLoading && !loadError && mode === "own_account" && !ownAccountData ? (
        <EmptyState message="No Paystack account details are available for the current configuration." />
      ) : null}
    </section>
  );
};

export default PaymentAccountDetails;
