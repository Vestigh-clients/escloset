import { type Json } from "@/integrations/supabase/types";
import type { OrderItemSummary, OrderStatusSummary } from "@/services/orderService";

export interface DeliveryWindow {
  minDays: number;
  maxDays: number;
}

export interface LiveStatusStep {
  key: string;
  label: string;
  description: string;
  note: string | null;
  changedAt: string | null;
  state: "completed" | "current" | "upcoming";
}

const ORDER_STATUS_SEQUENCE = ["pending", "confirmed", "processing", "shipped", "delivered"] as const;

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_DESCRIPTION: Record<string, string> = {
  pending: "We've received your order and are preparing it for dispatch.",
  confirmed: "Your order has been confirmed and queued for handling.",
  processing: "Our team is preparing your order for shipment.",
  shipped: "You'll receive an update when your order is on its way.",
  delivered: "Your order has reached the delivery destination.",
  cancelled: "This order was cancelled.",
};

const SKU_CATEGORY_LABEL: Record<string, string> = {
  HC: "Hair Care",
  MF: "Men's Fashion",
  WF: "Women's Fashion",
  BG: "Bags",
  SH: "Shoes",
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const readString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export const formatStatusLabel = (status: string): string => {
  const normalized = status.trim().toLowerCase();
  return STATUS_LABEL[normalized] ?? normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

export const getPaymentMethodLabel = (paymentMethod: string | null): string => {
  if (!paymentMethod) {
    return "Not specified";
  }

  if (paymentMethod === "cash_on_delivery") {
    return "Cash on Delivery";
  }

  if (paymentMethod === "mobile_money") {
    return "Mobile Money";
  }

  return paymentMethod
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const getItemCategoryLabel = (item: OrderItemSummary): string => {
  const sku = item.product_sku?.trim().toUpperCase() ?? "";
  if (!sku) {
    return "Product";
  }

  const tokens = sku.split("-");
  if (tokens.length < 2) {
    return "Product";
  }

  return SKU_CATEGORY_LABEL[tokens[1]] ?? "Product";
};

export const getAddressLines = (shippingAddressSnapshot: Json): string[] => {
  if (!isPlainRecord(shippingAddressSnapshot)) {
    return [];
  }

  const recipient = readString(shippingAddressSnapshot.recipient_name);
  const addressLine1 = readString(shippingAddressSnapshot.address_line1);
  const addressLine2 = readString(shippingAddressSnapshot.address_line2);
  const city = readString(shippingAddressSnapshot.city);
  const state = readString(shippingAddressSnapshot.state);
  const country = readString(shippingAddressSnapshot.country);

  const cityState = [city, state].filter(Boolean).join(", ");

  return [recipient, addressLine1, addressLine2, cityState, country].filter(Boolean);
};

export const getDeliveryWindow = (shippingAddressSnapshot: Json): DeliveryWindow => {
  if (isPlainRecord(shippingAddressSnapshot)) {
    const minSnapshot = readNumber(shippingAddressSnapshot.estimated_days_min);
    const maxSnapshot = readNumber(shippingAddressSnapshot.estimated_days_max);

    if (minSnapshot !== null && maxSnapshot !== null) {
      const minDays = Math.max(1, Math.round(minSnapshot));
      const maxDays = Math.max(minDays, Math.round(maxSnapshot));
      return { minDays, maxDays };
    }

    const state = readString(shippingAddressSnapshot.state).toLowerCase();
    if (state === "lagos") {
      return { minDays: 1, maxDays: 2 };
    }

    if (state.includes("fct") || state.includes("abuja")) {
      return { minDays: 2, maxDays: 3 };
    }
  }

  return { minDays: 3, maxDays: 5 };
};

const normalizeStatusHistory = (history: OrderStatusSummary[]): OrderStatusSummary[] =>
  [...history].sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());

export const buildLiveStatusSteps = (orderStatus: string, history: OrderStatusSummary[]): LiveStatusStep[] => {
  const normalizedOrderStatus = orderStatus.trim().toLowerCase();
  const normalizedHistory = normalizeStatusHistory(history);
  const latestByStatus = new Map<string, OrderStatusSummary>();

  for (const entry of normalizedHistory) {
    latestByStatus.set(entry.status.trim().toLowerCase(), entry);
  }

  const currentIndex = ORDER_STATUS_SEQUENCE.indexOf(
    normalizedOrderStatus as (typeof ORDER_STATUS_SEQUENCE)[number],
  );

  const baselineIndex = currentIndex >= 0 ? currentIndex : 0;

  const timeline = ORDER_STATUS_SEQUENCE.map((statusKey, index): LiveStatusStep => {
    const state: LiveStatusStep["state"] =
      index < baselineIndex ? "completed" : index === baselineIndex ? "current" : "upcoming";
    const historyEntry = latestByStatus.get(statusKey);

    return {
      key: statusKey,
      label: formatStatusLabel(statusKey),
      description: STATUS_DESCRIPTION[statusKey],
      note: historyEntry?.note ?? null,
      changedAt: historyEntry?.changed_at ?? null,
      state,
    };
  });

  if (normalizedOrderStatus === "cancelled") {
    timeline.push({
      key: "cancelled",
      label: formatStatusLabel("cancelled"),
      description: STATUS_DESCRIPTION.cancelled,
      note: latestByStatus.get("cancelled")?.note ?? null,
      changedAt: latestByStatus.get("cancelled")?.changed_at ?? null,
      state: "current",
    });
  }

  return timeline;
};
