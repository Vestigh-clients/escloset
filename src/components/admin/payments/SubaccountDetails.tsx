import type { ReactNode } from "react";
import type { SubaccountData } from "@/services/paystackService";

const maskAccountNumber = (value: string) => {
  const normalized = value.replace(/\s+/g, "");
  if (normalized.length <= 4) {
    return "****";
  }

  return `****${normalized.slice(-4)}`;
};

const DetailItem = ({ label, value }: { label: string; value: ReactNode }) => (
  <div>
    <dt className="font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted-soft)]">{label}</dt>
    <dd className="mt-2 font-body text-[13px] text-[var(--color-primary)]">{value}</dd>
  </div>
);

const statusBadgeClass = {
  active: "border border-[var(--color-success)] text-[var(--color-success)]",
  inactive: "border border-[var(--color-danger)] text-[var(--color-danger)]",
};

type SubaccountDetailsProps = {
  data: SubaccountData;
  platformFeePercent: number;
};

const SubaccountDetails = ({ data, platformFeePercent }: SubaccountDetailsProps) => {
  const status = data.active ? "active" : "inactive";

  return (
    <>
      <dl className="grid gap-x-10 gap-y-6 md:grid-cols-2">
        <DetailItem label="Business name" value={data.business_name || "-"} />
        <DetailItem label="Subaccount code" value={<span className="font-mono text-[12px]">{data.subaccount_code || "-"}</span>} />
        <DetailItem label="Settlement bank" value={data.settlement_bank || "-"} />
        <DetailItem label="Account number" value={<span className="font-mono text-[12px]">{maskAccountNumber(data.account_number || "")}</span>} />
        <DetailItem label="Percentage charge" value={`${platformFeePercent}% (Vestigh platform fee)`} />
        <DetailItem label="Currency" value={data.currency || "-"} />
        <DetailItem
          label="Status"
          value={
            <span className={`inline-block rounded-[var(--border-radius)] px-3 py-1 font-body text-[9px] uppercase tracking-[0.12em] ${statusBadgeClass[status]}`}>
              {status}
            </span>
          }
        />
        <DetailItem label="Contact email" value={data.primary_contact_email || "-"} />
      </dl>

      <div className="mt-6 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.05)] px-4 py-4">
        <p className="font-body text-[12px] leading-6 text-[var(--color-muted)]">
          Your subaccount was created and is managed by Vestigh. To update your settlement bank or account details, contact us on WhatsApp.
        </p>
      </div>
    </>
  );
};

export default SubaccountDetails;
