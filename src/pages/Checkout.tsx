import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PaystackPop from "@paystack/inline-js";
import { Banknote, Check, ChevronDown, CreditCard, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCart, type CartItem } from "@/contexts/CartContext";
import { formatPrice } from "@/lib/price";
import { GHANAIAN_PHONE_HELPER_TEXT, validateGhanaianPhone } from "@/lib/phoneValidation";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  fetchActiveShippingRates,
  fetchCheckoutSessionData,
  fetchDiscountCode,
  getOrderErrorMessage,
  type ShippingRateRow,
  OrderSubmissionError,
  resolveShippingRateForState,
  submitOrderRpc,
  triggerOrderConfirmationEmail,
  triggerNewOrderAdminNotification,
} from "@/services/orderService";
import { getPaystackConfig, getPaystackMetadata, getTransactionCharge, isPaymentConfigured } from "@/services/paystackService";
import { getPaymentSettings, type PaymentSettings } from "@/services/paymentSettingsService";
import { storeConfig, storeKeyPrefix } from "@/config/store.config";
import { REDIRECT_AFTER_LOGIN_KEY } from "@/services/authService";
import { buildAuthModalSearch, buildPathWithSearch } from "@/lib/authModal";

type CheckoutStep = "contact" | "delivery" | "payment" | "review";

interface ContactFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  marketingOptIn: boolean;
}

type ContactField = Exclude<keyof ContactFormValues, "marketingOptIn">;

interface DeliveryFormValues {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  deliveryInstructions: string;
  saveForFuture: boolean;
}

type DeliveryField = "addressLine1" | "city" | "state" | "country" | "deliveryInstructions";

interface ReviewFormValues {
  orderNotes: string;
}

type PaymentMethod = "online" | "cash_on_delivery" | null;

interface PaymentFormValues {
  method: PaymentMethod;
}

interface ShippingQuote {
  state: string;
  fee: number;
  minDays: number;
  maxDays: number;
}

type DiscountType = "percentage" | "fixed_amount";

interface AppliedDiscount {
  code: string;
  type: DiscountType;
  value: number;
  amount: number;
  description: string | null;
}

interface SavedAddressCard {
  id: string;
  label: string;
  recipientName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  deliveryInstructions: string;
}

interface SavedContactDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface CheckoutProductAvailabilityRow {
  id: string;
  name: string;
  is_available: boolean | null;
  stock_quantity: number;
  price: number;
  compare_at_price: number | null;
  has_variants: boolean | null;
}

interface CheckoutVariantAvailabilityRow {
  id: string;
  product_id: string;
  stock_quantity: number;
  is_available: boolean | null;
  price: number | null;
  compare_at_price: number | null;
}

interface CheckoutPreSubmitValidationResult {
  valid: boolean;
  errors: string[];
  updatedItems: CartItem[];
  hasChanges: boolean;
}

interface CheckoutSessionSnapshot {
  contact: ContactFormValues;
  delivery: DeliveryFormValues;
  payment: PaymentFormValues;
  review: ReviewFormValues;
  completed: CheckoutStep[];
  selectedSavedAddressId: string | null;
  discountInput: string;
  appliedDiscount: AppliedDiscount | null;
}

interface PendingOnlineOrder {
  orderNumber: string;
  signature: string;
}

interface FloatingInputProps {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "email" | "tel";
  autoComplete?: string;
  helperText?: string;
  touched?: boolean;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

interface FloatingTextareaProps {
  id: string;
  label: string;
  value: string;
  required?: boolean;
  placeholder?: string;
  touched?: boolean;
  error?: string;
  maxLength?: number;
  showCharacterCount?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}

interface FloatingSelectProps {
  id: string;
  label: string;
  value: string;
  options: string[];
  required?: boolean;
  touched?: boolean;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

interface SearchableStateFieldProps {
  label: string;
  value: string;
  options: string[];
  required?: boolean;
  touched?: boolean;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

const CHECKOUT_SESSION_STORAGE_KEY = `${storeKeyPrefix}_checkout_session_v1`;
const CHECKOUT_MODE_STORAGE_KEY = `${storeKeyPrefix}_checkout_mode`;
const SAVED_ADDRESS_STORAGE_KEY_PREFIX = `${storeKeyPrefix}_saved_addresses`;
const LAST_ORDER_STORAGE_KEY = `${storeKeyPrefix}_last_order`;

const CHECKOUT_STEPS: CheckoutStep[] = ["contact", "delivery", "payment", "review"];

const STEP_PATH: Record<CheckoutStep, string> = {
  contact: "/checkout/contact",
  delivery: "/checkout/delivery",
  payment: "/checkout/payment",
  review: "/checkout/review",
};

const STEP_LABEL: Record<CheckoutStep, string> = {
  contact: "Contact",
  delivery: "Delivery",
  payment: "Payment",
  review: "Review",
};

const CONTACT_FIELDS: ContactField[] = ["firstName", "lastName", "email", "phone"];
const DELIVERY_FIELDS: DeliveryField[] = ["addressLine1", "city", "state", "country", "deliveryInstructions"];

const GHANA_REGIONS = [
  "Ahafo",
  "Ashanti",
  "Bono",
  "Bono East",
  "Central",
  "Eastern",
  "Greater Accra",
  "North East",
  "Northern",
  "Oti",
  "Savannah",
  "Upper East",
  "Upper West",
  "Volta",
  "Western",
  "Western North",
];

const COUNTRY_OPTIONS = ["Ghana"];

const DEFAULT_CONTACT_VALUES: ContactFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  marketingOptIn: false,
};

const DEFAULT_DELIVERY_VALUES: DeliveryFormValues = {
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  country: "Ghana",
  deliveryInstructions: "",
  saveForFuture: false,
};

const DEFAULT_REVIEW_VALUES: ReviewFormValues = {
  orderNotes: "",
};

const DEFAULT_PAYMENT_VALUES: PaymentFormValues = {
  method: null,
};

const FALLBACK_DISCOUNT_CODES: Record<
  string,
  { type: DiscountType; value: number; minimumOrderAmount: number; description: string }
> = {
  WELCOME10: {
    type: "percentage",
    value: 10,
    minimumOrderAmount: 0,
    description: "10% off your first order",
  },
  LUX1500: {
    type: "fixed_amount",
    value: 1500,
    minimumOrderAmount: 10000,
    description: "Save 1500 GHS on orders over 10000 GHS",
  },
};

const ERROR_SUMMARY_TEXT = "Please fix the errors above before continuing";
const SHIPPING_RATES_NOT_CONFIGURED_ERROR =
  "Shipping is unavailable because shipping rates are not configured in admin settings.";
const SHIPPING_RATES_LOADING_ERROR = "Shipping rates are still loading. Please wait a moment and try again.";
const SHIPPING_RATES_FETCH_ERROR = "Unable to load shipping rates right now. Please refresh and try again.";
const PAYSTACK_BUYER_FEE_PERCENT = 1.95;

const getNoShippingRateForStateError = (state: string) =>
  `No shipping rate is configured for ${state}. Please contact support before placing your order.`;

const calculatePaystackBuyerFee = (amount: number): number => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return Math.round(amount * (PAYSTACK_BUYER_FEE_PERCENT / 100) * 100) / 100;
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readString = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : fallback);

const readBoolean = (value: unknown, fallback = false): boolean => (typeof value === "boolean" ? value : fallback);

const sanitizeText = (value: string): string =>
  value
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const sanitizeMultilineText = (value: string): string =>
  value
    .replace(/[<>]/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line, index, all) => line.length > 0 || (index > 0 && index < all.length - 1))
    .join("\n")
    .trim();

const toStockQuantity = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.trunc(parsed));
};

const getItemDisplayName = (item: Pick<CartItem, "name" | "variant_label">): string => {
  const variantLabel = typeof item.variant_label === "string" && item.variant_label.trim() ? item.variant_label.trim() : null;
  return variantLabel ? `${item.name} (${variantLabel})` : item.name;
};

const decodeField = (value: string): string => {
  const normalized = value.replace(/\+/g, " ");

  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
};

const isLikelyTimeoutError = (error: unknown): boolean => {
  const candidate = error as { message?: string; details?: string; hint?: string } | null;
  const combined = [candidate?.message, candidate?.details, candidate?.hint].filter(Boolean).join(" ").toLowerCase();
  return (
    combined.includes("timeout") ||
    combined.includes("timed out") ||
    combined.includes("fetch failed") ||
    combined.includes("failed to fetch") ||
    combined.includes("network request failed")
  );
};

const normalizeStateName = (value: string): string => {
  return value.toLowerCase().replace(/[().,-]/g, " ").replace(/\s+/g, " ").trim();
};

const addressIdentityKey = (address: Pick<SavedAddressCard, "addressLine1" | "city" | "state" | "country">): string =>
  [
    sanitizeText(address.addressLine1).toLowerCase(),
    sanitizeText(address.city).toLowerCase(),
    normalizeStateName(address.state),
    sanitizeText(address.country).toLowerCase(),
  ].join("::");

const uniqueCheckoutSteps = (steps: CheckoutStep[]): CheckoutStep[] => {
  const deduped = new Set<CheckoutStep>(steps.filter((step): step is CheckoutStep => CHECKOUT_STEPS.includes(step)));
  return CHECKOUT_STEPS.filter((step) => deduped.has(step));
};

const getStepFromPath = (pathname: string): CheckoutStep | null => {
  const normalized = pathname.replace(/\/+$/, "");
  if (normalized === "/checkout/contact") {
    return "contact";
  }

  if (normalized === "/checkout/delivery") {
    return "delivery";
  }

  if (normalized === "/checkout/payment") {
    return "payment";
  }

  if (normalized === "/checkout/review") {
    return "review";
  }

  if (normalized.startsWith("/checkout/")) {
    return null;
  }

  return null;
};

const parseStateListFromJson = (value: Json | null): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => normalizeStateName(entry));
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => normalizeStateName(entry));
      }
    } catch {
      return [];
    }
  }

  return [];
};

const buildOnlineOrderSignature = (params: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  deliveryInstructions: string;
  orderNotes: string;
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  total: number;
  items: CartItem[];
}) => {
  const normalizedItems = [...params.items]
    .map((item) => ({
      product_id: item.product_id,
      variant_id: item.variant_id ?? null,
      quantity: item.quantity,
      unit_price: item.price,
    }))
    .sort((a, b) => {
      const leftKey = `${a.product_id}:${a.variant_id ?? "base"}`;
      const rightKey = `${b.product_id}:${b.variant_id ?? "base"}`;
      return leftKey.localeCompare(rightKey);
    });

  return JSON.stringify({
    firstName: params.firstName,
    lastName: params.lastName,
    email: params.email,
    phone: params.phone,
    addressLine1: params.addressLine1,
    addressLine2: params.addressLine2,
    city: params.city,
    state: params.state,
    country: params.country,
    deliveryInstructions: params.deliveryInstructions,
    orderNotes: params.orderNotes,
    subtotal: params.subtotal,
    shippingFee: params.shippingFee,
    discountAmount: params.discountAmount,
    total: params.total,
    items: normalizedItems,
  });
};

const resolveShippingQuote = (state: string, rates: ShippingRateRow[]): ShippingQuote | null => {
  const normalizedState = normalizeStateName(state);

  if (!normalizedState) {
    return null;
  }

  let fallbackRate: ShippingRateRow | null = null;

  for (const rate of rates) {
    const states = parseStateListFromJson(rate.states);
    if (states.length === 0) {
      fallbackRate = rate;
      continue;
    }

    if (states.includes(normalizedState)) {
      return {
        state,
        fee: Math.max(0, Math.round(Number(rate.base_rate) || 0)),
        minDays: rate.estimated_days_min ?? 2,
        maxDays: rate.estimated_days_max ?? 5,
      };
    }
  }

  if (fallbackRate) {
    return {
      state,
      fee: Math.max(0, Math.round(Number(fallbackRate.base_rate) || 0)),
      minDays: fallbackRate.estimated_days_min ?? 2,
      maxDays: fallbackRate.estimated_days_max ?? 5,
    };
  }

  return null;
};

const getSavedAddressStorageKey = (userId: string): string => `${SAVED_ADDRESS_STORAGE_KEY_PREFIX}:${userId}`;

