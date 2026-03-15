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
  compare_at_price: number | null;
  total_stock_quantity: number;
  in_stock: boolean | null;
  is_available: boolean | null;
}

interface VariantStockRow {
  id: string;
  product_id: string;
  stock_quantity: number;
  is_available: boolean | null;
  price: number | null;
  compare_at_price: number | null;
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

  const messages: StockValidationMessage[] = [];
  const updatedItems: CartItem[] = [];

  let hasChanges = false;
  let shouldBlockCheckout = false;
  let blockingMessage: string | null = null;

  for (const item of items) {
    const variantLabel = item.variant_label?.trim() || "";
    const itemDisplayName = variantLabel ? `${item.name} (${variantLabel})` : item.name;

    if (item.variant_id) {
      const { data: variant, error: variantError } = await supabase
        .from("product_variants")
        .select("id,product_id,stock_quantity,is_available,price,compare_at_price")
        .eq("id", item.variant_id)
        .maybeSingle();

      if (variantError) {
        throw variantError;
      }

      const variantRow = variant as VariantStockRow | null;
      if (
        !variantRow ||
        variantRow.product_id !== item.product_id ||
        variantRow.is_available === false ||
        toStockQuantity(Number(variantRow.stock_quantity)) === 0
      ) {
        hasChanges = true;
        shouldBlockCheckout = true;

        if (!blockingMessage) {
          blockingMessage = `${itemDisplayName} is no longer available`;
        }

        messages.push({
          type: "error",
          message: `${itemDisplayName} is no longer available and has been removed from your cart`,
        });
        continue;
      }

      const currentVariantStock = toStockQuantity(Number(variantRow.stock_quantity));
      const currentVariantPrice = variantRow.price === null || variantRow.price === undefined ? item.price : toPrice(variantRow.price);
      const currentVariantCompareAt =
        variantRow.compare_at_price === null || variantRow.compare_at_price === undefined
          ? item.compare_at_price
          : toPrice(variantRow.compare_at_price);

      const nextItem: CartItem = {
        ...item,
        price: currentVariantPrice,
        compare_at_price: currentVariantCompareAt,
        stock_quantity: currentVariantStock,
      };

      if (item.price !== currentVariantPrice) {
        hasChanges = true;
        messages.push({
          type: "info",
          message: `Price updated for ${itemDisplayName}`,
        });
      }

      if (item.quantity > currentVariantStock) {
        hasChanges = true;
        nextItem.quantity = currentVariantStock;
        messages.push({
          type: "error",
          message: `Quantity adjusted for ${itemDisplayName} - only ${currentVariantStock} left in stock`,
        });
      }

      updatedItems.push(nextItem);
      continue;
    }

    const { data: row, error: productError } = await (supabase as any)
      .from("products_with_stock")
      .select("id,name,price,compare_at_price,is_available,in_stock,total_stock_quantity")
      .eq("id", item.product_id)
      .maybeSingle();

    if (productError) {
      throw productError;
    }

    const productRow = row as ProductStockRow | null;
    if (!productRow || productRow.is_available === false || productRow.in_stock !== true) {
      hasChanges = true;
      shouldBlockCheckout = true;

      if (!blockingMessage) {
        blockingMessage = `${itemDisplayName} is no longer available`;
      }

      messages.push({
        type: "error",
        message: `${itemDisplayName} is no longer available and has been removed from your cart`,
      });
      continue;
    }

    const currentName = productRow.name?.trim() || item.name;
    const currentPrice = toPrice(productRow.price);
    const currentProductCompareAtPrice =
      productRow.compare_at_price === null || productRow.compare_at_price === undefined
        ? null
        : toPrice(productRow.compare_at_price);
    const currentStock = toStockQuantity(Number(productRow.total_stock_quantity));

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
      compare_at_price: currentProductCompareAtPrice,
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

