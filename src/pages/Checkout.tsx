import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Banknote, Check, ChevronDown, Smartphone, X } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCart } from "@/contexts/CartContext";
import { formatPrice } from "@/data/products";
import type { Json } from "@/integrations/supabase/types";
import {
  fetchActiveShippingRates,
  fetchCheckoutSessionData,
  fetchDiscountCode,
  getOrderErrorMessage,
  type ShippingRateRow,
  OrderSubmissionError,
  resolveCustomerIdForOrder,
  resolveShippingRateForState,
  submitOrderRpc,
} from "@/services/orderService";
import { validateCartStock } from "@/services/stockService";

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

type PaymentMethod = "mobile_money" | "cash_on_delivery";

interface PaymentFormValues {
  method: PaymentMethod;
  mobileMoneyNumber: string;
}

type PaymentField = "mobileMoneyNumber";

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

const CHECKOUT_SESSION_STORAGE_KEY = "luxuriant_checkout_session_v1";
const SAVED_ADDRESS_STORAGE_KEY_PREFIX = "luxuriant_saved_addresses";

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

const NIGERIA_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
  "FCT Abuja",
];

const COUNTRY_OPTIONS = ["Nigeria", "Ghana", "Kenya", "South Africa", "United Kingdom", "United States"];

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
  country: "Nigeria",
  deliveryInstructions: "",
  saveForFuture: false,
};

const DEFAULT_REVIEW_VALUES: ReviewFormValues = {
  orderNotes: "",
};

const DEFAULT_PAYMENT_VALUES: PaymentFormValues = {
  method: "cash_on_delivery",
  mobileMoneyNumber: "",
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
    description: "Save 1500 NGN on orders over 10000 NGN",
  },
};

const ERROR_SUMMARY_TEXT = "Please fix the errors above before continuing";

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
  const cleaned = value.toLowerCase().replace(/[().,-]/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.includes("fct") || cleaned.includes("federal capital territory") || cleaned === "abuja") {
    return "fct abuja";
  }
  return cleaned;
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
  if (normalized === "/checkout" || normalized === "") {
    return "contact";
  }

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

  return "contact";
};

const parseStateListFromJson = (value: Json | null): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => normalizeStateName(entry));
};

const getFallbackShippingQuote = (state: string): ShippingQuote => {
  const normalized = normalizeStateName(state);

  if (normalized === "lagos") {
    return {
      state,
      fee: 1800,
      minDays: 1,
      maxDays: 2,
    };
  }

  if (normalized === "fct abuja") {
    return {
      state,
      fee: 2600,
      minDays: 2,
      maxDays: 3,
    };
  }

  return {
    state,
    fee: 3500,
    minDays: 3,
    maxDays: 5,
  };
};