const parseSavedAddressList = (value: unknown): SavedAddressCard[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index): SavedAddressCard | null => {
      if (!isPlainRecord(entry)) {
        return null;
      }

      const id = readString(entry.id, `local-${index + 1}`);
      const addressLine1 = sanitizeText(readString(entry.addressLine1));
      const city = sanitizeText(readString(entry.city));
      const state = sanitizeText(readString(entry.state));
      const country = sanitizeText(readString(entry.country, "Ghana"));

      if (!addressLine1 || !city || !state || !country) {
        return null;
      }

      return {
        id,
        label: sanitizeText(readString(entry.label, "Saved Address")) || "Saved Address",
        recipientName: sanitizeText(readString(entry.recipientName)),
        addressLine1,
        addressLine2: sanitizeText(readString(entry.addressLine2)),
        city,
        state,
        country,
        deliveryInstructions: sanitizeMultilineText(readString(entry.deliveryInstructions)),
      };
    })
    .filter((entry): entry is SavedAddressCard => Boolean(entry));
};

const loadSavedAddressesFromLocalStorage = (userId: string): SavedAddressCard[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(getSavedAddressStorageKey(userId));

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parseSavedAddressList(parsed);
  } catch {
    return [];
  }
};

const saveSavedAddressesToLocalStorage = (userId: string, addresses: SavedAddressCard[]) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalized: SavedAddressCard[] = [];
  const seenKeys = new Set<string>();

  for (const address of addresses) {
    const key = addressIdentityKey(address);
    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    normalized.push(address);

    if (normalized.length >= 8) {
      break;
    }
  }

  window.localStorage.setItem(getSavedAddressStorageKey(userId), JSON.stringify(normalized));
};

const mergeSavedAddresses = (addresses: SavedAddressCard[]): SavedAddressCard[] => {
  const seenKeys = new Set<string>();
  const merged: SavedAddressCard[] = [];

  for (const address of addresses) {
    const key = addressIdentityKey(address);
    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    merged.push(address);
  }

  return merged;
};

const getContactFieldError = (field: ContactField, value: string): string | undefined => {
  const trimmed = sanitizeText(value);

  if (!trimmed) {
    const labelByField: Record<ContactField, string> = {
      firstName: "First name",
      lastName: "Last name",
      email: "Email",
      phone: "Phone",
    };

    return `${labelByField[field]} is required`;
  }

  if (field === "email") {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmed)) {
      return "Enter a valid email address";
    }
  }

  if (field === "phone") {
    if (!validateGhanaianPhone(trimmed)) {
      return "Enter a valid Ghanaian phone number";
    }
  }

  return undefined;
};

const getDeliveryFieldError = (field: DeliveryField, value: string): string | undefined => {
  if (field === "deliveryInstructions") {
    if (value.length > 200) {
      return "Delivery instructions must be 200 characters or less";
    }
    return undefined;
  }

  const trimmed = sanitizeText(value);

  if (!trimmed) {
    const labelByField: Record<Exclude<DeliveryField, "deliveryInstructions">, string> = {
      addressLine1: "Address line 1",
      city: "Town / City",
      state: "Region",
      country: "Country",
    };

    return `${labelByField[field]} is required`;
  }

  return undefined;
};

const validateContactForm = (values: ContactFormValues): Partial<Record<ContactField, string>> => {
  const errors: Partial<Record<ContactField, string>> = {};

  for (const field of CONTACT_FIELDS) {
    const error = getContactFieldError(field, values[field]);
    if (error) {
      errors[field] = error;
    }
  }

  return errors;
};

const validateDeliveryForm = (values: DeliveryFormValues): Partial<Record<DeliveryField, string>> => {
  const errors: Partial<Record<DeliveryField, string>> = {};

  for (const field of DELIVERY_FIELDS) {
    const error = getDeliveryFieldError(field, values[field]);
    if (error) {
      errors[field] = error;
    }
  }

  return errors;
};

const validatePaymentForm = (values: PaymentFormValues, availableMethods: PaymentMethod[]): boolean =>
  values.method !== null && availableMethods.includes(values.method);

const isContactComplete = (values: ContactFormValues): boolean => Object.keys(validateContactForm(values)).length === 0;
const isDeliveryComplete = (values: DeliveryFormValues): boolean => Object.keys(validateDeliveryForm(values)).length === 0;
const isPaymentComplete = (values: PaymentFormValues, availableMethods: PaymentMethod[]): boolean =>
  validatePaymentForm(values, availableMethods);

const getDiscountAmount = (type: DiscountType, value: number, subtotal: number): number => {
  if (type === "percentage") {
    return Math.max(0, Math.round((subtotal * value) / 100));
  }

  return Math.max(0, Math.round(value));
};

const FloatingInput = ({
  id,
  label,
  value,
  placeholder,
  required = false,
  type = "text",
  autoComplete,
  helperText,
  touched,
  error,
  onChange,
  onBlur,
}: FloatingInputProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value.trim().length > 0;
  const shouldFloatLabel = isFocused || hasValue;
  const showSuccess = Boolean(touched && !error && (required ? hasValue : hasValue));

  const borderClass = error ? "border-[var(--color-danger)]" : showSuccess ? "border-[var(--color-accent)]" : "border-[var(--color-border)]";

  return (
    <div className="pt-[14px]">
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder ?? " "}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onBlur();
          }}
          className={`w-full border-0 border-b ${borderClass} bg-transparent pb-[10px] pt-[16px] font-body text-[16px] text-[var(--color-primary)] transition-colors duration-200 placeholder:text-transparent focus:placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)] focus:outline-none md:text-[14px]`}
        />

        <label
          htmlFor={id}
          className={`pointer-events-none absolute left-0 font-body transition-all duration-200 ${
            shouldFloatLabel
              ? "top-[2px] text-[10px] uppercase tracking-[0.12em] text-[var(--color-accent)]"
              : "top-[20px] text-[14px] text-[var(--color-muted)]"
          }`}
        >
          {label}
          {required ? <span className="ml-[2px] text-[var(--color-danger)]">*</span> : null}
        </label>
      </div>

      {helperText ? <p className="mt-[6px] font-body text-[11px] text-[var(--color-muted-soft)]">{helperText}</p> : null}
      {error ? <p className="mt-[6px] font-body text-[11px] text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
};

const FloatingTextarea = ({
  id,
  label,
  value,
  required = false,
  placeholder,
  touched,
  error,
  maxLength,
  showCharacterCount = false,
  onChange,
  onBlur,
}: FloatingTextareaProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value.trim().length > 0;
  const shouldFloatLabel = isFocused || hasValue;
  const showSuccess = Boolean(touched && !error && (required ? hasValue : hasValue));

  const borderClass = error ? "border-[var(--color-danger)]" : showSuccess ? "border-[var(--color-accent)]" : "border-[var(--color-border)]";

  return (
    <div className="pt-[14px]">
      <div className="relative">
        <textarea
          id={id}
          value={value}
          placeholder={placeholder ?? " "}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onBlur();
          }}
          className={`w-full resize-none border-0 border-b ${borderClass} bg-transparent pb-[10px] pt-[20px] font-body text-[16px] text-[var(--color-primary)] transition-colors duration-200 placeholder:text-transparent focus:placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)] focus:outline-none md:text-[14px]`}
          rows={4}
        />

        <label
          htmlFor={id}
          className={`pointer-events-none absolute left-0 font-body transition-all duration-200 ${
            shouldFloatLabel
              ? "top-[2px] text-[10px] uppercase tracking-[0.12em] text-[var(--color-accent)]"
              : "top-[22px] text-[14px] text-[var(--color-muted)]"
          }`}
        >
          {label}
          {required ? <span className="ml-[2px] text-[var(--color-danger)]">*</span> : null}
        </label>
      </div>

      {showCharacterCount && typeof maxLength === "number" ? (
        <p className="mt-[6px] text-right font-body text-[10px] text-[var(--color-muted-soft)]">
          {value.length}/{maxLength}
        </p>
      ) : null}

      {error ? <p className="mt-[6px] font-body text-[11px] text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
};

const FloatingSelect = ({
  id,
  label,
  value,
  options,
  required = false,
  touched,
  error,
  onChange,
  onBlur,
}: FloatingSelectProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value.trim().length > 0;
  const shouldFloatLabel = isFocused || hasValue;
  const showSuccess = Boolean(touched && !error && hasValue);

  const borderClass = error ? "border-[var(--color-danger)]" : showSuccess ? "border-[var(--color-accent)]" : "border-[var(--color-border)]";

  return (
    <div className="pt-[14px]">
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onBlur();
          }}
          className={`w-full appearance-none border-0 border-b ${borderClass} bg-transparent pb-[10px] pt-[16px] font-body text-[16px] text-[var(--color-primary)] transition-colors duration-200 focus:border-[var(--color-primary)] focus:outline-none md:text-[14px]`}
        >
          <option value="" disabled>
            Select an option
          </option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <ChevronDown className="pointer-events-none absolute right-0 top-[31px] h-4 w-4 text-[var(--color-muted)]" />

        <label
          htmlFor={id}
          className={`pointer-events-none absolute left-0 font-body transition-all duration-200 ${
            shouldFloatLabel
              ? "top-[2px] text-[10px] uppercase tracking-[0.12em] text-[var(--color-accent)]"
              : "top-[20px] text-[14px] text-[var(--color-muted)]"
          }`}
        >
          {label}
          {required ? <span className="ml-[2px] text-[var(--color-danger)]">*</span> : null}
        </label>
      </div>

      {error ? <p className="mt-[6px] font-body text-[11px] text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
};

