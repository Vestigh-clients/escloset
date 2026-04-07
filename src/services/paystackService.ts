import { storeConfig } from "@/config/store.config";
import type { PaymentMode as StorePaymentMode, PaystackChargeBearer } from "@/config/store.config";
import { supabase } from "@/integrations/supabase/client";

export type PaymentMode = StorePaymentMode;

export type PaystackConfig = {
  mode: PaymentMode;
  publicKey: string;
  subaccountCode: string | null;
  platformFeePercent: number;
  bearer: PaystackChargeBearer;
  isSubaccountMode: boolean;
  isOwnAccountMode: boolean;
};

export type SubaccountData = {
  id: number;
  subaccount_code: string;
  business_name: string;
  description: string;
  primary_contact_email: string;
  percentage_charge: number;
  settlement_bank: string;
  account_number: string;
  active: boolean;
  currency: string;
};

export type OwnAccountData = {
  business_name: string | null;
  account_status: "active" | "inactive";
  integration_type: "live" | "test" | "unknown";
  currency: string | null;
};

const SUBACCOUNT_CODE_PATTERN = /^ACCT_[A-Za-z0-9]+$/;

const normalizeConfigValue = (value: string | null | undefined): string => value?.trim() ?? "";
const normalizeString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const normalizeNumber = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};
const normalizeBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "active";
  }
  return false;
};
const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const hasValidSubaccountCode = (value: string | null): value is string =>
  typeof value === "string" && SUBACCOUNT_CODE_PATTERN.test(value);

const inferIntegrationType = (publicKey: string): OwnAccountData["integration_type"] => {
  if (publicKey.startsWith("pk_live_")) {
    return "live";
  }

  if (publicKey.startsWith("pk_test_")) {
    return "test";
  }

  return "unknown";
};

const readFunctionErrorMessage = (value: unknown): string | null => {
  const record = asRecord(value);
  const errorMessage = record?.error;
  return typeof errorMessage === "string" && errorMessage.trim() ? errorMessage.trim() : null;
};

const normalizeSubaccountData = (value: unknown): SubaccountData | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const subaccountCode = normalizeString(record.subaccount_code);
  if (!subaccountCode) {
    return null;
  }

  return {
    id: normalizeNumber(record.id),
    subaccount_code: subaccountCode,
    business_name: normalizeString(record.business_name),
    description: normalizeString(record.description),
    primary_contact_email: normalizeString(record.primary_contact_email),
    percentage_charge: normalizeNumber(record.percentage_charge),
    settlement_bank: normalizeString(record.settlement_bank),
    account_number: normalizeString(record.account_number),
    active: normalizeBoolean(record.active),
    currency: normalizeString(record.currency),
  };
};

const normalizeOwnAccountData = (value: unknown, publicKey: string): OwnAccountData | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const businessName = normalizeString(record.business_name) || null;
  const status = normalizeString(record.account_status).toLowerCase();

  return {
    business_name: businessName,
    account_status: status === "inactive" ? "inactive" : "active",
    integration_type: inferIntegrationType(publicKey),
    currency: normalizeString(record.currency) || null,
  };
};

export function getPaystackConfig(): PaystackConfig {
  const { mode, paystack } = storeConfig.payments;
  const publicKey = normalizeConfigValue(paystack.publicKey);
  const subaccountCode =
    mode === "subaccount" ? normalizeConfigValue(paystack.subaccount.code) || null : null;

  return {
    mode,
    publicKey,
    subaccountCode,
    platformFeePercent: mode === "subaccount" ? paystack.subaccount.platformFeePercent : 0,
    bearer: mode === "subaccount" ? paystack.subaccount.bearer : "account",
    isSubaccountMode: mode === "subaccount",
    isOwnAccountMode: mode === "own_account",
  };
}

export async function fetchSubaccountData(): Promise<SubaccountData | null> {
  const config = getPaystackConfig();

  if (!config.isSubaccountMode || !hasValidSubaccountCode(config.subaccountCode)) {
    return null;
  }

  const { data, error } = await supabase.functions.invoke("get_subaccount_details", {
    body: { subaccount_code: config.subaccountCode },
  });

  if (error) {
    throw error;
  }

  const functionError = readFunctionErrorMessage(data);
  if (functionError) {
    throw new Error(functionError);
  }

  return normalizeSubaccountData(data);
}

export async function fetchOwnAccountData(): Promise<OwnAccountData | null> {
  const config = getPaystackConfig();

  if (!config.isOwnAccountMode || !config.publicKey) {
    return null;
  }

  const { data, error } = await supabase.functions.invoke("get_own_account_details");

  if (error) {
    throw error;
  }

  const functionError = readFunctionErrorMessage(data);
  if (functionError) {
    throw new Error(functionError);
  }

  return normalizeOwnAccountData(data, config.publicKey);
}

export function isPaymentConfigured(): boolean {
  const config = getPaystackConfig();

  if (!config.publicKey) {
    return false;
  }

  if (config.isSubaccountMode && !hasValidSubaccountCode(config.subaccountCode)) {
    return false;
  }

  return true;
}

// Always pass subtotal only - never pass total including shipping.
export function getTransactionCharge(subtotalGHS: number): number {
  const config = getPaystackConfig();

  if (!config.isSubaccountMode || !Number.isFinite(subtotalGHS) || subtotalGHS <= 0) {
    return 0;
  }

  return Math.round((subtotalGHS * config.platformFeePercent) / 100) * 100;
}

export function canConfigurePaymentMethods(): boolean {
  const config = getPaystackConfig();
  if (config.isOwnAccountMode) return true;
  if (config.isSubaccountMode && config.platformFeePercent === 0) return true;
  return false;
}

export function getPaystackMetadata(): { store_id: string } {
  const envStoreId = import.meta.env.VITE_STORE_ID;
  if (typeof envStoreId === "string" && envStoreId.trim()) {
    return { store_id: envStoreId.trim() };
  }
  const store_id = window.location.hostname.split(".")[0];
  return { store_id };
}
