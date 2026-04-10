import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "@/components/ui/sonner";
import { storeKeyPrefix } from "@/config/store.config";
import { validateCartStock } from "@/services/stockService";

const CART_STORAGE_KEY = `${storeKeyPrefix}_cart`;
const CART_VERSION_STORAGE_KEY = `${storeKeyPrefix}_cart_version`;
const CART_SCHEMA_VERSION = 3;
const CART_TOAST_DURATION_MS = 2500;

export interface CartItem {
  product_id: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  compare_at_price: number | null;
  image_url: string;
  image_alt: string;
  sku: string | null;
  quantity: number;
  stock_quantity: number;
  added_at: string;
  variant_id: string | null;
  variant_label: string | null;
}

export interface CartState {
  items: CartItem[];
  total_items: number;
  subtotal: number;
  last_updated: string;
}

export interface CartProductInput {
  product_id: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  compare_at_price: number | null;
  image_url: string;
  image_alt: string;
  sku: string | null;
  stock_quantity: number;
  variant_id: string | null;
  variant_label: string | null;
}

export interface AddToCartOptions {
  openCart?: boolean;
  showToast?: boolean;
}

interface ValidateCartResult {
  state: CartState;
  hasChanges: boolean;
}

interface CartContextValue {
  cart: CartState;
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  savings: number;
  isCartOpen: boolean;
  isValidating: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (product: CartProductInput, options?: AddToCartOptions) => void;
  removeFromCart: (productId: string, variantId?: string | null) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string | null) => void;
  replaceItems: (items: CartItem[]) => void;
  clearCart: () => void;
  validateCart: () => Promise<ValidateCartResult>;
}

const CartContext = createContext<CartContextValue | null>(null);

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
};

const toNonEmptyString = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const normalizeCartItem = (value: unknown): CartItem | null => {
  if (!isPlainRecord(value)) {
    return null;
  }

  const productId = toNonEmptyString(value.product_id, "");
  const name = toNonEmptyString(value.name, "");

  if (!productId || !name) {
    return null;
  }

  const stockQuantity = Math.max(0, Math.trunc(toFiniteNumber(value.stock_quantity, 0)));
  const requestedQuantity = Math.trunc(toFiniteNumber(value.quantity, 1));
  const quantity = Math.min(stockQuantity, Math.max(1, requestedQuantity));

  if (stockQuantity < 1) {
    return null;
  }

  const price = Math.max(0, toFiniteNumber(value.price, 0));
  const compareAtPriceRaw = value.compare_at_price;
  const compareAtPrice =
    compareAtPriceRaw === null || compareAtPriceRaw === undefined
      ? null
      : Math.max(0, toFiniteNumber(compareAtPriceRaw, 0));

  return {
    product_id: productId,
    name,
    slug: toNonEmptyString(value.slug, productId),
    category: toNonEmptyString(value.category, "Product"),
    price,
    compare_at_price: compareAtPrice,
    image_url: toNonEmptyString(value.image_url, ""),
    image_alt: toNonEmptyString(value.image_alt, name),
    sku: typeof value.sku === "string" ? value.sku : null,
    quantity,
    stock_quantity: stockQuantity,
    added_at: toNonEmptyString(value.added_at, new Date().toISOString()),
    variant_id: typeof value.variant_id === "string" && value.variant_id.trim() ? value.variant_id : null,
    variant_label: typeof value.variant_label === "string" && value.variant_label.trim() ? value.variant_label : null,
  };
};

const isSameCartLine = (item: CartItem, productId: string, variantId?: string | null) => {
  return item.product_id === productId && item.variant_id === (variantId ?? null);
};

const sanitizeCart = (items: CartItem[]): CartItem[] => {
  return items.filter((item) => UUID_REGEX.test(item.product_id));
};

const getTotals = (items: CartItem[]) => {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return {
    totalItems,
    subtotal,
  };
};

const createCartState = (items: CartItem[], lastUpdated = new Date().toISOString()): CartState => {
  const { totalItems, subtotal } = getTotals(items);

  return {
    items,
    total_items: totalItems,
    subtotal,
    last_updated: lastUpdated,
  };
};

const clearStoredCart = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(CART_STORAGE_KEY);
  window.localStorage.removeItem(CART_VERSION_STORAGE_KEY);
};

