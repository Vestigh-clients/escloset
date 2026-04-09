import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CartDrawer from "@/components/cart/CartDrawer";

const {
  closeCartMock,
  removeFromCartMock,
  updateQuantityMock,
  useCartMock,
  validateCartMock,
} = vi.hoisted(() => ({
  closeCartMock: vi.fn(),
  removeFromCartMock: vi.fn(),
  updateQuantityMock: vi.fn(),
  useCartMock: vi.fn(),
  validateCartMock: vi.fn(),
}));

vi.mock("@/contexts/CartContext", () => ({
  useCart: useCartMock,
}));

describe("CartDrawer", () => {
  beforeEach(() => {
    closeCartMock.mockReset();
    removeFromCartMock.mockReset();
    updateQuantityMock.mockReset();
    useCartMock.mockReset();
    validateCartMock.mockReset();

    const item = {
      product_id: "product-1",
      variant_id: null,
      name: "Silk Dress",
      slug: "silk-dress",
      category: "Women",
      price: 25000,
      compare_at_price: null,
      image_url: "/dress.jpg",
      image_alt: "Silk Dress",
      quantity: 1,
      stock_quantity: 5,
      variant_label: null,
    };

    validateCartMock.mockResolvedValue({
      state: {
        items: [item],
      },
    });

    useCartMock.mockReturnValue({
      items: [item],
      totalItems: 1,
      subtotal: 25000,
      savings: 0,
      isCartOpen: true,
      isValidating: false,
      closeCart: closeCartMock,
      updateQuantity: updateQuantityMock,
      removeFromCart: removeFromCartMock,
      validateCart: validateCartMock,
    });
  });

  it("routes checkout traffic directly to contact information after validation", async () => {
    render(
      <MemoryRouter initialEntries={["/cart"]}>
        <Routes>
          <Route path="/cart" element={<CartDrawer />} />
          <Route path="/checkout/contact" element={<div>Contact Information</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Proceed to Checkout" }));

    await waitFor(() => {
      expect(screen.getByText("Contact Information")).toBeInTheDocument();
    });

    expect(validateCartMock).toHaveBeenCalledTimes(1);
    expect(closeCartMock).toHaveBeenCalledTimes(1);
  });
});
