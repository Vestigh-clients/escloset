import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartProvider, useCart, type CartItem, type CartProductInput } from "@/contexts/CartContext";

const { toastMock, validateCartStockMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  validateCartStockMock: vi.fn(),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: toastMock,
}));

vi.mock("@/services/stockService", () => ({
  validateCartStock: validateCartStockMock,
}));

const expandableProduct: CartProductInput = {
  product_id: "11111111-1111-1111-1111-111111111111",
  name: "Expandable Dress",
  slug: "expandable-dress",
  category: "Women",
  price: 120,
  compare_at_price: 150,
  image_url: "/expandable.jpg",
  image_alt: "Expandable Dress",
  sku: "EXP-1",
  stock_quantity: 3,
  variant_id: null,
  variant_label: null,
};

const limitedProduct: CartProductInput = {
  product_id: "22222222-2222-2222-2222-222222222222",
  name: "Limited Bag",
  slug: "limited-bag",
  category: "Accessories",
  price: 90,
  compare_at_price: null,
  image_url: "/limited.jpg",
  image_alt: "Limited Bag",
  sku: "LIM-1",
  stock_quantity: 1,
  variant_id: null,
  variant_label: null,
};

const unavailableProduct: CartProductInput = {
  product_id: "33333333-3333-3333-3333-333333333333",
  name: "Sold Out Heels",
  slug: "sold-out-heels",
  category: "Shoes",
  price: 140,
  compare_at_price: null,
  image_url: "/heels.jpg",
  image_alt: "Sold Out Heels",
  sku: "OOS-1",
  stock_quantity: 0,
  variant_id: null,
  variant_label: null,
};

const CartHarness = () => {
  const { addToCart, closeCart, isCartOpen, items, openCart, totalItems } = useCart();

  return (
    <div>
      <div data-testid="is-cart-open">{String(isCartOpen)}</div>
      <div data-testid="total-items">{String(totalItems)}</div>
      <div data-testid="first-item-quantity">{String(items[0]?.quantity ?? 0)}</div>
      <button type="button" onClick={() => addToCart(expandableProduct)}>
        Add expandable
      </button>
      <button type="button" onClick={() => addToCart(limitedProduct)}>
        Add limited
      </button>
      <button type="button" onClick={() => addToCart(unavailableProduct)}>
        Add unavailable
      </button>
      <button type="button" onClick={closeCart}>
        Close cart
      </button>
      <button type="button" onClick={openCart}>
        Open cart
      </button>
    </div>
  );
};

const renderCartProvider = () =>
  render(
    <CartProvider>
      <CartHarness />
    </CartProvider>,
  );

describe("CartProvider auto-open behavior", () => {
  beforeEach(() => {
    window.localStorage.clear();
    toastMock.mockReset();
    validateCartStockMock.mockReset();
    validateCartStockMock.mockResolvedValue({
      updatedItems: [] satisfies CartItem[],
      hasChanges: false,
      shouldBlockCheckout: false,
      blockingMessage: null,
      messages: [],
    });
  });

  it("opens the drawer after a successful add", () => {
    renderCartProvider();

    expect(screen.getByTestId("is-cart-open")).toHaveTextContent("false");

    fireEvent.click(screen.getByRole("button", { name: "Add expandable" }));

    expect(screen.getByTestId("is-cart-open")).toHaveTextContent("true");
    expect(screen.getByTestId("total-items")).toHaveTextContent("1");
    expect(screen.getByTestId("first-item-quantity")).toHaveTextContent("1");
    expect(validateCartStockMock).not.toHaveBeenCalled();
  });

  it("reopens the drawer when the same item quantity increases", () => {
    renderCartProvider();

    fireEvent.click(screen.getByRole("button", { name: "Add expandable" }));
    fireEvent.click(screen.getByRole("button", { name: "Close cart" }));

    expect(screen.getByTestId("is-cart-open")).toHaveTextContent("false");

    fireEvent.click(screen.getByRole("button", { name: "Add expandable" }));

    expect(screen.getByTestId("is-cart-open")).toHaveTextContent("true");
    expect(screen.getByTestId("total-items")).toHaveTextContent("2");
    expect(screen.getByTestId("first-item-quantity")).toHaveTextContent("2");
    expect(validateCartStockMock).not.toHaveBeenCalled();
  });

  it("does not auto-open when add-to-cart is rejected or already capped", () => {
    renderCartProvider();

    fireEvent.click(screen.getByRole("button", { name: "Add unavailable" }));

    expect(screen.getByTestId("is-cart-open")).toHaveTextContent("false");
    expect(screen.getByTestId("total-items")).toHaveTextContent("0");

    fireEvent.click(screen.getByRole("button", { name: "Add limited" }));
    fireEvent.click(screen.getByRole("button", { name: "Close cart" }));

    expect(screen.getByTestId("is-cart-open")).toHaveTextContent("false");

    fireEvent.click(screen.getByRole("button", { name: "Add limited" }));

    expect(screen.getByTestId("is-cart-open")).toHaveTextContent("false");
    expect(screen.getByTestId("total-items")).toHaveTextContent("1");
    expect(screen.getByTestId("first-item-quantity")).toHaveTextContent("1");
    expect(validateCartStockMock).not.toHaveBeenCalled();
  });

  it("keeps manual open validation separate from add-to-cart auto-open", async () => {
    renderCartProvider();

    fireEvent.click(screen.getByRole("button", { name: "Add expandable" }));

    expect(screen.getByTestId("is-cart-open")).toHaveTextContent("true");
    expect(validateCartStockMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Close cart" }));
    fireEvent.click(screen.getByRole("button", { name: "Open cart" }));

    expect(screen.getByTestId("is-cart-open")).toHaveTextContent("true");

    await waitFor(() => {
      expect(validateCartStockMock).toHaveBeenCalledTimes(1);
    });

    expect(validateCartStockMock.mock.calls[0]?.[0]).toHaveLength(1);
  });
});