const getInitialCartState = (): CartState => {
  if (typeof window === "undefined") {
    return createCartState([]);
  }

  const storedVersion = window.localStorage.getItem(CART_VERSION_STORAGE_KEY);

  if (storedVersion !== String(CART_SCHEMA_VERSION)) {
    clearStoredCart();
    return createCartState([]);
  }

  const raw = window.localStorage.getItem(CART_STORAGE_KEY);

  if (!raw) {
    return createCartState([]);
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CartState>;
    const normalizedItems = Array.isArray(parsed.items)
      ? parsed.items
          .map((entry) => normalizeCartItem(entry))
          .filter((entry): entry is CartItem => Boolean(entry))
      : [];
    const parsedItems = sanitizeCart(normalizedItems);

    return createCartState(
      parsedItems,
      typeof parsed.last_updated === "string" ? parsed.last_updated : new Date().toISOString(),
    );
  } catch {
    clearStoredCart();
    return createCartState([]);
  }
};

const showNeutralToast = (message: string) => {
  toast(message, {
    duration: CART_TOAST_DURATION_MS,
    className: "lux-cart-toast",
  });
};

const showErrorToast = (message: string) => {
  toast(message, {
    duration: CART_TOAST_DURATION_MS,
    className: "lux-cart-toast lux-cart-toast-error",
  });
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartState, setCartState] = useState<CartState>(() => createCartState([]));
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isStorageReady, setIsStorageReady] = useState(false);

  const cartStateRef = useRef<CartState>(cartState);
  const skipNextStorageSyncRef = useRef(false);
  const validationPromiseRef = useRef<Promise<ValidateCartResult> | null>(null);

  const commitItems = useCallback((items: CartItem[]) => {
    const nextState = createCartState(items);
    cartStateRef.current = nextState;
    setCartState(nextState);
    return nextState;
  }, []);

  useEffect(() => {
    cartStateRef.current = cartState;
  }, [cartState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const restoredState = getInitialCartState();
    cartStateRef.current = restoredState;
    setCartState(restoredState);
    setIsStorageReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!isStorageReady) {
      return;
    }

    if (skipNextStorageSyncRef.current) {
      skipNextStorageSyncRef.current = false;
      return;
    }

    window.localStorage.setItem(CART_VERSION_STORAGE_KEY, String(CART_SCHEMA_VERSION));
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartState));
  }, [cartState, isStorageReady]);

  const closeCart = useCallback(() => {
    setIsCartOpen(false);
  }, []);

  const openCartDrawer = useCallback(() => {
    setIsCartOpen(true);
  }, []);

  const validateCart = useCallback(async (): Promise<ValidateCartResult> => {
    if (validationPromiseRef.current) {
      return validationPromiseRef.current;
    }

    const validationPromise = (async (): Promise<ValidateCartResult> => {
      const currentState = cartStateRef.current;

      if (currentState.items.length === 0) {
        return {
          state: currentState,
          hasChanges: false,
        };
      }

      setIsValidating(true);

      let validation: Awaited<ReturnType<typeof validateCartStock>>;
      try {
        validation = await validateCartStock(currentState.items);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Failed to validate cart stock", error);
        }

        return {
          state: currentState,
          hasChanges: false,
        };
      }

      for (const message of validation.messages) {
        if (message.type === "error") {
          showErrorToast(message.message);
        } else {
          showNeutralToast(message.message);
        }
      }

      const nextState = validation.hasChanges ? commitItems(validation.updatedItems) : currentState;

      return {
        state: nextState,
        hasChanges: validation.hasChanges,
      };
    })();

    validationPromiseRef.current = validationPromise;

    try {
      return await validationPromise;
    } finally {
      validationPromiseRef.current = null;
      setIsValidating(false);
    }
  }, [commitItems]);

  const openCart = useCallback(() => {
    openCartDrawer();
    void validateCart();
  }, [openCartDrawer, validateCart]);

  const addToCart = useCallback(
    (product: CartProductInput, options?: AddToCartOptions) => {
      if (product.stock_quantity <= 0) {
        return;
      }

      const shouldOpenCart = options?.openCart ?? true;
      const shouldShowToast = options?.showToast ?? true;
      const currentItems = cartStateRef.current.items;
      const existingIndex = currentItems.findIndex((item) => isSameCartLine(item, product.product_id, product.variant_id));

      if (existingIndex >= 0) {
        const existingItem = currentItems[existingIndex];
        const cappedQuantity = Math.min(existingItem.quantity + 1, product.stock_quantity);

        if (cappedQuantity === existingItem.quantity) {
          return;
        }

        const nextItems = [...currentItems];
        nextItems[existingIndex] = {
          ...existingItem,
          name: product.name,
          slug: product.slug,
          category: product.category,
          price: product.price,
          compare_at_price: product.compare_at_price,
          image_url: product.image_url,
          image_alt: product.image_alt,
          sku: product.sku,
          stock_quantity: product.stock_quantity,
          variant_id: product.variant_id,
          variant_label: product.variant_label,
          quantity: cappedQuantity,
        };

        commitItems(nextItems);
        if (shouldOpenCart) {
          openCartDrawer();
        }
        if (shouldShowToast) {
          showNeutralToast(`${product.name} added to cart`);
        }
        return;
      }

      const nextItems = [
        ...currentItems,
        {
          ...product,
          quantity: 1,
          added_at: new Date().toISOString(),
        },
      ];

      commitItems(nextItems);
      if (shouldOpenCart) {
        openCartDrawer();
      }
      if (shouldShowToast) {
        showNeutralToast(`${product.name} added to cart`);
      }
    },
    [commitItems, openCartDrawer],
  );

  const removeFromCart = useCallback(
    (productId: string, variantId?: string | null) => {
      const currentItems = cartStateRef.current.items;
      const targetItem = currentItems.find((item) => isSameCartLine(item, productId, variantId));

      if (!targetItem) {
        return;
      }

      const nextItems = currentItems.filter((item) => !isSameCartLine(item, productId, variantId));
      commitItems(nextItems);
      showNeutralToast(`${targetItem.name} removed from cart`);
    },
    [commitItems],
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number, variantId?: string | null) => {
      const targetItem = cartStateRef.current.items.find((item) => isSameCartLine(item, productId, variantId));

      if (!targetItem) {
        return;
      }

      const normalizedQuantity = Math.trunc(quantity);

      if (normalizedQuantity < 1) {
        removeFromCart(productId, variantId);
        return;
      }

      const cappedQuantity = Math.min(normalizedQuantity, targetItem.stock_quantity);

      if (normalizedQuantity > targetItem.stock_quantity) {
        showErrorToast(`Only ${targetItem.stock_quantity} left in stock`);
      }

      if (cappedQuantity === targetItem.quantity) {
        return;
      }

      const nextItems = cartStateRef.current.items.map((item) =>
        isSameCartLine(item, productId, variantId)
          ? {
              ...item,
              quantity: cappedQuantity,
            }
          : item,
      );

      commitItems(nextItems);
    },
    [commitItems, removeFromCart],
  );

  const replaceItems = useCallback(
    (items: CartItem[]) => {
      commitItems(items);
    },
    [commitItems],
  );

  const clearCart = useCallback(() => {
    skipNextStorageSyncRef.current = true;
    clearStoredCart();

    const emptyState = createCartState([]);
    cartStateRef.current = emptyState;
    setCartState(emptyState);
  }, []);

  const savings = useMemo(
    () =>
      cartState.items.reduce((sum, item) => {
        if (item.compare_at_price === null || item.compare_at_price <= item.price) {
          return sum;
        }

        return sum + (item.compare_at_price - item.price) * item.quantity;
      }, 0),
    [cartState.items],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart: cartState,
      items: cartState.items,
      totalItems: cartState.total_items,
      subtotal: cartState.subtotal,
      savings,
      isCartOpen,
      isValidating,
      openCart,
      closeCart,
      addToCart,
      removeFromCart,
      updateQuantity,
      replaceItems,
      clearCart,
      validateCart,
    }),
    [
      addToCart,
      cartState,
      clearCart,
      closeCart,
      isCartOpen,
      isValidating,
      openCart,
      replaceItems,
      removeFromCart,
      savings,
      updateQuantity,
      validateCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }

  return context;
};
