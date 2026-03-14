import type { CartItem } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { getSession } from "@/services/authService";

export interface ShippingRateRow {
  id: string;
  name: string;
  states: Json | null;
  base_rate: number;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  is_active: boolean | null;
}

export interface CheckoutSavedAddressRow {
  id: string;
  label: string | null;
  recipient_name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  country: string;
  delivery_instructions: string | null;
}

export interface CheckoutSessionData {
  isLoggedIn: boolean;
  userId: string | null;
  savedAddresses: CheckoutSavedAddressRow[];
}

export interface DiscountCodeRow {
  code: string;
  type: "percentage" | "fixed_amount";
  value: number;
  description: string | null;
  minimum_order_amount: number | null;
  usage_limit: number | null;
  usage_count: number | null;
  expires_at: string | null;
  is_active: boolean | null;
}

export interface ResolveCustomerInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface SubmitOrderInput {
  customerId: string | null;
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
  saveAddress: boolean;
  items: CartItem[];
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  total: number;
  notes: string;
  paymentMethod: string;
  mobileMoneyNumber: string | null;
  marketingOptIn: boolean;
  ipAddress: string | null;
}

export interface SubmitOrderResult {
  order_id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
}

export interface OrderCustomerSummary {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface OrderItemSummary {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_sku: string | null;
  product_image_url: string | null;
  unit_price: number;
  compare_at_price: number | null;
  quantity: number;
  subtotal: number;
  created_at: string;
}

export interface OrderStatusSummary {
  status: string;
  note: string | null;
  changed_at: string;
}

export interface OrderDetails {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number | null;
  total: number;
  payment_method: string | null;
  mobile_money_number: string | null;
  shipping_address_snapshot: Json;
  created_at: string;
  updated_at: string | null;
  confirmation_email_sent: boolean;
  customer: OrderCustomerSummary;
  order_items: OrderItemSummary[];
  order_status_history: OrderStatusSummary[];
}

export type OrderSubmissionErrorType = "generic" | "stock_conflict" | "timeout";

export class OrderSubmissionError extends Error {
  type: OrderSubmissionErrorType;
  originalError: unknown;

  constructor(type: OrderSubmissionErrorType, originalError: unknown) {
    super(type);
    this.type = type;
    this.originalError = originalError;
  }
}

const isNoRowsError = (error: unknown) => {
  const candidate = error as { code?: string } | null;
  return candidate?.code === "PGRST116";
};

const isPermissionError = (error: unknown) => {
  const candidate = error as { code?: string; message?: string } | null;
  if (candidate?.code === "42501") {
    return true;
  }
  return typeof candidate?.message === "string" && /permission denied|not allowed|rls/i.test(candidate.message);
};

const getErrorMessage = (error: unknown) => {
  const candidate = error as { message?: string; details?: string; hint?: string } | null;
  return [candidate?.message, candidate?.details, candidate?.hint].filter(Boolean).join(" ");
};

const isStockConflictError = (error: unknown) => {
  const message = getErrorMessage(error).toUpperCase();
  return (
    message.includes("STOCK_CONFLICT") ||
    message.includes("PRODUCT_UNAVAILABLE") ||
    message.includes("OUT OF STOCK") ||
    message.includes("SOLD OUT")
  );
};

const isTimeoutError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("network request failed") ||
    message.includes("fetch failed") ||
    message.includes("failed to fetch")
  );
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeOrderDetails = (value: Json | null): OrderDetails | null => {
  if (!isPlainRecord(value)) {
    return null;
  }

  return value as unknown as OrderDetails;
};

export const getOrderErrorMessage = (type: OrderSubmissionErrorType): string => {
  if (type === "stock_conflict") {
    return "One or more items in your cart just sold out. Your cart has been updated.";
  }

  if (type === "timeout") {
    return "Connection timed out. Please check your internet and try again.";
  }

  return "Something went wrong. Please try again.";
};

export const fetchActiveShippingRates = async (): Promise<ShippingRateRow[]> => {
  const { data, error } = await supabase
    .from("shipping_rates")
    .select("id,name,states,base_rate,estimated_days_min,estimated_days_max,is_active")
    .eq("is_active", true);

  if (error) {
    throw error;
  }

  return (data ?? []) as ShippingRateRow[];
};