const resolveShippingQuote = (state: string, rates: ShippingRateRow[]): ShippingQuote => {
  const normalizedState = normalizeStateName(state);

  if (!normalizedState) {
    return getFallbackShippingQuote(state);
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

  return getFallbackShippingQuote(state);
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
      const country = sanitizeText(readString(entry.country, "Nigeria"));

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
    const normalized = trimmed.replace(/[\s()-]/g, "");
    const phonePattern = /^(?:\+234|234|0)[789]\d{9}$/;
    if (!phonePattern.test(normalized)) {
      return "Enter a valid Nigerian phone number";
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
      city: "City",
      state: "State",
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

const getPaymentFieldError = (
  field: PaymentField,
  method: PaymentMethod,
  value: string,
): string | undefined => {
  if (field !== "mobileMoneyNumber" || method !== "mobile_money") {
    return undefined;
  }

  const trimmed = sanitizeText(value);
  if (!trimmed) {
    return "Mobile Money number is required";
  }

  const normalized = trimmed.replace(/[\s()-]/g, "");
  const ghanaMobilePattern = /^(?:\+233|233|0)(?:2[0-9]|5[0-9])[0-9]{7}$/;
  if (!ghanaMobilePattern.test(normalized)) {
    return "Enter a valid Ghanaian mobile number";
  }

  return undefined;
};

const validatePaymentForm = (values: PaymentFormValues): Partial<Record<PaymentField, string>> => {
  const errors: Partial<Record<PaymentField, string>> = {};
  const numberError = getPaymentFieldError("mobileMoneyNumber", values.method, values.mobileMoneyNumber);

  if (numberError) {
    errors.mobileMoneyNumber = numberError;
  }

  return errors;
};

const isContactComplete = (values: ContactFormValues): boolean => Object.keys(validateContactForm(values)).length === 0;
const isDeliveryComplete = (values: DeliveryFormValues): boolean => Object.keys(validateDeliveryForm(values)).length === 0;
const isPaymentComplete = (values: PaymentFormValues): boolean => Object.keys(validatePaymentForm(values)).length === 0;

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

  const borderClass = error ? "border-[#C0392B]" : showSuccess ? "border-[#C4A882]" : "border-[#d4ccc2]";

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
          className={`w-full border-0 border-b ${borderClass} bg-transparent pb-[10px] pt-[16px] font-body text-[16px] text-[#1A1A1A] transition-colors duration-200 placeholder:text-transparent focus:placeholder:text-[#aaaaaa] focus:border-[#1A1A1A] focus:outline-none md:text-[14px]`}
        />

        <label
          htmlFor={id}
          className={`pointer-events-none absolute left-0 font-body transition-all duration-200 ${
            shouldFloatLabel
              ? "top-[2px] text-[10px] uppercase tracking-[0.12em] text-[#C4A882]"
              : "top-[20px] text-[14px] text-[#888888]"
          }`}
        >
          {label}
          {required ? <span className="ml-[2px] text-[#C0392B]">*</span> : null}
        </label>
      </div>

      {helperText ? <p className="mt-[6px] font-body text-[11px] text-[#aaaaaa]">{helperText}</p> : null}
      {error ? <p className="mt-[6px] font-body text-[11px] text-[#C0392B]">{error}</p> : null}
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

  const borderClass = error ? "border-[#C0392B]" : showSuccess ? "border-[#C4A882]" : "border-[#d4ccc2]";

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
          className={`w-full resize-none border-0 border-b ${borderClass} bg-transparent pb-[10px] pt-[20px] font-body text-[16px] text-[#1A1A1A] transition-colors duration-200 placeholder:text-transparent focus:placeholder:text-[#aaaaaa] focus:border-[#1A1A1A] focus:outline-none md:text-[14px]`}
          rows={4}
        />

        <label
          htmlFor={id}
          className={`pointer-events-none absolute left-0 font-body transition-all duration-200 ${
            shouldFloatLabel
              ? "top-[2px] text-[10px] uppercase tracking-[0.12em] text-[#C4A882]"
              : "top-[22px] text-[14px] text-[#888888]"
          }`}
        >
          {label}
          {required ? <span className="ml-[2px] text-[#C0392B]">*</span> : null}
        </label>
      </div>

      {showCharacterCount && typeof maxLength === "number" ? (
        <p className="mt-[6px] text-right font-body text-[10px] text-[#aaaaaa]">
          {value.length}/{maxLength}
        </p>
      ) : null}

      {error ? <p className="mt-[6px] font-body text-[11px] text-[#C0392B]">{error}</p> : null}
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

  const borderClass = error ? "border-[#C0392B]" : showSuccess ? "border-[#C4A882]" : "border-[#d4ccc2]";

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
          className={`w-full appearance-none border-0 border-b ${borderClass} bg-transparent pb-[10px] pt-[16px] font-body text-[16px] text-[#1A1A1A] transition-colors duration-200 focus:border-[#1A1A1A] focus:outline-none md:text-[14px]`}
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

        <ChevronDown className="pointer-events-none absolute right-0 top-[31px] h-4 w-4 text-[#888888]" />

        <label
          htmlFor={id}
          className={`pointer-events-none absolute left-0 font-body transition-all duration-200 ${
            shouldFloatLabel
              ? "top-[2px] text-[10px] uppercase tracking-[0.12em] text-[#C4A882]"
              : "top-[20px] text-[14px] text-[#888888]"
          }`}
        >
          {label}
          {required ? <span className="ml-[2px] text-[#C0392B]">*</span> : null}
        </label>
      </div>

      {error ? <p className="mt-[6px] font-body text-[11px] text-[#C0392B]">{error}</p> : null}
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

  const borderClass = error ? "border-[#C0392B]" : showSuccess ? "border-[#C4A882]" : "border-[#d4ccc2]";

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
              className={`flex w-full items-center justify-between border-0 border-b ${borderClass} bg-transparent pb-[10px] pt-[16px] text-left font-body text-[16px] text-[#1A1A1A] transition-colors duration-200 focus:border-[#1A1A1A] focus:outline-none md:text-[14px]`}
            >
              <span className="truncate">{value || " "}</span>
              <ChevronDown className="h-4 w-4 text-[#888888]" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-[var(--radix-popover-trigger-width)] border-[#d4ccc2] bg-[#F5F0E8] p-0"
          >
            <Command className="bg-[#F5F0E8]">
              <CommandInput
                placeholder="Search state..."
                className="font-body text-[13px] placeholder:text-[#aaaaaa] focus:ring-0"
              />
              <CommandList>
                <CommandEmpty className="font-body text-[12px] text-[#888888]">No state found.</CommandEmpty>
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
                      className="font-body text-[12px] text-[#1A1A1A] data-[selected=true]:bg-[#e8dfd3] data-[selected=true]:text-[#1A1A1A]"
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
              ? "top-[2px] text-[10px] uppercase tracking-[0.12em] text-[#C4A882]"
              : "top-[20px] text-[14px] text-[#888888]"
          }`}
        >
          {label}
          {required ? <span className="ml-[2px] text-[#C0392B]">*</span> : null}
        </p>
      </div>

      {error ? <p className="mt-[6px] font-body text-[11px] text-[#C0392B]">{error}</p> : null}
    </div>
  );
};

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { items, subtotal, totalItems, validateCart, isValidating, clearCart, replaceItems } = useCart();

  const [isHydrated, setIsHydrated] = useState(false);

  const [contactValues, setContactValues] = useState<ContactFormValues>(DEFAULT_CONTACT_VALUES);
  const [deliveryValues, setDeliveryValues] = useState<DeliveryFormValues>(DEFAULT_DELIVERY_VALUES);
  const [paymentValues, setPaymentValues] = useState<PaymentFormValues>(DEFAULT_PAYMENT_VALUES);
  const [reviewValues, setReviewValues] = useState<ReviewFormValues>(DEFAULT_REVIEW_VALUES);

  const [contactTouched, setContactTouched] = useState<Partial<Record<ContactField, boolean>>>({});
  const [deliveryTouched, setDeliveryTouched] = useState<Partial<Record<DeliveryField, boolean>>>({});
  const [paymentTouched, setPaymentTouched] = useState<Partial<Record<PaymentField, boolean>>>({});

  const [contactErrors, setContactErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [deliveryErrors, setDeliveryErrors] = useState<Partial<Record<DeliveryField, string>>>({});
  const [paymentErrors, setPaymentErrors] = useState<Partial<Record<PaymentField, string>>>({});

  const [completedSteps, setCompletedSteps] = useState<CheckoutStep[]>([]);

  const [shippingRates, setShippingRates] = useState<ShippingRateRow[]>([]);

  const [discountInput, setDiscountInput] = useState("");
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountSuccess, setDiscountSuccess] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);

  const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState(false);

  const [isSessionChecked, setIsSessionChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddressCard[]>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(null);
  const [isManualAddressOpen, setIsManualAddressOpen] = useState(true);

  const [stepAdvanceError, setStepAdvanceError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionPhase, setSubmissionPhase] = useState<"idle" | "verifying" | "submitting">("idle");

  const pathStep = useMemo(() => getStepFromPath(location.pathname), [location.pathname]);
  const currentStep: CheckoutStep = pathStep ?? "contact";
  const currentStepIndex = CHECKOUT_STEPS.indexOf(currentStep);

  const shippingQuote = useMemo(() => {
    if (!deliveryValues.state) {
      return null;
    }

    return resolveShippingQuote(deliveryValues.state, shippingRates);
  }, [deliveryValues.state, shippingRates]);

  const shippingFee = shippingQuote?.fee ?? 0;
  const discountAmount = appliedDiscount?.amount ?? 0;
  const orderTotal = Math.max(0, subtotal + shippingFee - discountAmount);

  const shippingSidebarValue =
    currentStep === "contact"
      ? "Calculated in next step"
      : shippingQuote
        ? formatPrice(shippingQuote.fee)
        : "Select state";

  const orderItemCountLabel = `${totalItems} ${totalItems === 1 ? "item" : "items"}`;
  const selectedPaymentLabel =
    paymentValues.method === "mobile_money" ? "Mobile Money" : "Cash on Delivery";

  useEffect(() => {
    void validateCart();
  }, [validateCart]);

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
          firstName: readString(parsed.contact.firstName),
          lastName: readString(parsed.contact.lastName),
          email: readString(parsed.contact.email),
          phone: readString(parsed.contact.phone),
          marketingOptIn: readBoolean(parsed.contact.marketingOptIn),
        });
      }

      if (isPlainRecord(parsed.delivery)) {
        setDeliveryValues({
          addressLine1: readString(parsed.delivery.addressLine1),
          addressLine2: readString(parsed.delivery.addressLine2),
          city: readString(parsed.delivery.city),
          state: readString(parsed.delivery.state),
          country: readString(parsed.delivery.country, "Nigeria") || "Nigeria",
          deliveryInstructions: readString(parsed.delivery.deliveryInstructions).slice(0, 200),
          saveForFuture: readBoolean(parsed.delivery.saveForFuture),
        });
      }

      if (isPlainRecord(parsed.payment)) {
        const method = parsed.payment.method === "mobile_money" ? "mobile_money" : "cash_on_delivery";
        setPaymentValues({
          method,
          mobileMoneyNumber: readString(parsed.payment.mobileMoneyNumber),
        });
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

      if (typeof parsed.discountInput === "string") {
        setDiscountInput(parsed.discountInput);
      }

      if (isPlainRecord(parsed.appliedDiscount)) {
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
      discountInput,
      appliedDiscount,
    };

    window.sessionStorage.setItem(CHECKOUT_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  }, [
    appliedDiscount,
    completedSteps,
    contactValues,
    deliveryValues,
    discountInput,
    isHydrated,
    paymentValues,
    reviewValues,
    selectedSavedAddressId,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadShippingRates = async () => {
      try {
        const data = await fetchActiveShippingRates();
        if (!cancelled) {
          setShippingRates(data);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Failed to load shipping rates", error);
        }

        if (cancelled) {
          return;
        }

        return;
      }
    };

    void loadShippingRates();

    return () => {
      cancelled = true;
    };
  }, []);

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

    const normalizedPath = location.pathname.replace(/\/+$/, "");

    if (normalizedPath === "/checkout") {
      navigate(STEP_PATH.contact, { replace: true });
      return;
    }

    if (pathStep === null) {
      navigate(STEP_PATH.contact, { replace: true });
    }
  }, [isHydrated, location.pathname, navigate, pathStep]);

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
    if (!completedSteps.includes("contact")) {
      return;
    }

    if (!isContactComplete(contactValues)) {
      setCompletedSteps((previous) =>
        previous.filter((step) => step !== "contact" && step !== "delivery" && step !== "payment"),
      );
    }
  }, [completedSteps, contactValues]);

  useEffect(() => {
    if (!completedSteps.includes("delivery")) {
      return;
    }

    if (!isDeliveryComplete(deliveryValues)) {
      setCompletedSteps((previous) => previous.filter((step) => step !== "delivery" && step !== "payment"));
    }
  }, [completedSteps, deliveryValues]);

  useEffect(() => {
    if (!completedSteps.includes("payment")) {
      return;
    }

    if (!isPaymentComplete(paymentValues)) {
      setCompletedSteps((previous) => previous.filter((step) => step !== "payment"));
    }
  }, [completedSteps, paymentValues]);

  useEffect(() => {
    setStepAdvanceError(null);
  }, [currentStep]);

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

  const updatePaymentError = useCallback((field: PaymentField, error?: string) => {
    setPaymentErrors((previous) => {
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
    const errors = validatePaymentForm(paymentValues);
    setPaymentTouched({
      mobileMoneyNumber: true,
    });
    setPaymentErrors(errors);
    return Object.keys(errors).length === 0;
  }, [paymentValues]);

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

  const handlePaymentBlur = useCallback(() => {
    setPaymentTouched((previous) => ({
      ...previous,
      mobileMoneyNumber: true,
    }));

    updatePaymentError(
      "mobileMoneyNumber",
      getPaymentFieldError("mobileMoneyNumber", paymentValues.method, paymentValues.mobileMoneyNumber),
    );
  }, [paymentValues.method, paymentValues.mobileMoneyNumber, updatePaymentError]);

  const handleNextStep = useCallback(() => {
    if (currentStep === "contact") {
      const isValid = validateContactStep();
      if (!isValid) {
        setStepAdvanceError(ERROR_SUMMARY_TEXT);
        return;
      }

      setCompletedSteps((previous) => uniqueCheckoutSteps([...previous, "contact"]));
      navigate(STEP_PATH.delivery);
      return;
    }

    if (currentStep === "delivery") {
      const isValid = validateDeliveryStep();
      if (!isValid) {
        setStepAdvanceError(ERROR_SUMMARY_TEXT);
        return;
      }

      setCompletedSteps((previous) => uniqueCheckoutSteps([...previous, "contact", "delivery"]));
      navigate(STEP_PATH.payment);
      return;
    }

    if (currentStep === "payment") {
      const isValid = validatePaymentStep();
      if (!isValid) {
        setStepAdvanceError(ERROR_SUMMARY_TEXT);
        return;
      }

      setCompletedSteps((previous) => uniqueCheckoutSteps([...previous, "contact", "delivery", "payment"]));
      navigate(STEP_PATH.review);
    }
  }, [currentStep, navigate, validateContactStep, validateDeliveryStep, validatePaymentStep]);

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
  }, [discountInput, subtotal]);

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

    setDeliveryValues((previous) => ({
      ...previous,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      country: address.country || "Nigeria",
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

  const handleConfirmOrder = useCallback(async () => {
    setSubmissionError(null);

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
      setStepAdvanceError(ERROR_SUMMARY_TEXT);
      navigate(STEP_PATH.payment);
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

      const sanitizedDelivery = {
        addressLine1: sanitizeText(deliveryValues.addressLine1),
        addressLine2: sanitizeText(deliveryValues.addressLine2),
        city: sanitizeText(deliveryValues.city),
        state: sanitizeText(deliveryValues.state),
        country: sanitizeText(deliveryValues.country),
        deliveryInstructions: sanitizeMultilineText(deliveryValues.deliveryInstructions),
      };

      const sanitizedReview = {
        orderNotes: sanitizeMultilineText(reviewValues.orderNotes),
      };

      const sanitizedMobileMoneyNumber =
        paymentValues.method === "mobile_money" ? sanitizeText(paymentValues.mobileMoneyNumber) : null;

      const stockValidation = await validateCartStock(items);
      if (stockValidation.hasChanges) {
        replaceItems(stockValidation.updatedItems);
      }

      for (const message of stockValidation.messages) {
        toast(message.message, {
          className: message.type === "error" ? "lux-cart-toast lux-cart-toast-error" : "lux-cart-toast",
        });
      }

      if (stockValidation.shouldBlockCheckout) {
        setSubmissionError(stockValidation.blockingMessage ?? "Something went wrong. Please try again.");
        setSubmissionPhase("idle");
        return;
      }

      const customerId = await resolveCustomerIdForOrder({
        firstName: sanitizedContact.firstName,
        lastName: sanitizedContact.lastName,
        email: sanitizedContact.email,
        phone: sanitizedContact.phone,
      });

      const shippingRate = await resolveShippingRateForState(sanitizedDelivery.state);
      const validatedShippingFee = Number(shippingRate.base_rate ?? 0);
      const validatedTotal = Math.max(0, subtotal + validatedShippingFee - discountAmount);

      setSubmissionPhase("submitting");

      const orderResponse = await submitOrderRpc({
        customerId,
        firstName: sanitizedContact.firstName,
        lastName: sanitizedContact.lastName,
        email: sanitizedContact.email,
        phone: sanitizedContact.phone,
        addressLine1: sanitizedDelivery.addressLine1,
        addressLine2: sanitizedDelivery.addressLine2,
        city: sanitizedDelivery.city,
        state: sanitizedDelivery.state,
        country: sanitizedDelivery.country,
        deliveryInstructions: sanitizedDelivery.deliveryInstructions,
        saveAddress: deliveryValues.saveForFuture,
        items: stockValidation.updatedItems,
        subtotal,
        shippingFee: validatedShippingFee,
        discountAmount,
        total: validatedTotal,
        notes: sanitizedReview.orderNotes,
        paymentMethod: paymentValues.method,
        mobileMoneyNumber: sanitizedMobileMoneyNumber,
        marketingOptIn: sanitizedContact.marketingOptIn,
        ipAddress: null,
      });

      if (isLoggedIn && deliveryValues.saveForFuture) {
        const savedAddress: SavedAddressCard = {
          id: `local-${Date.now()}`,
          label: "Saved Address",
          recipientName: `${sanitizedContact.firstName} ${sanitizedContact.lastName}`.trim(),
          addressLine1: sanitizedDelivery.addressLine1,
          addressLine2: sanitizedDelivery.addressLine2,
          city: sanitizedDelivery.city,
          state: sanitizedDelivery.state,
          country: sanitizedDelivery.country,
          deliveryInstructions: sanitizedDelivery.deliveryInstructions,
        };

        saveAddressForFutureOrders(savedAddress);
      }

      clearCart();

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(CHECKOUT_SESSION_STORAGE_KEY);
        window.sessionStorage.setItem("luxuriant_last_order", orderResponse.order_number);
      }

      navigate("/checkout/confirmation", { replace: true });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Checkout submission failed", error);
      }

      if (error instanceof OrderSubmissionError) {
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
    deliveryValues,
    discountAmount,
    isLoggedIn,
    items,
    navigate,
    paymentValues.method,
    paymentValues.mobileMoneyNumber,
    replaceItems,
    reviewValues.orderNotes,
    saveAddressForFutureOrders,
    subtotal,
    validateCart,
    validateContactStep,
    validateDeliveryStep,
    validatePaymentStep,
  ]);

  const renderOrderSummary = (isMobile: boolean) => (
    <div className={`${isMobile ? "" : "sticky top-[112px]"}`}>
      <h3 className="mb-6 font-display text-[22px] italic text-[#1A1A1A]">Order Summary</h3>

      <div className="space-y-3 border-b border-[#d4ccc2] pb-4">
        {items.map((item) => (
          <div key={item.product_id}>
            <div className="flex items-start gap-3">
              <img
                src={item.image_url}
                alt={item.image_alt}
                className="h-[64px] w-[48px] flex-shrink-0 object-cover"
                loading="lazy"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[14px] italic text-[#1A1A1A]">{item.name}</p>
                <p className="font-body text-[11px] text-[#888888]">Qty: {item.quantity}</p>
              </div>

              <p className="text-right font-body text-[12px] text-[#1A1A1A]">
                {formatPrice(item.price * item.quantity)}
              </p>
            </div>
            <div className="mt-3 border-b border-[#d4ccc2]" />
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2 font-body text-[12px]">
        <div className="flex items-center justify-between text-[#888888]">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>

        <div className="flex items-center justify-between text-[#888888]">
          <span>Shipping</span>
          <span>{shippingSidebarValue}</span>
        </div>

        {appliedDiscount ? (
          <div className="flex items-center justify-between text-[#C4A882]">
            <span>Discount</span>
            <span>- {formatPrice(discountAmount)}</span>
          </div>
        ) : null}
      </div>

      <div className="my-4 border-b border-[#d4ccc2]" />

      <div className="flex items-center justify-between font-body text-[14px] font-medium text-[#1A1A1A]">
        <span>Order Total</span>
        <span>{formatPrice(orderTotal)}</span>
      </div>

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
            className="w-full border-0 border-b border-[#d4ccc2] bg-transparent pb-[10px] pt-[16px] font-body text-[16px] text-[#1A1A1A] transition-colors duration-200 placeholder:text-transparent focus:border-[#1A1A1A] focus:outline-none md:text-[14px]"
          />
          <label
            htmlFor={isMobile ? "discount-mobile" : "discount-desktop"}
            className={`pointer-events-none absolute left-0 font-body transition-all duration-200 ${
              discountInput.trim().length > 0
                ? "top-[2px] text-[10px] uppercase tracking-[0.12em] text-[#C4A882]"
                : "top-[20px] text-[14px] text-[#888888]"
            }`}
          >
            Discount code
          </label>
        </div>

        <button
          type="button"
          onClick={() => void handleApplyDiscount()}
          disabled={isApplyingDiscount}
          className="mt-2 ml-auto block font-body text-[11px] uppercase tracking-[0.12em] text-[#C4A882] transition-colors hover:text-[#1A1A1A] disabled:opacity-60"
        >
          {isApplyingDiscount ? "Applying..." : "Apply"}
        </button>

        {discountSuccess ? <p className="mt-2 font-body text-[11px] text-[#2E7D32]">{discountSuccess}</p> : null}
        {discountError ? <p className="mt-2 font-body text-[11px] text-[#C0392B]">{discountError}</p> : null}
      </div>

      {isValidating ? (
        <p className="mt-5 font-body text-[11px] text-[#888888]">Verifying latest prices and stock...</p>
      ) : null}
    </div>
  );

  if (!isHydrated) {
    return null;
  }

  return (
    <div className="bg-[#F5F0E8] pb-[60px] pt-[80px]">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
        <button
          type="button"
          onClick={() => setIsMobileSummaryOpen(true)}
          className="sticky top-[72px] z-30 mb-6 flex h-[52px] w-full items-center justify-between bg-[#1A1A1A] px-4 lg:hidden"
        >
          <span className="font-body text-[12px] text-[#F5F0E8]">
            {orderItemCountLabel} · {formatPrice(subtotal)}
          </span>
          <ChevronDown className="h-4 w-4 text-[#F5F0E8]" />
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
                              ? "border-[#1A1A1A] bg-[#1A1A1A] text-[#F5F0E8]"
                              : isCompleted
                                ? "border-[#C4A882] bg-[#C4A882] text-[#1A1A1A]"
                                : "border-[#d4ccc2] bg-transparent text-[#aaaaaa]"
                          }`}
                        >
                          {isCompleted && !isActive ? <Check className="h-3.5 w-3.5" /> : index + 1}
                        </span>

                        <span
                          className={`mt-2 font-body text-[10px] uppercase tracking-[0.12em] ${
                            isActive ? "text-[#1A1A1A]" : isCompleted ? "text-[#C4A882]" : "text-[#aaaaaa]"
                          }`}
                        >
                          {STEP_LABEL[step]}
                        </span>
                      </button>

                      {index < CHECKOUT_STEPS.length - 1 ? (
                        <span
                          className={`mt-3 mx-3 h-px flex-1 border-t ${
                            connectorCompleted ? "border-[#C4A882]" : "border-[#d4ccc2]"
                          }`}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mb-8 flex items-center justify-between md:hidden">
              <p className="font-body text-[10px] uppercase tracking-[0.12em] text-[#1A1A1A]">
                {STEP_LABEL[currentStep]}
              </p>
              <p className="font-body text-[10px] uppercase tracking-[0.12em] text-[#888888]">
                Step {currentStepIndex + 1} of {CHECKOUT_STEPS.length}
              </p>
            </div>

            {currentStep === "contact" ? (
              <div>
                <h1 className="font-display text-[32px] italic text-[#1A1A1A]">Contact Information</h1>

                <div className="mt-5 grid gap-x-6 md:grid-cols-2">
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
                  helperText="For delivery updates only"
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
                      contactValues.marketingOptIn ? "border-[#1A1A1A] bg-[#1A1A1A]" : "border-[#d4ccc2] bg-transparent"
                    }`}
                  >
                    {contactValues.marketingOptIn ? <Check className="h-3 w-3 text-white" /> : null}
                  </span>
                  <span className="font-body text-[12px] text-[#888888]">
                    Send me updates on new arrivals and offers
                  </span>
                </label>

                <div className="mt-10">
                  {stepAdvanceError ? (
                    <p className="mb-3 font-body text-[12px] text-[#C0392B]">{stepAdvanceError}</p>
                  ) : null}

                  <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="self-start font-body text-[11px] uppercase tracking-[0.12em] text-[#888888] transition-colors hover:text-[#1A1A1A]"
                    >
                      &larr; Back
                    </button>

                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="w-full rounded-[2px] bg-[#1A1A1A] px-12 py-4 font-body text-[11px] uppercase tracking-[0.18em] text-[#F5F0E8] transition-colors duration-300 hover:bg-[#C4A882] hover:text-[#1A1A1A] md:w-auto"
                    >
                      Next Step
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {currentStep === "delivery" ? (
              <div>
                <h1 className="font-display text-[32px] italic text-[#1A1A1A]">Delivery Address</h1>

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
                              isSelected ? "border-[#1A1A1A]" : "border-[#d4ccc2] hover:border-[#1A1A1A]"
                            }`}
                          >
                            <p className="font-body text-[12px] text-[#1A1A1A]">{address.label}</p>
                            <p className="font-body text-[12px] text-[#1A1A1A]">{address.recipientName || "Saved recipient"}</p>
                            <p className="truncate font-body text-[12px] text-[#888888]">{address.addressLine1}</p>
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
                      className="mt-3 font-body text-[11px] uppercase tracking-[0.12em] text-[#C4A882] transition-colors hover:text-[#1A1A1A]"
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
                        label="City"
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
                        label="State"
                        required
                        value={deliveryValues.state}
                        options={NIGERIA_STATES}
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
                      <p className="mt-2 font-body text-[11px] text-[#888888]">
                        Delivery to {deliveryValues.state}: {formatPrice(shippingQuote.fee)} · {shippingQuote.minDays}–
                        {shippingQuote.maxDays} business days
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
                        deliveryValues.saveForFuture ? "border-[#1A1A1A] bg-[#1A1A1A]" : "border-[#d4ccc2] bg-transparent"
                      }`}
                    >
                      {deliveryValues.saveForFuture ? <Check className="h-3 w-3 text-white" /> : null}
                    </span>
                    <span className="font-body text-[12px] text-[#888888]">Save this address for future orders</span>
                  </label>
                ) : null}

                <div className="mt-10">
                  {stepAdvanceError ? (
                    <p className="mb-3 font-body text-[12px] text-[#C0392B]">{stepAdvanceError}</p>
                  ) : null}

                  <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="self-start font-body text-[11px] uppercase tracking-[0.12em] text-[#888888] transition-colors hover:text-[#1A1A1A]"
                    >
                      &larr; Back
                    </button>

                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="w-full rounded-[2px] bg-[#1A1A1A] px-12 py-4 font-body text-[11px] uppercase tracking-[0.18em] text-[#F5F0E8] transition-colors duration-300 hover:bg-[#C4A882] hover:text-[#1A1A1A] md:w-auto"
                    >
                      Next Step
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {currentStep === "payment" ? (
              <div>
                <h1 className="font-display text-[32px] italic text-[#1A1A1A]">How would you like to pay?</h1>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentValues((previous) => ({
                        ...previous,
                        method: "mobile_money",
                      }));
                    }}
                    className={`rounded-[2px] border px-6 py-7 text-left transition-colors duration-200 ${
                      paymentValues.method === "mobile_money" ? "border-[#1A1A1A]" : "border-[#d4ccc2]"
                    }`}
                    style={{ backgroundColor: paymentValues.method === "mobile_money" ? "#1A1A1A08" : "transparent" }}
                  >
                    <Smartphone size={28} strokeWidth={1.25} className="mb-4 text-[#C4A882]" />
                    <p className="font-display text-[18px] italic text-[#1A1A1A]">Mobile Money</p>
                    <p className="mt-1 font-body text-[11px] font-light text-[#888888]">
                      Pay via MTN MoMo, Telecel Cash or AirtelTigo
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentValues((previous) => ({
                        ...previous,
                        method: "cash_on_delivery",
                      }));
                      setPaymentErrors({});
                    }}
                    className={`rounded-[2px] border px-6 py-7 text-left transition-colors duration-200 ${
                      paymentValues.method === "cash_on_delivery" ? "border-[#1A1A1A]" : "border-[#d4ccc2]"
                    }`}
                    style={{
                      backgroundColor: paymentValues.method === "cash_on_delivery" ? "#1A1A1A08" : "transparent",
                    }}
                  >
                    <Banknote size={28} strokeWidth={1.25} className="mb-4 text-[#C4A882]" />
                    <p className="font-display text-[18px] italic text-[#1A1A1A]">Cash on Delivery</p>
                    <p className="mt-1 font-body text-[11px] font-light text-[#888888]">
                      Pay in cash when your order arrives
                    </p>
                  </button>
                </div>

                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    paymentValues.method === "mobile_money" ? "mt-4 max-h-[220px] opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <FloatingInput
                    id="checkout-mobile-money-number"
                    label="Mobile Money Number"
                    placeholder="05X XXX XXXX"
                    required
                    value={paymentValues.mobileMoneyNumber}
                    touched={paymentTouched.mobileMoneyNumber}
                    error={paymentErrors.mobileMoneyNumber}
                    helperText="Enter the number registered with your mobile money provider"
                    onChange={(value) =>
                      setPaymentValues((previous) => ({
                        ...previous,
                        mobileMoneyNumber: value,
                      }))
                    }
                    onBlur={handlePaymentBlur}
                  />
                </div>

                <div className="mt-10">
                  {stepAdvanceError ? (
                    <p className="mb-3 font-body text-[12px] text-[#C0392B]">{stepAdvanceError}</p>
                  ) : null}

                  <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="self-start font-body text-[11px] uppercase tracking-[0.12em] text-[#888888] transition-colors hover:text-[#1A1A1A]"
                    >
                      &larr; Back
                    </button>

                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="w-full rounded-[2px] bg-[#1A1A1A] px-12 py-4 font-body text-[11px] uppercase tracking-[0.18em] text-[#F5F0E8] transition-colors duration-300 hover:bg-[#C4A882] hover:text-[#1A1A1A] md:w-auto"
                    >
                      Next Step
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {currentStep === "review" ? (
              <div>
                <h1 className="font-display text-[32px] italic text-[#1A1A1A]">Review Your Order</h1>

                <div className="mt-6 space-y-4 border-b border-[#d4ccc2] pb-6">
                  {items.map((item) => (
                    <div key={item.product_id} className="flex items-start gap-4">
                      <img
                        src={item.image_url}
                        alt={item.image_alt}
                        className="h-[96px] w-[72px] flex-shrink-0 object-cover"
                        loading="lazy"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="font-display text-[16px] italic text-[#1A1A1A]">{item.name}</p>
                        <p className="font-body text-[12px] text-[#888888]">Qty: {item.quantity}</p>
                      </div>

                      <p className="font-body text-[13px] text-[#1A1A1A]">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 space-y-2 border-b border-[#d4ccc2] pb-6">
                  <div className="flex items-center justify-between font-body text-[12px] text-[#888888]">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between font-body text-[12px] text-[#888888]">
                    <span>Shipping</span>
                    <span>{shippingQuote ? formatPrice(shippingQuote.fee) : "Select state"}</span>
                  </div>

                  {appliedDiscount ? (
                    <div className="flex items-center justify-between font-body text-[12px] text-[#C4A882]">
                      <span>Discount</span>
                      <span>- {formatPrice(discountAmount)}</span>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between font-body text-[14px] font-medium text-[#1A1A1A]">
                    <span>Total</span>
                    <span>{formatPrice(orderTotal)}</span>
                  </div>
                </div>

                <div className="mt-6 border-b border-[#d4ccc2] pb-6">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-body text-[10px] uppercase tracking-[0.12em] text-[#C4A882]">Delivering to</p>
                    <button
                      type="button"
                      onClick={() => navigate(STEP_PATH.delivery)}
                      className="font-body text-[11px] uppercase tracking-[0.1em] text-[#888888] transition-colors hover:text-[#1A1A1A]"
                    >
                      Edit
                    </button>
                  </div>

                  <p className="font-body text-[13px] text-[#888888]">
                    {deliveryValues.addressLine1}
                    {deliveryValues.addressLine2 ? `, ${deliveryValues.addressLine2}` : ""}
                    <br />
                    {deliveryValues.city}, {deliveryValues.state}
                    <br />
                    {deliveryValues.country}
                  </p>
                </div>

                <div className="mt-6 border-b border-[#d4ccc2] pb-6">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-body text-[10px] uppercase tracking-[0.12em] text-[#C4A882]">Contact</p>
                    <button
                      type="button"
                      onClick={() => navigate(STEP_PATH.contact)}
                      className="font-body text-[11px] uppercase tracking-[0.1em] text-[#888888] transition-colors hover:text-[#1A1A1A]"
                    >
                      Edit
                    </button>
                  </div>

                  <p className="font-body text-[13px] text-[#888888]">
                    {contactValues.firstName} {contactValues.lastName}
                    <br />
                    {contactValues.email}
                  </p>
                </div>

                <div className="mt-6 border-b border-[#d4ccc2] pb-6">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-body text-[10px] uppercase tracking-[0.12em] text-[#C4A882]">Payment</p>
                    <button
                      type="button"
                      onClick={() => navigate(STEP_PATH.payment)}
                      className="font-body text-[11px] uppercase tracking-[0.1em] text-[#888888] transition-colors hover:text-[#1A1A1A]"
                    >
                      Edit
                    </button>
                  </div>

                  <p className="font-body text-[13px] text-[#888888]">
                    {selectedPaymentLabel}
                    {paymentValues.method === "mobile_money" && paymentValues.mobileMoneyNumber
                      ? ` (${paymentValues.mobileMoneyNumber})`
                      : ""}
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
                    className="mb-4 font-body text-[11px] uppercase tracking-[0.12em] text-[#888888] transition-colors hover:text-[#1A1A1A]"
                  >
                    &larr; Back
                  </button>

                  <p className="mb-4 font-body text-[11px] text-[#aaaaaa]">
                    By placing your order you agree to our{" "}
                    <Link to="/contact" className="text-[#888888] transition-colors hover:text-[#1A1A1A]">
                      Terms &amp; Conditions
                    </Link>{" "}
                    and{" "}
                    <Link to="/contact" className="text-[#888888] transition-colors hover:text-[#1A1A1A]">
                      Privacy Policy
                    </Link>
                  </p>

                  {submissionError ? (
                    <p className="mb-3 font-body text-[12px] text-[#C0392B]">{submissionError}</p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void handleConfirmOrder()}
                    disabled={submissionPhase !== "idle"}
                    className="w-full rounded-[2px] bg-[#1A1A1A] px-4 py-5 font-body text-[11px] uppercase tracking-[0.18em] text-[#F5F0E8] transition-colors duration-300 hover:bg-[#C4A882] hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-65"
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

          <aside className="hidden border-l border-[#d4ccc2] pl-12 lg:block">{renderOrderSummary(false)}</aside>
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

          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto bg-[#F5F0E8] px-5 pb-6 pt-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-body text-[10px] uppercase tracking-[0.14em] text-[#888888]">
                {orderItemCountLabel} · {formatPrice(subtotal)}
              </p>
              <button
                type="button"
                onClick={() => setIsMobileSummaryOpen(false)}
                className="text-[#888888] transition-colors hover:text-[#1A1A1A]"
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

