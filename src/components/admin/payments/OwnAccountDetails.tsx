import type { ReactNode } from "react";
import type { OwnAccountData } from "@/services/paystackService";

const DetailItem = ({ label, value }: { label: string; value: ReactNode }) => (
  <div>
    <dt className="font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted-soft)]">{label}</dt>
    <dd className="mt-2 font-body text-[13px] text-[var(--color-primary)]">{value}</dd>
  </div>
);

const integrationBadgeClass: Record<OwnAccountData["integration_type"], string> = {
  live: "border border-[var(--color-success)] text-[var(--color-success)]",
  test: "border border-[var(--color-accent)] text-[var(--color-accent)]",
  unknown: "border border-[var(--color-border)] text-[var(--color-muted)]",
};

const statusBadgeClass = {
  active: "border border-[var(--color-success)] text-[var(--color-success)]",
  inactive: "border border-[var(--color-danger)] text-[var(--color-danger)]",
};

type OwnAccountDetailsProps = {
  data: OwnAccountData;
  publicKeyPreview: string;
  currencyFallback: string;
};

const OwnAccountDetails = ({ data, publicKeyPreview, currencyFallback }: OwnAccountDetailsProps) => {
  const integrationType = data.integration_type;
  const accountStatus = data.account_status;

  return (
    <>
      <dl className="grid gap-x-10 gap-y-6 md:grid-cols-2">
        <DetailItem label="Business name" value={data.business_name || "Unavailable"} />
        <DetailItem label="Paystack public key" value={<span className="font-mono text-[12px]">{publicKeyPreview}</span>} />
        <DetailItem
          label="Integration type"
          value={
            <span className={`inline-block rounded-[var(--border-radius)] px-3 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${integrationBadgeClass[integrationType]}`}>
              {integrationType === "unknown" ? "Unknown" : integrationType}
            </span>
          }
        />
        <DetailItem label="Currency" value={data.currency || currencyFallback} />
        <DetailItem
          label="Account status"
          value={
            <span className={`inline-block rounded-[var(--border-radius)] px-3 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${statusBadgeClass[accountStatus]}`}>
              {accountStatus}
            </span>
          }
        />
      </dl>

      <div className="mt-6 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.05)] px-4 py-4">
        <p className="font-body text-[12px] leading-6 text-[var(--color-muted)]">
          You are using your own Paystack account. Vestigh does not have access to your account or your funds.
        </p>
      </div>
    </>
  );
};

export default OwnAccountDetails;