export const fetchCheckoutSessionData = async (): Promise<CheckoutSessionData> => {
  const session = await getSession();

  if (!session) {
    return {
      isLoggedIn: false,
      userId: null,
      savedAddresses: [],
    };
  }
  const userEmail = session.user.email ?? "";
  if (!userEmail) {
    return {
      isLoggedIn: true,
      userId: session.user.id,
      savedAddresses: [],
    };
  }

  const { data: customerData, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("email", userEmail)
    .maybeSingle();

  if (customerError || !customerData?.id) {
    return {
      isLoggedIn: true,
      userId: session.user.id,
      savedAddresses: [],
    };
  }

  const { data: addressData, error: addressError } = await supabase
    .from("addresses")
    .select("id,label,recipient_name,address_line1,address_line2,city,state,country,delivery_instructions")
    .eq("customer_id", customerData.id)
    .order("created_at", { ascending: false });

  if (addressError || !Array.isArray(addressData)) {
    return {
      isLoggedIn: true,
      userId: session.user.id,
      savedAddresses: [],
    };
  }

  return {
    isLoggedIn: true,
    userId: session.user.id,
    savedAddresses: addressData as CheckoutSavedAddressRow[],
  };
};

export const fetchDiscountCode = async (code: string): Promise<DiscountCodeRow | null> => {
  const { data, error } = await supabase
    .from("discount_codes")
    .select("code,type,value,description,minimum_order_amount,usage_limit,usage_count,expires_at,is_active")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as DiscountCodeRow | null;
};

export const resolveCustomerIdForOrder = async (input: ResolveCustomerInput): Promise<string | null> => {
  const normalizedEmail = input.email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("customers")
    .select("id,email")
    .eq("email", normalizedEmail)
    .single();

  if (!error && data?.id) {
    return data.id;
  }

  if (error && !isNoRowsError(error) && !isPermissionError(error)) {
    throw error;
  }

  const { data: insertedData, error: insertError } = await supabase
    .from("customers")
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      email: normalizedEmail,
      phone: input.phone,
    })
    .select("id")
    .single();

  if (!insertError && insertedData?.id) {
    return insertedData.id;
  }

  if (insertError) {
    const insertCode = (insertError as { code?: string }).code;
    if (insertCode === "23505") {
      const { data: existing, error: existingError } = await supabase
        .from("customers")
        .select("id,email")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existingError) {
        if (isPermissionError(existingError)) {
          return null;
        }
        throw existingError;
      }

      return existing?.id ?? null;
    }

    if (isPermissionError(insertError)) {
      return null;
    }

    throw insertError;
  }

  return null;
};

export const resolveShippingRateForState = async (selectedState: string): Promise<ShippingRateRow> => {
  const { data, error } = await supabase
    .from("shipping_rates")
    .select("*")
    .eq("is_active", true)
    .contains("states", [selectedState])
    .single();

  if (!error && data) {
    return data as ShippingRateRow;
  }

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("shipping_rates")
    .select("*")
    .eq("is_active", true)
    .filter("states", "eq", "[]")
    .single();

  if (!fallbackError && fallbackData) {
    return fallbackData as ShippingRateRow;
  }

  if (fallbackError && !isNoRowsError(fallbackError)) {
    throw fallbackError;
  }

  throw new Error("No active shipping rate configured");
};

export const submitOrderRpc = async (input: SubmitOrderInput): Promise<SubmitOrderResult> => {
  const params = {
    p_customer_id: input.customerId,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_email: input.email,
    p_phone: input.phone,
    p_address_line1: input.addressLine1,
    p_address_line2: input.addressLine2,
    p_city: input.city,
    p_state: input.state,
    p_country: input.country,
    p_delivery_instructions: input.deliveryInstructions,
    p_save_address: input.saveAddress,
    p_items: input.items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    })),
    p_subtotal: input.subtotal,
    p_shipping_fee: input.shippingFee,
    p_discount_amount: input.discountAmount,
    p_total: input.total,
    p_notes: input.notes,
    p_payment_method: input.paymentMethod,
    p_mobile_money_number: input.mobileMoneyNumber,
    p_marketing_opt_in: input.marketingOptIn,
    p_ip_address: input.ipAddress,
  };

  const { data, error } = await supabase.rpc("submit_order", params);

  if (error) {
    if (isStockConflictError(error)) {
      throw new OrderSubmissionError("stock_conflict", error);
    }

    if (isTimeoutError(error)) {
      throw new OrderSubmissionError("timeout", error);
    }

    throw new OrderSubmissionError("generic", error);
  }

  const result = Array.isArray(data) ? data[0] : data;
  const typedResult = result as SubmitOrderResult | null;

  if (!typedResult?.order_number) {
    throw new OrderSubmissionError("generic", new Error("Missing order payload from submit_order RPC"));
  }

  return typedResult;
};

export const fetchOrderConfirmationDetails = async (orderNumber: string): Promise<OrderDetails> => {
  const { data, error } = await supabase.rpc("get_order_confirmation_details", {
    p_order_number: orderNumber,
  });

  if (error) {
    throw error;
  }

  const parsed = normalizeOrderDetails((data ?? null) as Json | null);
  if (!parsed) {
    throw new Error("Order not found");
  }

  return parsed;
};

export const lookupOrderTrackingDetails = async (
  orderNumber: string,
  email: string | null,
): Promise<OrderDetails | null> => {
  const trimmedEmail = email?.trim() ? email.trim() : null;

  const { data, error } = await supabase.rpc("lookup_order_tracking_details", {
    p_order_number: orderNumber,
    p_email: trimmedEmail,
  });

  if (error) {
    throw error;
  }

  return normalizeOrderDetails((data ?? null) as Json | null);
};

export const triggerOrderConfirmationEmail = async (orderNumber: string): Promise<void> => {
  const { error } = await supabase.functions.invoke("send_order_confirmation_email", {
    body: {
      order_number: orderNumber,
    },
  });

  if (error) {
    throw error;
  }
};

export const fetchOrderByOrderNumber = fetchOrderConfirmationDetails;