const SearchableStateField = ({
  label,
  value,
  options,
  required = false,
  touched,
  error,
  onChange,
  onBlur,
}: SearchableStateFieldProps) => {
  const [open, setOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value.trim().length > 0;
  const shouldFloatLabel = isFocused || hasValue;
  const showSuccess = Boolean(touched && !error && hasValue);

  const borderClass = error ? "border-[var(--color-danger)]" : showSuccess ? "border-[var(--color-accent)]" : "border-[var(--color-border)]";

  return (
    <div className="pt-[14px]">
      <div className="relative">
        <Popover
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            setIsFocused(nextOpen);

            if (!nextOpen) {
              onBlur();
            }
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`flex w-full items-center justify-between border-0 border-b ${borderClass} bg-transparent pb-[10px] pt-[16px] text-left font-body text-[16px] text-[var(--color-primary)] transition-colors duration-200 focus:border-[var(--color-primary)] focus:outline-none md:text-[14px]`}
            >
              <span className="truncate">{value || " "}</span>
              <ChevronDown className="h-4 w-4 text-[var(--color-muted)]" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-[var(--radix-popover-trigger-width)] border-[var(--color-border)] bg-[var(--color-secondary)] p-0"
          >
            <Command className="bg-[var(--color-secondary)]">
              <CommandInput
                placeholder="Search region..."
                className="font-body text-[13px] placeholder:text-[var(--color-muted-soft)] focus:ring-0"
              />
              <CommandList>
                <CommandEmpty className="font-body text-[12px] text-[var(--color-muted)]">No region found.</CommandEmpty>
                <CommandGroup>
                  {options.map((stateName) => (
                    <CommandItem
                      key={stateName}
                      value={stateName}
                      onSelect={() => {
                        onChange(stateName);
                        setOpen(false);
                        setIsFocused(false);
                        onBlur();
                      }}
                      className="font-body text-[12px] text-[var(--color-primary)] data-[selected=true]:bg-[var(--color-surface)] data-[selected=true]:text-[var(--color-primary)]"
                    >
                      <span className="flex-1">{stateName}</span>
                      <Check className={`h-3.5 w-3.5 ${value === stateName ? "opacity-100" : "opacity-0"}`} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <p
          className={`pointer-events-none absolute left-0 font-body transition-all duration-200 ${
            shouldFloatLabel
              ? "top-[2px] text-[10px] uppercase tracking-[0.12em] text-[var(--color-accent)]"
              : "top-[20px] text-[14px] text-[var(--color-muted)]"
          }`}
        >
          {label}
          {required ? <span className="ml-[2px] text-[var(--color-danger)]">*</span> : null}
        </p>
      </div>

      {error ? <p className="mt-[6px] font-body text-[11px] text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
};

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const signInModalPath = buildPathWithSearch(
    location.pathname,
    buildAuthModalSearch(location.search, {
      mode: "login",
      redirect: STEP_PATH.contact,
    }),
    location.hash,
  );
  const isGuestCheckoutEnabled = storeConfig.features.guestCheckout;
  const isDiscountCodesEnabled = storeConfig.features.discountCodes;

  const { items, subtotal, totalItems, validateCart, isValidating, clearCart, replaceItems } = useCart();

  const [isHydrated, setIsHydrated] = useState(false);

  const [contactValues, setContactValues] = useState<ContactFormValues>(DEFAULT_CONTACT_VALUES);
  const [deliveryValues, setDeliveryValues] = useState<DeliveryFormValues>(DEFAULT_DELIVERY_VALUES);
  const [paymentValues, setPaymentValues] = useState<PaymentFormValues>(DEFAULT_PAYMENT_VALUES);
  const [reviewValues, setReviewValues] = useState<ReviewFormValues>(DEFAULT_REVIEW_VALUES);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);

  const [contactTouched, setContactTouched] = useState<Partial<Record<ContactField, boolean>>>({});
  const [deliveryTouched, setDeliveryTouched] = useState<Partial<Record<DeliveryField, boolean>>>({});

  const [contactErrors, setContactErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [deliveryErrors, setDeliveryErrors] = useState<Partial<Record<DeliveryField, string>>>({});

  const [completedSteps, setCompletedSteps] = useState<CheckoutStep[]>([]);

  const [shippingRates, setShippingRates] = useState<ShippingRateRow[]>([]);
  const [isShippingRatesLoading, setIsShippingRatesLoading] = useState(true);
  const [shippingRatesLoadError, setShippingRatesLoadError] = useState<string | null>(null);

  const [discountInput, setDiscountInput] = useState("");
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountSuccess, setDiscountSuccess] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);

  const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState(false);

  const [isSessionChecked, setIsSessionChecked] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<"guest" | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [savedContactDetails, setSavedContactDetails] = useState<SavedContactDetails | null>(null);
  const [isSavedDetailsPromptVisible, setIsSavedDetailsPromptVisible] = useState(false);
  const [isSavedDetailsConfirmationVisible, setIsSavedDetailsConfirmationVisible] = useState(false);
  const [isSavedDetailsConfirmationFading, setIsSavedDetailsConfirmationFading] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddressCard[]>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(null);
  const [isManualAddressOpen, setIsManualAddressOpen] = useState(true);

  const [stepAdvanceError, setStepAdvanceError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [checkoutValidationErrors, setCheckoutValidationErrors] = useState<string[]>([]);
  const [submissionPhase, setSubmissionPhase] = useState<"idle" | "verifying" | "submitting">("idle");
  const [pendingOnlineOrder, setPendingOnlineOrder] = useState<PendingOnlineOrder | null>(null);

  const pathStep = useMemo(() => getStepFromPath(location.pathname), [location.pathname]);
  const currentStep: CheckoutStep = pathStep ?? "contact";
  const currentStepIndex = CHECKOUT_STEPS.indexOf(currentStep);
  const paystackConfig = useMemo(() => getPaystackConfig(), []);
  const isFreeTierStore = paystackConfig.isSubaccountMode;
  const onlinePaymentAvailable = useMemo(() => {
    if (!paymentSettings?.online_payment_enabled) {
      return false;
    }

    if (!paystackConfig.publicKey || !isPaymentConfigured()) {
      return false;
    }

    return true;
  }, [
    paymentSettings?.online_payment_enabled,
    paystackConfig.isSubaccountMode,
    paystackConfig.publicKey,
    paystackConfig.subaccountCode,
  ]);
  const cashOnDeliveryAvailable = Boolean(paymentSettings?.cash_on_delivery_enabled);
  const availablePaymentMethods = useMemo(() => {
    const methods: Exclude<PaymentMethod, null>[] = [];

    if (onlinePaymentAvailable) {
      methods.push("online");
    }

    if (!isFreeTierStore && cashOnDeliveryAvailable) {
      methods.push("cash_on_delivery");
    }

    return methods;
  }, [cashOnDeliveryAvailable, isFreeTierStore, onlinePaymentAvailable]);
  const shouldRenderPaymentMethodChoice = availablePaymentMethods.length > 1;
  const hasNoAvailablePaymentMethods = paymentSettings !== null && availablePaymentMethods.length === 0;

  const shippingQuote = useMemo(() => {
    if (!deliveryValues.state) {
      return null;
    }

    return resolveShippingQuote(deliveryValues.state, shippingRates);
  }, [deliveryValues.state, shippingRates]);
  const hasConfiguredShippingRates = shippingRates.length > 0;
  const shippingConfigurationError = useMemo(() => {
    if (isShippingRatesLoading) {
      return SHIPPING_RATES_LOADING_ERROR;
    }

    if (shippingRatesLoadError) {
      return shippingRatesLoadError;
    }

    if (!hasConfiguredShippingRates) {
      return SHIPPING_RATES_NOT_CONFIGURED_ERROR;
    }

    if (deliveryValues.state && !shippingQuote) {
      return getNoShippingRateForStateError(deliveryValues.state);
    }

    return null;
  }, [deliveryValues.state, hasConfiguredShippingRates, isShippingRatesLoading, shippingQuote, shippingRatesLoadError]);

  const shippingFee = shippingQuote?.fee ?? 0;
  const discountAmount = isDiscountCodesEnabled ? appliedDiscount?.amount ?? 0 : 0;
  const orderTotalBeforePaystackFee = Math.max(0, subtotal + shippingFee - discountAmount);
  const isPaystackBuyerFeeApplicable = isFreeTierStore && onlinePaymentAvailable && paymentValues.method === "online";
  const paystackBuyerFee = isPaystackBuyerFeeApplicable
    ? calculatePaystackBuyerFee(orderTotalBeforePaystackFee)
    : 0;
  const orderTotal = Math.max(0, orderTotalBeforePaystackFee + paystackBuyerFee);

  const shippingSidebarValue =
    currentStep === "contact"
      ? "Calculated in next step"
      : deliveryValues.state
        ? shippingQuote
          ? formatPrice(shippingQuote.fee)
          : "Unavailable"
        : "Select region";

  const orderItemCountLabel = `${totalItems} ${totalItems === 1 ? "item" : "items"}`;
  const selectedPaymentLabel =
    paymentValues.method === "online"
      ? "Pay Online (Paystack)"
      : paymentValues.method === "cash_on_delivery"
        ? "Cash on Delivery"
        : "Not selected";
  const shouldShowSavedDetailsPrompt =
    isSessionChecked && isLoggedIn && Boolean(savedContactDetails) && isSavedDetailsPromptVisible;
  const isGuestCheckout = isGuestCheckoutEnabled && isSessionChecked && !isLoggedIn && checkoutMode === "guest";

  useEffect(() => {
    void validateCart();
  }, [validateCart]);

  useEffect(() => {
    let cancelled = false;

    const loadPaymentSettings = async () => {
      try {
        const settings = await getPaymentSettings();
        if (!cancelled) {
          setPaymentSettings(settings);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Failed to load payment settings", error);
        }

        if (!cancelled) {
          setPaymentSettings({
            id: "local-fallback",
            cash_on_delivery_enabled: false,
            online_payment_enabled: false,
            updated_at: new Date(0).toISOString(),
          });
        }
      }
    };

    void loadPaymentSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!paymentSettings) {
      return;
    }

    if (availablePaymentMethods.length === 0) {
      setPaymentValues({ method: null });
      return;
    }

    if (availablePaymentMethods.length === 1) {
      const onlyMethod = availablePaymentMethods[0];
      setPaymentValues((previous) => (previous.method === onlyMethod ? previous : { method: onlyMethod }));
      return;
    }

    setPaymentValues((previous) =>
      previous.method !== null && availablePaymentMethods.includes(previous.method)
        ? previous
        : { method: null },
    );
  }, [availablePaymentMethods, paymentSettings]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedMode = window.sessionStorage.getItem(CHECKOUT_MODE_STORAGE_KEY);
    setCheckoutMode(storedMode === "guest" ? "guest" : null);
  }, []);

  useEffect(() => {
    if (!isDiscountCodesEnabled) {
      setDiscountInput("");
      setDiscountError(null);
      setDiscountSuccess(null);
      setAppliedDiscount(null);
    }
  }, [isDiscountCodesEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") {
      setIsHydrated(true);
      return;
    }

    const raw = window.sessionStorage.getItem(CHECKOUT_SESSION_STORAGE_KEY);

    if (!raw) {
      setIsHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<CheckoutSessionSnapshot>;

      if (isPlainRecord(parsed.contact)) {
        setContactValues({
          firstName: sanitizeText(readString(parsed.contact.firstName)),
          lastName: sanitizeText(readString(parsed.contact.lastName)),
          email: sanitizeText(readString(parsed.contact.email)).toLowerCase(),
          phone: sanitizeText(readString(parsed.contact.phone)),
          marketingOptIn: readBoolean(parsed.contact.marketingOptIn),
        });
      }

      if (isPlainRecord(parsed.delivery)) {
        const restoredState = sanitizeText(readString(parsed.delivery.state));
        const matchedRegion = GHANA_REGIONS.find(
          (region) => normalizeStateName(region) === normalizeStateName(restoredState),
        );

        setDeliveryValues({
          addressLine1: readString(parsed.delivery.addressLine1),
          addressLine2: readString(parsed.delivery.addressLine2),
          city: readString(parsed.delivery.city),
          state: matchedRegion ?? "",
          country: "Ghana",
          deliveryInstructions: readString(parsed.delivery.deliveryInstructions).slice(0, 200),
          saveForFuture: readBoolean(parsed.delivery.saveForFuture),
        });
      }

      if (isPlainRecord(parsed.payment)) {
        const rawMethod = readString(parsed.payment.method);
        const method =
          rawMethod === "online" || rawMethod === "mobile_money"
            ? "online"
            : rawMethod === "cash_on_delivery"
              ? "cash_on_delivery"
              : null;
        setPaymentValues({ method });
      }

      if (isPlainRecord(parsed.review)) {
        setReviewValues({
          orderNotes: readString(parsed.review.orderNotes),
        });
      }

      if (Array.isArray(parsed.completed)) {
        const parsedSteps = parsed.completed.filter((step): step is CheckoutStep =>
          CHECKOUT_STEPS.includes(step as CheckoutStep),
        );
        setCompletedSteps(uniqueCheckoutSteps(parsedSteps));
      }

      if (typeof parsed.selectedSavedAddressId === "string") {
        setSelectedSavedAddressId(parsed.selectedSavedAddressId);
        setIsManualAddressOpen(false);
      }

      if (isDiscountCodesEnabled && typeof parsed.discountInput === "string") {
        setDiscountInput(parsed.discountInput);
      }

      if (isDiscountCodesEnabled && isPlainRecord(parsed.appliedDiscount)) {
        const type = parsed.appliedDiscount.type;
        if (type === "percentage" || type === "fixed_amount") {
          const amount = Number(parsed.appliedDiscount.amount ?? 0);
          const value = Number(parsed.appliedDiscount.value ?? 0);

          if (Number.isFinite(amount) && Number.isFinite(value)) {
            setAppliedDiscount({
              code: sanitizeText(readString(parsed.appliedDiscount.code)).toUpperCase(),
              type,
              value,
              amount: Math.max(0, Math.round(amount)),
              description: readString(parsed.appliedDiscount.description) || null,
            });
          }
        }
      }
    } catch {
      window.sessionStorage.removeItem(CHECKOUT_SESSION_STORAGE_KEY);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") {
      return;
    }

    const snapshot: CheckoutSessionSnapshot = {
      contact: contactValues,
      delivery: deliveryValues,
      payment: paymentValues,
      review: reviewValues,
      completed: completedSteps,
      selectedSavedAddressId,
      discountInput: isDiscountCodesEnabled ? discountInput : "",
      appliedDiscount: isDiscountCodesEnabled ? appliedDiscount : null,
    };

    window.sessionStorage.setItem(CHECKOUT_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  }, [
    appliedDiscount,
    completedSteps,
    contactValues,
    deliveryValues,
    discountInput,
    isDiscountCodesEnabled,
    isHydrated,
    paymentValues,
    reviewValues,
    selectedSavedAddressId,
  ]);

  const persistCheckoutSessionSnapshot = useCallback(
    (nextCompletedSteps: CheckoutStep[]) => {
      if (!isHydrated || typeof window === "undefined") {
        return;
      }

      const snapshot: CheckoutSessionSnapshot = {
        contact: contactValues,
        delivery: deliveryValues,
        payment: paymentValues,
        review: reviewValues,
        completed: nextCompletedSteps,
        selectedSavedAddressId,
        discountInput: isDiscountCodesEnabled ? discountInput : "",
        appliedDiscount: isDiscountCodesEnabled ? appliedDiscount : null,
      };

      window.sessionStorage.setItem(CHECKOUT_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
    },
    [
      appliedDiscount,
      contactValues,
      deliveryValues,
      discountInput,
      isDiscountCodesEnabled,
      isHydrated,
      paymentValues,
      reviewValues,
      selectedSavedAddressId,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    const loadShippingRates = async () => {
      setIsShippingRatesLoading(true);
      setShippingRatesLoadError(null);
      try {
        const data = await fetchActiveShippingRates();
        if (!cancelled) {
          setShippingRates(data);
          if (data.length === 0) {
            setShippingRatesLoadError(SHIPPING_RATES_NOT_CONFIGURED_ERROR);
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Failed to load shipping rates", error);
        }

        if (cancelled) {
          return;
        }

        setShippingRates([]);
        setShippingRatesLoadError(SHIPPING_RATES_FETCH_ERROR);
      } finally {
        if (!cancelled) {
          setIsShippingRatesLoading(false);
        }
      }
    };

    void loadShippingRates();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isSessionChecked || isLoggedIn || isGuestCheckoutEnabled) {
      return;
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(CHECKOUT_MODE_STORAGE_KEY);
      window.sessionStorage.setItem(REDIRECT_AFTER_LOGIN_KEY, STEP_PATH.contact);
    }

    navigate(signInModalPath, { replace: true });
  }, [isGuestCheckoutEnabled, isLoggedIn, isSessionChecked, navigate, signInModalPath]);

  useEffect(() => {
    let cancelled = false;

    const validateSession = async () => {
      try {
        const sessionData = await fetchCheckoutSessionData();

        if (cancelled) {
          return;
        }

        setIsLoggedIn(sessionData.isLoggedIn);
        setCurrentUserId(sessionData.userId);
        if (sessionData.isLoggedIn && typeof window !== "undefined") {
          window.sessionStorage.removeItem(CHECKOUT_MODE_STORAGE_KEY);
          setCheckoutMode(null);
        }

        const normalizedContactDetails: SavedContactDetails | null = sessionData.contactProfile
          ? {
              firstName: sanitizeText(sessionData.contactProfile.first_name ?? ""),
              lastName: sanitizeText(sessionData.contactProfile.last_name ?? ""),
              email: sanitizeText(sessionData.contactProfile.email ?? ""),
              phone: sanitizeText(sessionData.contactProfile.phone ?? ""),
            }
          : null;
        const hasSavedContactDetails =
          normalizedContactDetails !== null &&
          CONTACT_FIELDS.some((field) => normalizedContactDetails[field].trim().length > 0);

        setSavedContactDetails(hasSavedContactDetails ? normalizedContactDetails : null);
        setIsSavedDetailsPromptVisible(Boolean(sessionData.isLoggedIn && hasSavedContactDetails));
        setIsSavedDetailsConfirmationVisible(false);
        setIsSavedDetailsConfirmationFading(false);

        const localAddresses = sessionData.userId ? loadSavedAddressesFromLocalStorage(sessionData.userId) : [];
        const dbAddresses: SavedAddressCard[] = sessionData.savedAddresses.map((row) => ({
          id: row.id,
          label: sanitizeText(row.label ?? "Saved Address") || "Saved Address",
          recipientName: sanitizeText(row.recipient_name),
          addressLine1: sanitizeText(row.address_line1),
          addressLine2: sanitizeText(row.address_line2 ?? ""),
          city: sanitizeText(row.city),
          state: sanitizeText(row.state),
          country: sanitizeText(row.country),
          deliveryInstructions: sanitizeMultilineText(row.delivery_instructions ?? ""),
        }));

        const merged = mergeSavedAddresses([...dbAddresses, ...localAddresses]);
        setSavedAddresses(merged);

        if (merged.length === 0) {
          setIsManualAddressOpen(true);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Failed to validate checkout session", error);
        }

        if (cancelled) {
          return;
        }

        setIsLoggedIn(false);
        setCurrentUserId(null);
        setSavedContactDetails(null);
        setIsSavedDetailsPromptVisible(false);
        setIsSavedDetailsConfirmationVisible(false);
        setIsSavedDetailsConfirmationFading(false);
        setSavedAddresses([]);
      } finally {
        if (!cancelled) {
          setIsSessionChecked(true);
        }
      }
    };

    void validateSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (pathStep === null) {
      navigate(STEP_PATH.contact, { replace: true });
    }
  }, [isHydrated, navigate, pathStep]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (items.length === 0) {
      navigate("/shop", { replace: true });
    }
  }, [isHydrated, items.length, navigate]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const hasContact = completedSteps.includes("contact");
    const hasDelivery = completedSteps.includes("delivery");
    const hasPayment = completedSteps.includes("payment");

    if (currentStep === "delivery" && !hasContact) {
      navigate(STEP_PATH.contact, { replace: true });
      return;
    }

    if (currentStep === "payment" && (!hasContact || !hasDelivery)) {
      navigate(STEP_PATH.contact, { replace: true });
      return;
    }

    if (currentStep === "review" && (!hasContact || !hasDelivery || !hasPayment)) {
      navigate(STEP_PATH.contact, { replace: true });
    }
  }, [completedSteps, currentStep, isHydrated, navigate]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!completedSteps.includes("contact")) {
      return;
    }

    if (!isContactComplete(contactValues)) {
      setCompletedSteps((previous) =>
        previous.filter((step) => step !== "contact" && step !== "delivery" && step !== "payment"),
      );
    }
  }, [completedSteps, contactValues, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!completedSteps.includes("delivery")) {
      return;
    }

    if (!isDeliveryComplete(deliveryValues)) {
      setCompletedSteps((previous) => previous.filter((step) => step !== "delivery" && step !== "payment"));
    }
  }, [completedSteps, deliveryValues, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (paymentSettings === null) {
      return;
    }

    if (!completedSteps.includes("payment")) {
      return;
    }

    if (availablePaymentMethods.length === 0) {
      return;
    }

    if (!isPaymentComplete(paymentValues, availablePaymentMethods)) {
      setCompletedSteps((previous) => previous.filter((step) => step !== "payment"));
    }
  }, [availablePaymentMethods, completedSteps, isHydrated, paymentSettings, paymentValues]);

  useEffect(() => {
    setStepAdvanceError(null);
  }, [currentStep]);

  useEffect(() => {
    if (!isSavedDetailsConfirmationVisible || typeof window === "undefined") {
      return;
    }

    const fadeTimer = window.setTimeout(() => {
      setIsSavedDetailsConfirmationFading(true);
    }, 3200);

    const hideTimer = window.setTimeout(() => {
      setIsSavedDetailsConfirmationVisible(false);
      setIsSavedDetailsConfirmationFading(false);
    }, 4000);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [isSavedDetailsConfirmationVisible]);

  const updateContactError = useCallback((field: ContactField, error?: string) => {
    setContactErrors((previous) => {
      const next = { ...previous };
      if (error) {
        next[field] = error;
      } else {
        delete next[field];
      }
      return next;
    });
  }, []);

  const updateDeliveryError = useCallback((field: DeliveryField, error?: string) => {
    setDeliveryErrors((previous) => {
      const next = { ...previous };
      if (error) {
        next[field] = error;
      } else {
        delete next[field];
      }
      return next;
    });
  }, []);

  const validateContactStep = useCallback((): boolean => {
    const errors = validateContactForm(contactValues);

    setContactTouched({
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    });

    setContactErrors(errors);

    return Object.keys(errors).length === 0;
  }, [contactValues]);

  const validateDeliveryStep = useCallback((): boolean => {
    const errors = validateDeliveryForm(deliveryValues);

    setDeliveryTouched({
      addressLine1: true,
      city: true,
      state: true,
      country: true,
      deliveryInstructions: true,
    });

    setDeliveryErrors(errors);

    return Object.keys(errors).length === 0;
  }, [deliveryValues]);

  const validatePaymentStep = useCallback((): boolean => {
    return validatePaymentForm(paymentValues, availablePaymentMethods);
  }, [availablePaymentMethods, paymentValues]);

  const handleContactBlur = useCallback(
    (field: ContactField) => {
      setContactTouched((previous) => ({
        ...previous,
        [field]: true,
      }));

      updateContactError(field, getContactFieldError(field, contactValues[field]));
    },
    [contactValues, updateContactError],
  );

  const handleUseSavedDetails = useCallback(() => {
    if (!savedContactDetails) {
      return;
    }

    setContactValues((previous) => ({
      ...previous,
      firstName: savedContactDetails.firstName,
      lastName: savedContactDetails.lastName,
      email: savedContactDetails.email,
      phone: savedContactDetails.phone,
    }));
    setContactTouched({});
    setContactErrors({});
    setIsSavedDetailsPromptVisible(false);
    setIsSavedDetailsConfirmationFading(false);
    setIsSavedDetailsConfirmationVisible(true);
  }, [savedContactDetails]);

  const handleDismissSavedDetails = useCallback(() => {
    setIsSavedDetailsPromptVisible(false);
    setIsSavedDetailsConfirmationVisible(false);
    setIsSavedDetailsConfirmationFading(false);
  }, []);

  const handleSignInInstead = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.removeItem(CHECKOUT_MODE_STORAGE_KEY);
    window.sessionStorage.setItem(REDIRECT_AFTER_LOGIN_KEY, STEP_PATH.contact);
    setCheckoutMode(null);
  }, []);

  const handleDeliveryBlur = useCallback(
    (field: DeliveryField) => {
      setDeliveryTouched((previous) => ({
        ...previous,
        [field]: true,
      }));

      updateDeliveryError(field, getDeliveryFieldError(field, deliveryValues[field]));
    },
    [deliveryValues, updateDeliveryError],
  );

  const handleNextStep = useCallback(() => {
    if (currentStep === "contact") {
      const isValid = validateContactStep();
      if (!isValid) {
        setStepAdvanceError(ERROR_SUMMARY_TEXT);
        return;
      }

      const nextCompletedSteps = uniqueCheckoutSteps([...completedSteps, "contact"]);
      setCompletedSteps(nextCompletedSteps);
      persistCheckoutSessionSnapshot(nextCompletedSteps);
      navigate(STEP_PATH.delivery);
      return;
    }

    if (currentStep === "delivery") {
      const isValid = validateDeliveryStep();
      if (!isValid) {
        setStepAdvanceError(ERROR_SUMMARY_TEXT);
        return;
      }

      if (shippingConfigurationError) {
        setStepAdvanceError(shippingConfigurationError);
        return;
      }

      const nextCompletedSteps = uniqueCheckoutSteps([...completedSteps, "contact", "delivery"]);
      setCompletedSteps(nextCompletedSteps);
      persistCheckoutSessionSnapshot(nextCompletedSteps);
      navigate(STEP_PATH.payment);
      return;
    }

    if (currentStep === "payment") {
      const isValid = validatePaymentStep();
      if (!isValid) {
        setStepAdvanceError(
          hasNoAvailablePaymentMethods
            ? "No payment methods are currently available. Please contact the store."
            : ERROR_SUMMARY_TEXT,
        );
        return;
      }

      const nextCompletedSteps = uniqueCheckoutSteps([...completedSteps, "contact", "delivery", "payment"]);
      setCompletedSteps(nextCompletedSteps);
      persistCheckoutSessionSnapshot(nextCompletedSteps);
      navigate(STEP_PATH.review);
    }
  }, [
    completedSteps,
    currentStep,
    hasNoAvailablePaymentMethods,
    navigate,
    persistCheckoutSessionSnapshot,
    shippingConfigurationError,
    validateContactStep,
    validateDeliveryStep,
    validatePaymentStep,
  ]);

  const handleBack = useCallback(() => {
    if (currentStep === "review") {
      navigate(STEP_PATH.payment);
      return;
    }

    if (currentStep === "payment") {
      navigate(STEP_PATH.delivery);
      return;
    }

    if (currentStep === "delivery") {
      navigate(STEP_PATH.contact);
      return;
    }

    navigate("/shop");
  }, [currentStep, navigate]);

  const handleApplyDiscount = useCallback(async () => {
    if (!isDiscountCodesEnabled) {
      setAppliedDiscount(null);
      setDiscountError(null);
      setDiscountSuccess(null);
      return;
    }

    const candidateCode = sanitizeText(discountInput).toUpperCase();

    if (!candidateCode) {
      setDiscountError("Enter a discount code");
      setDiscountSuccess(null);
      return;
    }

    setIsApplyingDiscount(true);
    setDiscountError(null);
    setDiscountSuccess(null);

    try {
      const data = await fetchDiscountCode(candidateCode);

      if (data) {
        const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : null;
        if (expiresAt && expiresAt <= Date.now()) {
          setAppliedDiscount(null);
          setDiscountError("This code has expired");
          return;
        }

        if (
          data.usage_limit !== null &&
          data.usage_count !== null &&
          Number(data.usage_count) >= Number(data.usage_limit)
        ) {
          setAppliedDiscount(null);
          setDiscountError("This code has reached its usage limit");
          return;
        }

        const minOrderAmount = Number(data.minimum_order_amount ?? 0);
        if (subtotal < minOrderAmount) {
          setAppliedDiscount(null);
          setDiscountError(`Code available on orders from ${formatPrice(minOrderAmount)}`);
          return;
        }

        const discountType = data.type as DiscountType;
        const discountValue = Number(data.value);
        const amount = Math.min(subtotal, getDiscountAmount(discountType, discountValue, subtotal));

        if (amount <= 0) {
          setAppliedDiscount(null);
          setDiscountError("This code does not apply to your cart");
          return;
        }

        setAppliedDiscount({
          code: sanitizeText(data.code).toUpperCase(),
          type: discountType,
          value: discountValue,
          amount,
          description: data.description,
        });

        setDiscountSuccess(`Code ${sanitizeText(data.code).toUpperCase()} applied. You saved ${formatPrice(amount)}.`);
        return;
      }

      const fallbackCode = FALLBACK_DISCOUNT_CODES[candidateCode];
      if (!fallbackCode) {
        setAppliedDiscount(null);
        setDiscountError("This code is invalid");
        return;
      }

      if (subtotal < fallbackCode.minimumOrderAmount) {
        setAppliedDiscount(null);
        setDiscountError(`Code available on orders from ${formatPrice(fallbackCode.minimumOrderAmount)}`);
        return;
      }

      const amount = Math.min(subtotal, getDiscountAmount(fallbackCode.type, fallbackCode.value, subtotal));
      if (amount <= 0) {
        setAppliedDiscount(null);
        setDiscountError("This code does not apply to your cart");
        return;
      }

      setAppliedDiscount({
        code: candidateCode,
        type: fallbackCode.type,
        value: fallbackCode.value,
        amount,
        description: fallbackCode.description,
      });
      setDiscountSuccess(`Code ${candidateCode} applied. You saved ${formatPrice(amount)}.`);
    } catch {
      setDiscountError("Unable to validate this code right now");
    } finally {
      setIsApplyingDiscount(false);
    }
  }, [discountInput, isDiscountCodesEnabled, subtotal]);

  const goToCompletedStep = useCallback(
    (step: CheckoutStep) => {
      if (step === currentStep) {
        return;
      }

      if (completedSteps.includes(step)) {
        navigate(STEP_PATH[step]);
      }
    },
    [completedSteps, currentStep, navigate],
  );

  const selectSavedAddress = useCallback((address: SavedAddressCard) => {
    setSelectedSavedAddressId(address.id);
    setIsManualAddressOpen(false);

    const normalizedState = sanitizeText(address.state);
    const matchedRegion = GHANA_REGIONS.find(
      (region) => normalizeStateName(region) === normalizeStateName(normalizedState),
    );

    setDeliveryValues((previous) => ({
      ...previous,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: matchedRegion ?? "",
      country: "Ghana",
      deliveryInstructions: address.deliveryInstructions,
    }));

    setDeliveryErrors((previous) => {
      const next = { ...previous };
      delete next.addressLine1;
      delete next.city;
      delete next.state;
      delete next.country;
      return next;
    });
  }, []);

  const saveAddressForFutureOrders = useCallback(
    (address: SavedAddressCard) => {
      if (!currentUserId) {
        return;
      }

      const merged = mergeSavedAddresses([address, ...savedAddresses]);
      setSavedAddresses(merged);
      saveSavedAddressesToLocalStorage(currentUserId, merged);
    },
    [currentUserId, savedAddresses],
  );

  const validateCartBeforeSubmit = useCallback(
    async (cartItems: CartItem[]): Promise<CheckoutPreSubmitValidationResult> => {
      if (cartItems.length === 0) {
        return {
          valid: false,
          errors: ["Your cart is empty."],
          updatedItems: [],
          hasChanges: false,
        };
      }

      const productIds = [...new Set(cartItems.map((item) => item.product_id))];
      const variantIds = [
        ...new Set(cartItems.map((item) => item.variant_id).filter((variantId): variantId is string => Boolean(variantId))),
      ];

      const [productsResult, variantsResult] = await Promise.all([
        supabase
          .from("products")
          .select("id,name,is_available,stock_quantity,price,compare_at_price,has_variants")
          .in("id", productIds),
        variantIds.length > 0
          ? supabase
              .from("product_variants")
              .select("id,product_id,stock_quantity,is_available,price,compare_at_price")
              .in("id", variantIds)
          : Promise.resolve({ data: [] as CheckoutVariantAvailabilityRow[], error: null }),
      ]);

      if (productsResult.error) {
        throw productsResult.error;
      }

      if (variantsResult.error) {
        throw variantsResult.error;
      }

      const products = (productsResult.data ?? []) as CheckoutProductAvailabilityRow[];
      const variants = (variantsResult.data ?? []) as CheckoutVariantAvailabilityRow[];

      const productsById = new Map(products.map((product) => [product.id, product]));
      const variantsById = new Map(variants.map((variant) => [variant.id, variant]));

      const errors: string[] = [];
      const updatedItems: CartItem[] = [];

      for (const item of cartItems) {
        const product = productsById.get(item.product_id);
        const itemDisplayName = getItemDisplayName(item);

        if (!product) {
          errors.push(`${itemDisplayName} is no longer available and will be removed from your cart.`);
          continue;
        }

        if (product.is_available === false) {
          errors.push(`${itemDisplayName} is no longer available.`);
          continue;
        }

        if (item.variant_id) {
          const variant = variantsById.get(item.variant_id);

          if (!variant || variant.product_id !== item.product_id || variant.is_available === false) {
            errors.push(`${itemDisplayName} is no longer available.`);
            continue;
          }

          const variantStock = toStockQuantity(variant.stock_quantity);
          if (variantStock === 0) {
            errors.push(`${itemDisplayName} is out of stock.`);
            continue;
          }

          const normalizedVariantPrice =
            typeof variant.price === "number" && Number.isFinite(variant.price) ? variant.price : item.price;
          const normalizedVariantCompareAt =
            typeof variant.compare_at_price === "number" && Number.isFinite(variant.compare_at_price)
              ? variant.compare_at_price
              : item.compare_at_price;

          if (variantStock < item.quantity) {
            errors.push(`Only ${variantStock} left for ${itemDisplayName}. Your quantity has been adjusted.`);
            updatedItems.push({
              ...item,
              quantity: variantStock,
              stock_quantity: variantStock,
              price: normalizedVariantPrice,
              compare_at_price: normalizedVariantCompareAt,
            });
            continue;
          }

          updatedItems.push({
            ...item,
            stock_quantity: variantStock,
            price: normalizedVariantPrice,
            compare_at_price: normalizedVariantCompareAt,
          });
          continue;
        }

        const productStock = toStockQuantity(product.stock_quantity);
        if (productStock === 0) {
          errors.push(`${item.name} is out of stock.`);
          continue;
        }

        if (productStock < item.quantity) {
          errors.push(`Only ${productStock} left for ${item.name}. Your quantity has been adjusted.`);
          updatedItems.push({
            ...item,
            quantity: productStock,
            stock_quantity: productStock,
            price: product.price,
            compare_at_price: product.compare_at_price,
          });
          continue;
        }

        updatedItems.push({
          ...item,
          stock_quantity: productStock,
          price: product.price,
          compare_at_price: product.compare_at_price,
        });
      }

      const hasChanges =
        updatedItems.length !== cartItems.length ||
        updatedItems.some((updatedItem, index) => {
          const sourceItem = cartItems[index];
          if (!sourceItem) {
            return true;
          }

          return (
            updatedItem.product_id !== sourceItem.product_id ||
            updatedItem.variant_id !== sourceItem.variant_id ||
            updatedItem.quantity !== sourceItem.quantity ||
            updatedItem.stock_quantity !== sourceItem.stock_quantity ||
            updatedItem.price !== sourceItem.price ||
            updatedItem.compare_at_price !== sourceItem.compare_at_price
          );
        });

      return {
        valid: errors.length === 0 && updatedItems.length > 0,
        errors,
        updatedItems,
        hasChanges,
      };
    },
    [],
  );

  const handleConfirmOrder = useCallback(async () => {
    setSubmissionError(null);
    setCheckoutValidationErrors([]);

    const contactIsValid = validateContactStep();
    const deliveryIsValid = validateDeliveryStep();
    const paymentIsValid = validatePaymentStep();

    if (!contactIsValid) {
      setStepAdvanceError(ERROR_SUMMARY_TEXT);
      navigate(STEP_PATH.contact);
      return;
    }

    if (!deliveryIsValid) {
      setStepAdvanceError(ERROR_SUMMARY_TEXT);
      navigate(STEP_PATH.delivery);
      return;
    }

    if (!paymentIsValid) {
      setStepAdvanceError(
        hasNoAvailablePaymentMethods
          ? "No payment methods are currently available. Please contact the store."
          : ERROR_SUMMARY_TEXT,
      );
      navigate(STEP_PATH.payment);
      return;
    }

    if (shippingConfigurationError) {
      setSubmissionError(shippingConfigurationError);
      setStepAdvanceError(shippingConfigurationError);
      navigate(STEP_PATH.delivery);
      return;
    }

    setSubmissionPhase("verifying");

    try {
      const sanitizedContact = {
        firstName: sanitizeText(contactValues.firstName),
        lastName: sanitizeText(contactValues.lastName),
        email: sanitizeText(contactValues.email).toLowerCase(),
        phone: sanitizeText(contactValues.phone),
        marketingOptIn: contactValues.marketingOptIn,
      };

      const cleanAddress = {
        addressLine1: sanitizeText(decodeField(deliveryValues.addressLine1 ?? "")),
        addressLine2: sanitizeText(decodeField(deliveryValues.addressLine2 ?? "")),
        city: sanitizeText(decodeField(deliveryValues.city ?? "")),
        state: sanitizeText(decodeField(deliveryValues.state ?? "")),
        country: sanitizeText(decodeField(deliveryValues.country ?? "Ghana")) || "Ghana",
        deliveryInstructions: sanitizeMultilineText(decodeField(deliveryValues.deliveryInstructions ?? "")),
      };

      if (!cleanAddress.state) {
        setSubmissionError("Please select a region before confirming your order.");
        setStepAdvanceError(ERROR_SUMMARY_TEXT);
        setSubmissionPhase("idle");
        navigate(STEP_PATH.delivery);
        return;
      }

      const sanitizedReview = {
        orderNotes: sanitizeMultilineText(reviewValues.orderNotes),
      };
      const selectedPaymentMethod = paymentValues.method;
      if (!selectedPaymentMethod) {
        setSubmissionError("Please select a payment method to continue.");
        setSubmissionPhase("idle");
        return;
      }
      if (selectedPaymentMethod === "online" && !paystackConfig.publicKey) {
        setSubmissionError("Online payment is unavailable at the moment.");
        setSubmissionPhase("idle");
        return;
      }

      const preSubmitValidation = await validateCartBeforeSubmit(items);
      if (preSubmitValidation.hasChanges) {
        replaceItems(preSubmitValidation.updatedItems);
      }

      if (!preSubmitValidation.valid) {
        setCheckoutValidationErrors(
          preSubmitValidation.errors.length > 0
            ? preSubmitValidation.errors
            : ["Please review your cart before placing your order."],
        );
        setSubmissionPhase("idle");
        return;
      }

      const validatedItems = preSubmitValidation.updatedItems;
      const validatedSubtotal = validatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const customerId = currentUserId ?? null;

      let shippingRate: ShippingRateRow;
      try {
        shippingRate = await resolveShippingRateForState(cleanAddress.state);
      } catch {
        const shippingErrorMessage =
          cleanAddress.state && shippingRates.length > 0
            ? getNoShippingRateForStateError(cleanAddress.state)
            : SHIPPING_RATES_NOT_CONFIGURED_ERROR;
        setSubmissionError(shippingErrorMessage);
        setStepAdvanceError(shippingErrorMessage);
        setSubmissionPhase("idle");
        navigate(STEP_PATH.delivery);
        return;
      }
      const validatedShippingFee = Number(shippingRate.base_rate ?? 0);
      const isOnlinePayment = selectedPaymentMethod === "online";
      const validatedBaseTotal = Math.max(0, validatedSubtotal + validatedShippingFee - discountAmount);
      const validatedPaystackBuyerFee = isFreeTierStore && isOnlinePayment
        ? calculatePaystackBuyerFee(validatedBaseTotal)
        : 0;
      const validatedTotal = Math.max(0, validatedBaseTotal + validatedPaystackBuyerFee);

      setSubmissionPhase("submitting");

      const checkoutSignature = buildOnlineOrderSignature({
        firstName: sanitizedContact.firstName,
        lastName: sanitizedContact.lastName,
        email: sanitizedContact.email,
        phone: sanitizedContact.phone,
        addressLine1: cleanAddress.addressLine1,
        addressLine2: cleanAddress.addressLine2,
        city: cleanAddress.city,
        state: cleanAddress.state,
        country: cleanAddress.country,
        deliveryInstructions: cleanAddress.deliveryInstructions,
        orderNotes: sanitizedReview.orderNotes,
        subtotal: validatedSubtotal,
        shippingFee: validatedShippingFee,
        discountAmount,
        total: validatedTotal,
        items: validatedItems,
      });

      let orderNumberForCheckout = "";
      let createdNewOrder = false;

      if (isOnlinePayment && pendingOnlineOrder && pendingOnlineOrder.signature === checkoutSignature) {
        orderNumberForCheckout = pendingOnlineOrder.orderNumber;
      } else {
        const orderResponse = await submitOrderRpc({
          customerId,
          firstName: sanitizedContact.firstName,
          lastName: sanitizedContact.lastName,
          email: sanitizedContact.email,
          phone: sanitizedContact.phone,
          addressLine1: cleanAddress.addressLine1,
          addressLine2: cleanAddress.addressLine2,
          city: cleanAddress.city,
          state: cleanAddress.state,
          country: cleanAddress.country,
          deliveryInstructions: cleanAddress.deliveryInstructions,
          saveAddress: isLoggedIn && deliveryValues.saveForFuture,
          items: validatedItems,
          subtotal: validatedSubtotal,
          shippingFee: validatedShippingFee,
          discountAmount,
          total: validatedTotal,
          notes: sanitizedReview.orderNotes,
          paymentMethod: selectedPaymentMethod,
          mobileMoneyNumber: null,
          orderStatus: isOnlinePayment ? "pending_payment" : "confirmed",
          paymentStatus: "pending",
          marketingOptIn: sanitizedContact.marketingOptIn,
          ipAddress: "",
        });

        orderNumberForCheckout = orderResponse.order_number;
        createdNewOrder = true;

        if (isOnlinePayment) {
          setPendingOnlineOrder({
            orderNumber: orderResponse.order_number,
            signature: checkoutSignature,
          });
        } else {
          setPendingOnlineOrder(null);
        }
      }

      const finalizeCheckoutSession = (orderNumber: string) => {
        clearCart();

        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(CHECKOUT_SESSION_STORAGE_KEY);
          window.sessionStorage.removeItem(CHECKOUT_MODE_STORAGE_KEY);
          window.sessionStorage.setItem(LAST_ORDER_STORAGE_KEY, orderNumber);
        }
      };

      if (createdNewOrder && isLoggedIn && deliveryValues.saveForFuture) {
        const savedAddress: SavedAddressCard = {
          id: `local-${Date.now()}`,
          label: "Saved Address",
          recipientName: `${sanitizedContact.firstName} ${sanitizedContact.lastName}`.trim(),
          addressLine1: cleanAddress.addressLine1,
          addressLine2: cleanAddress.addressLine2,
          city: cleanAddress.city,
          state: cleanAddress.state,
          country: cleanAddress.country,
          deliveryInstructions: cleanAddress.deliveryInstructions,
        };

        saveAddressForFutureOrders(savedAddress);
      }

      if (!isOnlinePayment) {
        void triggerNewOrderAdminNotification(orderNumberForCheckout).catch((notificationError) => {
          if (import.meta.env.DEV) {
            console.warn("New-order admin notification trigger failed", notificationError);
          }
        });

        void triggerOrderConfirmationEmail(orderNumberForCheckout).catch((emailError) => {
          if (import.meta.env.DEV) {
            console.warn("Order confirmation email trigger failed", emailError);
          }
        });

        finalizeCheckoutSession(orderNumberForCheckout);
        navigate("/checkout/confirmation", { replace: true });
        return;
      }

      if (!orderNumberForCheckout) {
        throw new Error("Missing online order reference.");
      }

      const totalAmountInPesewas = Math.round(validatedTotal * 100);
      if (!Number.isFinite(totalAmountInPesewas) || totalAmountInPesewas <= 0) {
        throw new Error("Invalid online payment amount.");
      }

      const handler = PaystackPop.setup({
        key: paystackConfig.publicKey,
        email: sanitizedContact.email,
        amount: totalAmountInPesewas,
        currency: "GHS",
        ref: orderNumberForCheckout,
        metadata: getPaystackMetadata(),
        ...(paystackConfig.isSubaccountMode && paystackConfig.subaccountCode
          ? {
              subaccount: paystackConfig.subaccountCode,
              bearer: paystackConfig.bearer,
              transaction_charge: getTransactionCharge(validatedSubtotal),
            }
          : {}),
        onSuccess: () => {
          setPendingOnlineOrder(null);
          finalizeCheckoutSession(orderNumberForCheckout);
          setSubmissionPhase("idle");
          navigate(`/orders/${encodeURIComponent(orderNumberForCheckout)}`);
        },
        onCancel: () => {
          setSubmissionPhase("idle");
          const message = "Payment was cancelled. You can try again or choose a different method.";
          setStepAdvanceError(message);
          setSubmissionError(message);
          setPendingOnlineOrder((previous) =>
            previous ?? {
              orderNumber: orderNumberForCheckout,
              signature: checkoutSignature,
            },
          );
        },
      });

      handler.openIframe();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Checkout submission failed", error);
      }

      if (error instanceof OrderSubmissionError) {
        if (import.meta.env.DEV) {
          const rpcError = error.originalError as
            | { code?: string; message?: string; details?: string; hint?: string }
            | null;

          console.error("Checkout submission RPC details", {
            type: error.type,
            code: rpcError?.code ?? null,
            message: rpcError?.message ?? null,
            details: rpcError?.details ?? null,
            hint: rpcError?.hint ?? null,
          });
        }

        setSubmissionError(getOrderErrorMessage(error.type));
        if (error.type === "stock_conflict") {
          try {
            await validateCart();
          } catch (validationError) {
            if (import.meta.env.DEV) {
              console.error("Failed to refresh cart after stock conflict", validationError);
            }
          }
        }
      } else if (isLikelyTimeoutError(error)) {
        setSubmissionError(getOrderErrorMessage("timeout"));
      } else {
        setSubmissionError(getOrderErrorMessage("generic"));
      }

      setSubmissionPhase("idle");
    }
  }, [
    clearCart,
    contactValues,
    currentUserId,
    deliveryValues,
    discountAmount,
    hasNoAvailablePaymentMethods,
    shippingConfigurationError,
    isFreeTierStore,
    isLoggedIn,
    items,
    navigate,
    pendingOnlineOrder,
    paystackConfig.bearer,
    paystackConfig.isSubaccountMode,
    paystackConfig.publicKey,
    paystackConfig.subaccountCode,
    paymentValues.method,
    replaceItems,
    reviewValues.orderNotes,
    saveAddressForFutureOrders,
    shippingRates.length,
    validateCart,
    validateCartBeforeSubmit,
    validateContactStep,
    validateDeliveryStep,
    validatePaymentStep,
  ]);

  const renderOrderSummary = (isMobile: boolean) => (
    <div className={`${isMobile ? "" : "sticky top-[112px]"}`}>
      <h3 className="mb-6 font-display text-[22px] italic text-[var(--color-primary)]">Order Summary</h3>

      <div className="space-y-3 border-b border-[var(--color-border)] pb-4">
        {items.map((item) => (
          <div key={`${item.product_id}-${item.variant_id ?? "base"}`}>
            <div className="flex items-start gap-3">
              <img
                src={item.image_url || "/placeholder.svg"}
                alt={item.image_alt}
                className="h-[64px] w-[48px] flex-shrink-0 object-cover"
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.src = "/placeholder.svg";
                }}
              />

              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[14px] italic text-[var(--color-muted)]">{item.name}</p>
                {item.variant_label ? (
                  <p className="mt-[3px] mb-[6px] font-body text-[10px] tracking-[0.05em] text-[var(--color-muted)]">
                    {item.variant_label}
                  </p>
                ) : null}
                <p className="font-body text-[11px] text-[var(--color-muted)]">Qty: {item.quantity}</p>
              </div>

              <p className="text-right font-body text-[12px] text-[var(--color-primary)]">
                {formatPrice(item.price * item.quantity)}
              </p>
            </div>
            <div className="mt-3 border-b border-[var(--color-border)]" />
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2 font-body text-[12px]">
        <div className="flex items-center justify-between text-[var(--color-muted)]">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>

        <div className="flex items-center justify-between text-[var(--color-muted)]">
          <span>Shipping</span>
          <span>{shippingSidebarValue}</span>
        </div>

        {isDiscountCodesEnabled && appliedDiscount ? (
          <div className="flex items-center justify-between text-[var(--color-accent)]">
            <span>Discount</span>
            <span>- {formatPrice(discountAmount)}</span>
          </div>
        ) : null}

        {isPaystackBuyerFeeApplicable ? (
          <div className="flex items-center justify-between text-[var(--color-muted)]">
            <span>Paystack Fee ({PAYSTACK_BUYER_FEE_PERCENT}%)</span>
            <span>{formatPrice(paystackBuyerFee)}</span>
          </div>
        ) : null}
      </div>

      <div className="my-4 border-b border-[var(--color-border)]" />

      <div className="flex items-center justify-between font-body text-[14px] font-medium text-[var(--color-primary)]">
        <span>Order Total</span>
        <span>{formatPrice(orderTotal)}</span>
      </div>

      {isDiscountCodesEnabled ? (
        <div className="mt-7">
          <div className="relative">
            <input
              id={isMobile ? "discount-mobile" : "discount-desktop"}
              value={discountInput}
              onChange={(event) => {
                setDiscountInput(event.target.value);
                setDiscountError(null);
                setDiscountSuccess(null);
              }}
              placeholder=" "
              className="w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-[10px] pt-[16px] font-body text-[16px] text-[var(--color-primary)] transition-colors duration-200 placeholder:text-transparent focus:border-[var(--color-primary)] focus:outline-none md:text-[14px]"
            />
            <label
              htmlFor={isMobile ? "discount-mobile" : "discount-desktop"}
              className={`pointer-events-none absolute left-0 font-body transition-all duration-200 ${
                discountInput.trim().length > 0
                  ? "top-[2px] text-[10px] uppercase tracking-[0.12em] text-[var(--color-accent)]"
                  : "top-[20px] text-[14px] text-[var(--color-muted)]"
              }`}
            >
              Discount code
            </label>
          </div>

          <button
            type="button"
            onClick={() => void handleApplyDiscount()}
            disabled={isApplyingDiscount}
            className="mt-2 ml-auto block font-body text-[11px] uppercase tracking-[0.12em] text-[var(--color-accent)] transition-colors hover:text-[var(--color-primary)] disabled:opacity-60"
          >
            {isApplyingDiscount ? "Applying..." : "Apply"}
          </button>

          {discountSuccess ? <p className="mt-2 font-body text-[11px] text-[var(--color-success)]">{discountSuccess}</p> : null}
          {discountError ? <p className="mt-2 font-body text-[11px] text-[var(--color-danger)]">{discountError}</p> : null}
        </div>
      ) : null}

      {isValidating ? (
        <p className="mt-5 font-body text-[11px] text-[var(--color-muted)]">Verifying latest prices and stock...</p>
      ) : null}
    </div>
  );

  if (!isHydrated) {
    return null;
  }

  return (
    <div className="bg-[var(--color-secondary)] pb-[60px] pt-[80px]">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
        <button
          type="button"
          onClick={() => setIsMobileSummaryOpen(true)}
          className="sticky top-[72px] z-30 mb-6 flex h-[52px] w-full items-center justify-between bg-[var(--color-primary)] px-4 lg:hidden"
        >
          <span className="font-body text-[12px] text-[var(--color-secondary)]">
            {orderItemCountLabel} {"\u00B7"} {formatPrice(subtotal)}
          </span>
          <ChevronDown className="h-4 w-4 text-[var(--color-secondary)]" />
        </button>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section className="w-full max-w-[560px]">
            <div className="mb-8 hidden md:block">
              <div className="flex items-start">
                {CHECKOUT_STEPS.map((step, index) => {
                  const isActive = step === currentStep;
                  const isCompleted = completedSteps.includes(step);
                  const canNavigate = isCompleted && !isActive;
                  const connectorCompleted = index < CHECKOUT_STEPS.length - 1 && completedSteps.includes(step);

                  return (
                    <div key={step} className="flex flex-1 items-start">
                      <button
                        type="button"
                        onClick={() => goToCompletedStep(step)}
                        disabled={!canNavigate}
                        className={`flex flex-col items-center ${
                          canNavigate ? "cursor-pointer" : "cursor-default"
                        } disabled:opacity-100`}
                      >
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-medium ${
                            isActive
                              ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-secondary)]"
                              : isCompleted
                                ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-secondary)]"
                                : "border-[var(--color-border)] bg-transparent text-[var(--color-muted-soft)]"
                          }`}
                        >
                          {isCompleted && !isActive ? <Check className="h-3.5 w-3.5" /> : index + 1}
                        </span>

                        <span
                          className={`mt-2 font-body text-[10px] uppercase tracking-[0.12em] ${
                            isActive ? "text-[var(--color-primary)]" : isCompleted ? "text-[var(--color-accent)]" : "text-[var(--color-muted-soft)]"
                          }`}
                        >
                          {STEP_LABEL[step]}
                        </span>
                      </button>

                      {index < CHECKOUT_STEPS.length - 1 ? (
                        <span
                          className={`mt-3 mx-3 h-px flex-1 border-t ${
                            connectorCompleted ? "border-[var(--color-accent)]" : "border-[var(--color-border)]"
                          }`}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mb-8 flex items-center justify-between md:hidden">
              <p className="font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-primary)]">
                {STEP_LABEL[currentStep]}
              </p>
              <p className="font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
                Step {currentStepIndex + 1} of {CHECKOUT_STEPS.length}
              </p>
            </div>

            {currentStep === "contact" ? (
              <div>
                <h1 className="font-display text-[32px] italic text-[var(--color-primary)]">Contact Information</h1>
                {isGuestCheckout ? (
                  <p className="mt-2 font-body text-[11px] text-[var(--color-muted-soft)]">
                    Checking out as guest &#183;{" "}
                    <Link
                      to={signInModalPath}
                      onClick={handleSignInInstead}
                      className="text-[var(--color-accent)] transition-colors hover:text-[var(--color-primary)]"
                    >
                      Sign in instead
                    </Link>
                  </p>
                ) : null}

                {shouldShowSavedDetailsPrompt ? (
                  <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[rgba(var(--color-navbar-solid-foreground-rgb),0.08)] px-5 py-4">
                    <div className="flex items-center">
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-[var(--color-accent)]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <circle cx="12" cy="9.25" r="2.25" />
                        <path d="M8.9 16.4c.9-1.5 2.03-2.25 3.1-2.25s2.2.75 3.1 2.25" />
                      </svg>
                      <p className="ml-2 font-body text-[12px] text-[var(--color-primary)]">Use your saved details?</p>
                    </div>

                    <div className="ml-auto flex items-center">
                      <button
                        type="button"
                        onClick={handleUseSavedDetails}
                        className="rounded-[var(--border-radius)] bg-[var(--color-primary)] px-5 py-2 font-body text-[10px] uppercase tracking-[0.15em] text-[var(--color-secondary)] transition-all duration-200 ease-in-out hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)]"
                      >
                        Use Saved Details
                      </button>

                      <button
                        type="button"
                        onClick={handleDismissSavedDetails}
                        className="ml-4 font-body text-[10px] uppercase tracking-[0.15em] text-[var(--color-muted-soft)] transition-colors duration-200 hover:text-[var(--color-primary)]"
                      >
                        No thanks
                      </button>
                    </div>
                  </div>
                ) : null}

                {isSavedDetailsConfirmationVisible ? (
                  <p
                    className={`mb-8 font-body text-[10px] text-[var(--color-accent)] transition-opacity duration-700 ${
                      isSavedDetailsConfirmationFading ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    Details filled from your profile - edit anything before continuing
                  </p>
                ) : null}

                <div
                  className={`grid gap-x-6 md:grid-cols-2 ${
                    shouldShowSavedDetailsPrompt || isSavedDetailsConfirmationVisible ? "mt-0" : "mt-5"
                  }`}
                >
                  <FloatingInput
                    id="checkout-first-name"
                    label="First Name"
                    required
                    value={contactValues.firstName}
                    autoComplete="given-name"
                    touched={contactTouched.firstName}
                    error={contactErrors.firstName}
                    onChange={(value) =>
                      setContactValues((previous) => ({
                        ...previous,
                        firstName: value,
                      }))
                    }
                    onBlur={() => handleContactBlur("firstName")}
                  />

                  <FloatingInput
                    id="checkout-last-name"
                    label="Last Name"
                    required
                    value={contactValues.lastName}
                    autoComplete="family-name"
                    touched={contactTouched.lastName}
                    error={contactErrors.lastName}
                    onChange={(value) =>
                      setContactValues((previous) => ({
                        ...previous,
                        lastName: value,
                      }))
                    }
                    onBlur={() => handleContactBlur("lastName")}
                  />
                </div>

                <FloatingInput
                  id="checkout-email"
                  label="Email"
                  required
                  type="email"
                  autoComplete="email"
                  value={contactValues.email}
                  touched={contactTouched.email}
                  error={contactErrors.email}
                  helperText="We'll send your order confirmation here"
                  onChange={(value) =>
                    setContactValues((previous) => ({
                      ...previous,
                      email: value,
                    }))
                  }
                  onBlur={() => handleContactBlur("email")}
                />

                <FloatingInput
                  id="checkout-phone"
                  label="Phone"
                  required
                  type="tel"
                  autoComplete="tel"
                  value={contactValues.phone}
                  touched={contactTouched.phone}
                  error={contactErrors.phone}
                  helperText={GHANAIAN_PHONE_HELPER_TEXT}
                  onChange={(value) =>
                    setContactValues((previous) => ({
                      ...previous,
                      phone: value,
                    }))
                  }
                  onBlur={() => handleContactBlur("phone")}
                />

                <label className="mt-7 inline-flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={contactValues.marketingOptIn}
                    onChange={(event) =>
                      setContactValues((previous) => ({
                        ...previous,
                        marketingOptIn: event.target.checked,
                      }))
                    }
                    className="sr-only"
                  />
                  <span
                    className={`mt-[2px] flex h-4 w-4 items-center justify-center border ${
                      contactValues.marketingOptIn ? "border-[var(--color-primary)] bg-[var(--color-primary)]" : "border-[var(--color-border)] bg-transparent"
                    }`}
                  >
                    {contactValues.marketingOptIn ? <Check className="h-3 w-3 text-white" /> : null}
                  </span>
                  <span className="font-body text-[12px] text-[var(--color-muted)]">
                    Send me updates on new arrivals and offers
                  </span>
                </label>

                <div className="mt-10">
                  {stepAdvanceError ? (
                    <p className="mb-3 font-body text-[12px] text-[var(--color-danger)]">{stepAdvanceError}</p>
                  ) : null}

                  <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="self-start font-body text-[11px] uppercase tracking-[0.12em] text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
                    >
                      &larr; Back
                    </button>

                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="w-full rounded-[var(--border-radius)] bg-[var(--color-primary)] px-12 py-4 font-body text-[11px] uppercase tracking-[0.18em] text-[var(--color-secondary)] transition-colors duration-300 hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)] md:w-auto"
                    >
                      Next Step
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {currentStep === "delivery" ? (
              <div>
                <h1 className="font-display text-[32px] italic text-[var(--color-primary)]">Delivery Address</h1>

                {isSessionChecked && isLoggedIn && savedAddresses.length > 0 ? (
                  <div className="mt-6">
                    <div className="grid gap-3 md:grid-cols-2">
                      {savedAddresses.map((address) => {
                        const isSelected = selectedSavedAddressId === address.id;
                        return (
                          <button
                            key={address.id}
                            type="button"
                            onClick={() => selectSavedAddress(address)}
                            className={`border p-3 text-left transition-colors ${
                              isSelected ? "border-[var(--color-primary)]" : "border-[var(--color-border)] hover:border-[var(--color-primary)]"
                            }`}
                          >
                            <p className="font-body text-[12px] text-[var(--color-primary)]">{address.label}</p>
                            <p className="font-body text-[12px] text-[var(--color-primary)]">{address.recipientName || "Saved recipient"}</p>
                            <p className="truncate font-body text-[12px] text-[var(--color-muted)]">{address.addressLine1}</p>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsManualAddressOpen(true);
                        setSelectedSavedAddressId(null);
                      }}
                      className="mt-3 font-body text-[11px] uppercase tracking-[0.12em] text-[var(--color-accent)] transition-colors hover:text-[var(--color-primary)]"
                    >
                      Use a different address
                    </button>
                  </div>
                ) : null}

                {isManualAddressOpen || savedAddresses.length === 0 ? (
                  <div className="mt-4">
                    <FloatingInput
                      id="checkout-address-line-1"
                      label="Address Line 1"
                      required
                      autoComplete="address-line1"
                      value={deliveryValues.addressLine1}
                      touched={deliveryTouched.addressLine1}
                      error={deliveryErrors.addressLine1}
                      onChange={(value) =>
                        setDeliveryValues((previous) => ({
                          ...previous,
                          addressLine1: value,
                        }))
                      }
                      onBlur={() => handleDeliveryBlur("addressLine1")}
                    />

                    <FloatingInput
                      id="checkout-address-line-2"
                      label="Apartment, suite, landmark (optional)"
                      autoComplete="address-line2"
                      value={deliveryValues.addressLine2}
                      onChange={(value) =>
                        setDeliveryValues((previous) => ({
                          ...previous,
                          addressLine2: value,
                        }))
                      }
                      onBlur={() => undefined}
                    />

                    <div className="grid gap-x-6 md:grid-cols-2">
                      <FloatingInput
                        id="checkout-city"
                        label="Town / City"
                        required
                        autoComplete="address-level2"
                        value={deliveryValues.city}
                        touched={deliveryTouched.city}
                        error={deliveryErrors.city}
                        onChange={(value) =>
                          setDeliveryValues((previous) => ({
                            ...previous,
                            city: value,
                          }))
                        }
                        onBlur={() => handleDeliveryBlur("city")}
                      />

                      <SearchableStateField
                        label="Region"
                        required
                        value={deliveryValues.state}
                        options={GHANA_REGIONS}
                        touched={deliveryTouched.state}
                        error={deliveryErrors.state}
                        onChange={(value) =>
                          setDeliveryValues((previous) => ({
                            ...previous,
                            state: value,
                          }))
                        }
                        onBlur={() => handleDeliveryBlur("state")}
                      />
                    </div>

                    {deliveryValues.state && shippingQuote ? (
                      <p className="mt-2 font-body text-[11px] text-[var(--color-muted)]">
                        Delivery to {deliveryValues.state}: {formatPrice(shippingQuote.fee)} {"\u00B7"}{" "}
                        {shippingQuote.minDays}-
                        {shippingQuote.maxDays} business days
                      </p>
                    ) : null}

                    {deliveryValues.state && !shippingQuote && !isShippingRatesLoading ? (
                      <p className="mt-2 font-body text-[11px] text-[var(--color-danger)]">
                        {shippingConfigurationError || getNoShippingRateForStateError(deliveryValues.state)}
                      </p>
                    ) : null}

                    <FloatingSelect
                      id="checkout-country"
                      label="Country"
                      required
                      value={deliveryValues.country}
                      options={COUNTRY_OPTIONS}
                      touched={deliveryTouched.country}
                      error={deliveryErrors.country}
                      onChange={(value) =>
                        setDeliveryValues((previous) => ({
                          ...previous,
                          country: value,
                        }))
                      }
                      onBlur={() => handleDeliveryBlur("country")}
                    />

                    <FloatingTextarea
                      id="checkout-delivery-instructions"
                      label="Delivery instructions"
                      value={deliveryValues.deliveryInstructions}
                      placeholder="Gate code, building color, any helpful details..."
                      touched={deliveryTouched.deliveryInstructions}
                      error={deliveryErrors.deliveryInstructions}
                      maxLength={200}
                      showCharacterCount
                      onChange={(value) =>
                        setDeliveryValues((previous) => ({
                          ...previous,
                          deliveryInstructions: value.slice(0, 200),
                        }))
                      }
                      onBlur={() => handleDeliveryBlur("deliveryInstructions")}
                    />
                  </div>
                ) : null}

                {isSessionChecked && isLoggedIn ? (
                  <label className="mt-6 inline-flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={deliveryValues.saveForFuture}
                      onChange={(event) =>
                        setDeliveryValues((previous) => ({
                          ...previous,
                          saveForFuture: event.target.checked,
                        }))
                      }
                      className="sr-only"
                    />
                    <span
                      className={`mt-[2px] flex h-4 w-4 items-center justify-center border ${
                        deliveryValues.saveForFuture ? "border-[var(--color-primary)] bg-[var(--color-primary)]" : "border-[var(--color-border)] bg-transparent"
                      }`}
                    >
                      {deliveryValues.saveForFuture ? <Check className="h-3 w-3 text-white" /> : null}
                    </span>
                    <span className="font-body text-[12px] text-[var(--color-muted)]">Save this address for future orders</span>
                  </label>
                ) : null}

                <div className="mt-10">
                  {stepAdvanceError ? (
                    <p className="mb-3 font-body text-[12px] text-[var(--color-danger)]">{stepAdvanceError}</p>
                  ) : null}

                  <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="self-start font-body text-[11px] uppercase tracking-[0.12em] text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
                    >
                      &larr; Back
                    </button>

                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="w-full rounded-[var(--border-radius)] bg-[var(--color-primary)] px-12 py-4 font-body text-[11px] uppercase tracking-[0.18em] text-[var(--color-secondary)] transition-colors duration-300 hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)] md:w-auto"
                    >
                      Next Step
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {currentStep === "payment" ? (
              <div>
                <h1 className="font-display text-[32px] italic text-[var(--color-primary)]">How would you like to pay?</h1>

                {paymentSettings === null ? (
                  <p className="mt-6 font-body text-[12px] text-[var(--color-muted)]">Loading payment methods...</p>
                ) : hasNoAvailablePaymentMethods ? (
                  <p className="font-body text-[12px] text-[var(--color-danger)]">
                    No payment methods are currently available. Please contact the store.
                  </p>
                ) : isFreeTierStore && onlinePaymentAvailable ? (
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentValues({
                          method: "online",
                        });
                      }}
                      className={`w-full rounded-[var(--border-radius)] border px-6 py-7 text-left transition-colors duration-200 ${
                        paymentValues.method === "online" ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"
                      }`}
                      style={{
                        backgroundColor:
                          paymentValues.method === "online" ? "rgba(var(--color-navbar-solid-foreground-rgb),0.08)" : "transparent",
                      }}
                    >
                      <CreditCard size={28} strokeWidth={1.25} className="mb-4 text-[var(--color-accent)]" />
                      <p className="font-display text-[18px] italic text-[var(--color-primary)]">Pay Online</p>
                      <p className="mt-1 font-body text-[11px] font-light text-[var(--color-muted)]">
                        Pay securely with card or mobile money
                      </p>
                      <p className="mt-3 font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-accent)]">
                        Powered by Paystack
                      </p>
                    </button>
                  </div>
                ) : shouldRenderPaymentMethodChoice ? (
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {onlinePaymentAvailable ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentValues({
                            method: "online",
                          });
                        }}
                        className={`rounded-[var(--border-radius)] border px-6 py-7 text-left transition-colors duration-200 ${
                          paymentValues.method === "online" ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"
                        }`}
                        style={{
                          backgroundColor:
                            paymentValues.method === "online" ? "rgba(var(--color-navbar-solid-foreground-rgb),0.08)" : "transparent",
                        }}
                      >
                        <CreditCard size={28} strokeWidth={1.25} className="mb-4 text-[var(--color-accent)]" />
                        <p className="font-display text-[18px] italic text-[var(--color-primary)]">Pay Online</p>
                        <p className="mt-1 font-body text-[11px] font-light text-[var(--color-muted)]">
                          Pay securely with card or mobile money via Paystack
                        </p>
                      </button>
                    ) : null}

                    {cashOnDeliveryAvailable ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentValues({
                            method: "cash_on_delivery",
                          });
                        }}
                        className={`rounded-[var(--border-radius)] border px-6 py-7 text-left transition-colors duration-200 ${
                          paymentValues.method === "cash_on_delivery"
                            ? "border-[var(--color-primary)]"
                            : "border-[var(--color-border)]"
                        }`}
                        style={{
                          backgroundColor:
                            paymentValues.method === "cash_on_delivery" ? "rgba(var(--color-navbar-solid-foreground-rgb),0.08)" : "transparent",
                        }}
                      >
                        <Banknote size={28} strokeWidth={1.25} className="mb-4 text-[var(--color-accent)]" />
                        <p className="font-display text-[18px] italic text-[var(--color-primary)]">Cash on Delivery</p>
                        <p className="mt-1 font-body text-[11px] font-light text-[var(--color-muted)]">
                          Pay in cash when your order arrives
                        </p>
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-10">
                  {stepAdvanceError ? (
                    <p className="mb-3 font-body text-[12px] text-[var(--color-danger)]">{stepAdvanceError}</p>
                  ) : null}

                  <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="self-start font-body text-[11px] uppercase tracking-[0.12em] text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
                    >
                      &larr; Back
                    </button>

                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="w-full rounded-[var(--border-radius)] bg-[var(--color-primary)] px-12 py-4 font-body text-[11px] uppercase tracking-[0.18em] text-[var(--color-secondary)] transition-colors duration-300 hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)] md:w-auto"
                    >
                      Next Step
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {currentStep === "review" ? (
              <div>
                <h1 className="font-display text-[32px] italic text-[var(--color-primary)]">Review Your Order</h1>

                <div className="mt-6 space-y-4 border-b border-[var(--color-border)] pb-6">
                  {items.map((item) => (
                    <div key={`${item.product_id}-${item.variant_id ?? "base"}`} className="flex items-start gap-4">
                      <img
                        src={item.image_url || "/placeholder.svg"}
                        alt={item.image_alt}
                        className="h-[96px] w-[72px] flex-shrink-0 object-cover"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.src = "/placeholder.svg";
                        }}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="font-display text-[16px] italic text-[var(--color-muted)]">{item.name}</p>
                        {item.variant_label ? (
                          <p className="mt-[3px] mb-[6px] font-body text-[10px] tracking-[0.05em] text-[var(--color-muted)]">
                            {item.variant_label}
                          </p>
                        ) : null}
                        <p className="font-body text-[12px] text-[var(--color-muted)]">Qty: {item.quantity}</p>
                      </div>

                      <p className="font-body text-[13px] text-[var(--color-primary)]">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 space-y-2 border-b border-[var(--color-border)] pb-6">
                  <div className="flex items-center justify-between font-body text-[12px] text-[var(--color-muted)]">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between font-body text-[12px] text-[var(--color-muted)]">
                    <span>Shipping</span>
                    <span>{shippingQuote ? formatPrice(shippingQuote.fee) : deliveryValues.state ? "Unavailable" : "Select region"}</span>
                  </div>

                  {isDiscountCodesEnabled && appliedDiscount ? (
                    <div className="flex items-center justify-between font-body text-[12px] text-[var(--color-accent)]">
                      <span>Discount</span>
                      <span>- {formatPrice(discountAmount)}</span>
                    </div>
                  ) : null}

                  {isPaystackBuyerFeeApplicable ? (
                    <div className="flex items-center justify-between font-body text-[12px] text-[var(--color-muted)]">
                      <span>Paystack Fee ({PAYSTACK_BUYER_FEE_PERCENT}%)</span>
                      <span>{formatPrice(paystackBuyerFee)}</span>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between font-body text-[14px] font-medium text-[var(--color-primary)]">
                    <span>Total</span>
                    <span>{formatPrice(orderTotal)}</span>
                  </div>
                </div>

                {!shippingQuote && (deliveryValues.state || shippingRatesLoadError || !hasConfiguredShippingRates) ? (
                  <p className="mt-3 font-body text-[12px] text-[var(--color-danger)]">
                    {shippingConfigurationError || SHIPPING_RATES_NOT_CONFIGURED_ERROR}
                  </p>
                ) : null}

                <div className="mt-6 border-b border-[var(--color-border)] pb-6">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-accent)]">Delivering to</p>
                    <button
                      type="button"
                      onClick={() => navigate(STEP_PATH.delivery)}
                      className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
                    >
                      Edit
                    </button>
                  </div>

                  <p className="font-body text-[13px] text-[var(--color-muted)]">
                    {deliveryValues.addressLine1}
                    {deliveryValues.addressLine2 ? `, ${deliveryValues.addressLine2}` : ""}
                    <br />
                    {deliveryValues.city}, {deliveryValues.state}
                    <br />
                    {deliveryValues.country}
                  </p>
                </div>

                <div className="mt-6 border-b border-[var(--color-border)] pb-6">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-accent)]">Contact</p>
                    <button
                      type="button"
                      onClick={() => navigate(STEP_PATH.contact)}
                      className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
                    >
                      Edit
                    </button>
                  </div>

                  <p className="font-body text-[13px] text-[var(--color-muted)]">
                    {contactValues.firstName} {contactValues.lastName}
                    <br />
                    {contactValues.email}
                  </p>
                </div>

                <div className="mt-6 border-b border-[var(--color-border)] pb-6">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-body text-[10px] uppercase tracking-[0.12em] text-[var(--color-accent)]">Payment</p>
                    <button
                      type="button"
                      onClick={() => navigate(STEP_PATH.payment)}
                      className="font-body text-[11px] uppercase tracking-[0.1em] text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
                    >
                      Edit
                    </button>
                  </div>

                  <p className="font-body text-[13px] text-[var(--color-muted)]">
                    {selectedPaymentLabel}
                  </p>
                </div>

                <FloatingTextarea
                  id="checkout-order-notes"
                  label="Order Notes (optional)"
                  value={reviewValues.orderNotes}
                  placeholder="Any special instructions..."
                  onChange={(value) =>
                    setReviewValues((previous) => ({
                      ...previous,
                      orderNotes: value,
                    }))
                  }
                  onBlur={() => undefined}
                />

                <div className="mt-8">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="mb-4 font-body text-[11px] uppercase tracking-[0.12em] text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
                  >
                    &larr; Back
                  </button>

                  <p className="mb-4 font-body text-[11px] text-[var(--color-muted-soft)]">
                    By placing your order you agree to our{" "}
                    <Link to="/contact" className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]">
                      Terms &amp; Conditions
                    </Link>{" "}
                    and{" "}
                    <Link to="/contact" className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]">
                      Privacy Policy
                    </Link>
                  </p>

                  {checkoutValidationErrors.length > 0 ? (
                    <div className="mb-3">
                      <p className="mb-2 font-body text-[12px] font-medium text-[var(--color-danger)]">
                        Please review the following before placing your order:
                      </p>
                      <div className="space-y-1">
                        {checkoutValidationErrors.map((error, index) => (
                          <p key={`checkout-validation-error-${index}`} className="font-body text-[12px] text-[var(--color-danger)]">
                            <span className="mr-1" aria-hidden="true">
                              &middot;
                            </span>
                            {error}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {submissionError ? (
                    <p className="mb-3 font-body text-[12px] text-[var(--color-danger)]">{submissionError}</p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void handleConfirmOrder()}
                    disabled={submissionPhase !== "idle"}
                    className="w-full rounded-[var(--border-radius)] bg-[var(--color-primary)] px-4 py-5 font-body text-[11px] uppercase tracking-[0.18em] text-[var(--color-secondary)] transition-colors duration-300 hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)] disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-65"
                  >
                    {submissionPhase === "verifying"
                      ? "Verifying..."
                      : submissionPhase === "submitting"
                        ? "Placing Order..."
                        : "Confirm Order"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <aside className="hidden border-l border-[var(--color-border)] pl-12 lg:block">{renderOrderSummary(false)}</aside>
        </div>
      </div>

      {isMobileSummaryOpen ? (
        <div className="fixed inset-0 z-[90] bg-black/35 lg:hidden">
          <button
            type="button"
            onClick={() => setIsMobileSummaryOpen(false)}
            aria-label="Close order summary"
            className="absolute inset-0"
          />

          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto bg-[var(--color-secondary)] px-5 pb-6 pt-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-body text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                {orderItemCountLabel} {"\u00B7"} {formatPrice(subtotal)}
              </p>
              <button
                type="button"
                onClick={() => setIsMobileSummaryOpen(false)}
                className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {renderOrderSummary(true)}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Checkout;



