import type { CartItem } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";

export type StockValidationMessageType = "error" | "info";

export interface StockValidationMessage {
  type: StockValidationMessageType;
  message: string;
}

export interface StockValidationResult {
  updatedItems: CartItem[];
  hasChanges: boolean;
  shouldBlockCheckout: boolean;
  blockingMessage: string | null;
  messages: StockValidationMessage[];
}

interface ProductStockRow {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  is_available: boolean | null;
}

const toStockQuantity = (value: number) => {
  const normalized = Number.isFinite(value) ? Math.trunc(value) : 0;
  return Math.max(0, normalized);
};

const toPrice = (value: number) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

export const validateCartStock = async (items: CartItem[]): Promise<StockValidationResult> => {
  if (items.length === 0) {
    return {
      updatedItems: [],
      hasChanges: false,
      shouldBlockCheckout: true,
      blockingMessage: "Your cart is empty.",
      messages: [],
    };
  }

  const cartProductIds = [...new Set(items.map((item) => item.product_id))];

  const { data, error } = await supabase
    .from("products")
    .select("id,name,price,stock_quantity,is_available")
    .in("id", cartProductIds);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ProductStockRow[];
  const rowById = new Map(rows.map((row) => [row.id, row]));

  const messages: StockValidationMessage[] = [];
  const updatedItems: CartItem[] = [];

  let hasChanges = false;
  let shouldBlockCheckout = false;
  let blockingMessage: string | null = null;

  for (const item of items) {
    const row = rowById.get(item.product_id);

    if (!row || row.is_available === false) {
      hasChanges = true;
      shouldBlockCheckout = true;

      if (!blockingMessage) {
        blockingMessage = `${item.name} is no longer available`;
      }

      messages.push({
        type: "error",
        message: `${item.name} is no longer available and has been removed from your cart`,
      });
      continue;
    }

    const currentName = row.name?.trim() || item.name;
    const currentPrice = toPrice(row.price);
    const currentStock = toStockQuantity(Number(row.stock_quantity));

    if (currentStock === 0) {
      hasChanges = true;
      shouldBlockCheckout = true;

      if (!blockingMessage) {
        blockingMessage = `${currentName} is no longer available`;
      }

      messages.push({
        type: "error",
        message: `${currentName} is no longer available and has been removed from your cart`,
      });
      continue;
    }

    const nextItem: CartItem = {
      ...item,
      name: currentName,
      price: currentPrice,
      stock_quantity: currentStock,
    };

    if (item.price !== currentPrice) {
      hasChanges = true;
      messages.push({
        type: "info",
        message: `Price updated for ${currentName}`,
      });
    }

    if (item.quantity > currentStock) {
      hasChanges = true;
      nextItem.quantity = currentStock;
      messages.push({
        type: "error",
        message: `Only ${currentStock} left in stock for ${currentName}`,
      });
    }

    updatedItems.push(nextItem);
  }

  if (updatedItems.length === 0) {
    shouldBlockCheckout = true;
    if (!blockingMessage) {
      blockingMessage = "Your cart is empty.";
    }
  }

  return {
    updatedItems,
    hasChanges,
    shouldBlockCheckout,
    blockingMessage,
    messages,
  };
};
