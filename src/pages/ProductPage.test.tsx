import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductPage from "@/pages/ProductPage";

const {
  addToCartMock,
  fetchActiveShippingRatesMock,
  fetchCustomerProductReviewMock,
  fetchProductReviewsMock,
  fromMock,
  getPaymentSettingsMock,
  getRelatedProductsMock,
  submitProductReviewMock,
  useAuthMock,
  useCartMock,
  useThemeConfigMock,
} = vi.hoisted(() => ({
  addToCartMock: vi.fn(),
  fetchActiveShippingRatesMock: vi.fn(),
  fetchCustomerProductReviewMock: vi.fn(),
  fetchProductReviewsMock: vi.fn(),
  fromMock: vi.fn(),
  getPaymentSettingsMock: vi.fn(),
  getRelatedProductsMock: vi.fn(),
  submitProductReviewMock: vi.fn(),
  useAuthMock: vi.fn(),
  useCartMock: vi.fn(),
  useThemeConfigMock: vi.fn(),
}));

vi.mock("@/components/TryOnModal", () => ({
  default: () => null,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@/contexts/CartContext", () => ({
  useCart: useCartMock,
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useThemeConfig: useThemeConfigMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock("@/services/orderService", () => ({
  fetchActiveShippingRates: fetchActiveShippingRatesMock,
}));

vi.mock("@/services/paymentSettingsService", () => ({
  getPaymentSettings: getPaymentSettingsMock,
}));

vi.mock("@/services/productService", () => ({
  getRelatedProducts: getRelatedProductsMock,
}));

vi.mock("@/services/reviewService", () => ({
  buildReviewerDisplayName: vi.fn(() => "Guest Shopper"),
  fetchCustomerProductReview: fetchCustomerProductReviewMock,
  fetchProductReviews: fetchProductReviewsMock,
  submitProductReview: submitProductReviewMock,
}));

const emptyReviewSummary = {
  averageRating: 0,
  totalReviews: 0,
  distribution: {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  },
};

const baseProductRecord = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Silk Dress",
  slug: "silk-dress",
  description: "A soft silhouette for evenings out.",
  short_description: "Soft evening dress",
  price: 25000,
  compare_at_price: 30000,
  stock_quantity: 8,
  total_stock_quantity: 8,
  in_stock: true,
  is_available: true,
  has_variants: false,
  images: ["/dress.jpg"],
  benefits: [],
  tags: ["occasion"],
  weight_grams: 900,
  sku: "SDL-01",
  categories: {
    id: "cat-women",
    name: "Women",
    slug: "women",
  },
  product_option_types: [],
  product_variants: [],
};

const variantProductRecord = {
  ...baseProductRecord,
  id: "22222222-2222-2222-2222-222222222222",
  name: "Layered Dress",
  slug: "layered-dress",
  has_variants: true,
  stock_quantity: 0,
  total_stock_quantity: 4,
  sku: "LAY-01",
  product_option_types: [
    {
      id: "option-size",
      name: "Size",
      display_order: 0,
      product_option_values: [
        {
          id: "size-s",
          option_type_id: "option-size",
          value: "S",
          color_hex: null,
          display_order: 0,
        },
      ],
    },
  ],
  product_variants: [
    {
      id: "variant-s",
      label: "Small",
      price: 25000,
      compare_at_price: 30000,
      stock_quantity: 4,
      is_available: true,
      display_order: 0,
      sku: "LAY-S",
      product_variant_options: [
        {
          option_type_id: "option-size",
          option_value_id: "size-s",
        },
      ],
    },
  ],
};

const unavailableVariantProductRecord = {
  ...variantProductRecord,
  id: "33333333-3333-3333-3333-333333333333",
  slug: "sold-out-layered-dress",
  name: "Sold Out Layered Dress",
  total_stock_quantity: 0,
  product_variants: [
    {
      ...variantProductRecord.product_variants[0],
      id: "variant-sold-out",
      stock_quantity: 0,
      is_available: false,
      sku: "LAY-S-OOS",
    },
  ],
};

const mockProductLookup = (productRecord: Record<string, unknown>) => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.single.mockResolvedValue({
    data: productRecord,
    error: null,
  });

  fromMock.mockReturnValue(query);
};

const renderProductPage = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/shop/:slug" element={<ProductPage />} />
        <Route path="/checkout/contact" element={<div>Contact Information</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("ProductPage", () => {
  beforeEach(() => {
    addToCartMock.mockReset();
    fetchActiveShippingRatesMock.mockReset();
    fetchCustomerProductReviewMock.mockReset();
    fetchProductReviewsMock.mockReset();
    fromMock.mockReset();
    getPaymentSettingsMock.mockReset();
    getRelatedProductsMock.mockReset();
    submitProductReviewMock.mockReset();
    useAuthMock.mockReset();
    useCartMock.mockReset();
    useThemeConfigMock.mockReset();

    useAuthMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
    });

    useCartMock.mockReturnValue({
      addToCart: addToCartMock,
      isCartOpen: false,
    });

    useThemeConfigMock.mockReturnValue({
      preset: {
        tokens: {
          primary: "#D81B60",
        },
      },
    });

    fetchActiveShippingRatesMock.mockResolvedValue([]);
    fetchCustomerProductReviewMock.mockResolvedValue(null);
    fetchProductReviewsMock.mockResolvedValue({
      reviews: [],
      summary: emptyReviewSummary,
    });
    getPaymentSettingsMock.mockResolvedValue({
      id: "settings-1",
      cash_on_delivery_enabled: true,
      online_payment_enabled: true,
      updated_at: new Date(0).toISOString(),
    });
    getRelatedProductsMock.mockResolvedValue([]);
    submitProductReviewMock.mockResolvedValue(null);
  });

  it("renders split PDP CTAs and sends buy now shoppers straight to checkout", async () => {
    mockProductLookup(baseProductRecord);

    renderProductPage("/shop/silk-dress");

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /add to cart/i })).toHaveLength(2);
      expect(screen.getAllByRole("button", { name: /buy now/i })).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByRole("button", { name: /buy now/i })[0]);

    await waitFor(() => {
      expect(screen.getByText("Contact Information")).toBeInTheDocument();
    });

    expect(addToCartMock).toHaveBeenCalledTimes(1);
    expect(addToCartMock).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: baseProductRecord.id,
        name: baseProductRecord.name,
        slug: baseProductRecord.slug,
        stock_quantity: baseProductRecord.total_stock_quantity,
        variant_id: null,
      }),
      {
        openCart: false,
        showToast: false,
      },
    );
  });

  it("preselects the first available variant so buy now works immediately", async () => {
    mockProductLookup(variantProductRecord);

    renderProductPage("/shop/layered-dress");

    const buyNowButtons = await screen.findAllByRole("button", { name: /buy now/i });

    expect(buyNowButtons).toHaveLength(2);
    buyNowButtons.forEach((button) => expect(button).toBeEnabled());
    expect(screen.getAllByRole("button", { name: /add to cart/i })).toHaveLength(2);

    fireEvent.click(buyNowButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Contact Information")).toBeInTheDocument();
    });

    expect(addToCartMock).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: variantProductRecord.id,
        variant_id: "variant-s",
        variant_label: "Small",
        sku: "LAY-S",
        stock_quantity: 4,
      }),
      {
        openCart: false,
        showToast: false,
      },
    );
  });

  it("keeps buy now disabled when no available variant can be preselected", async () => {
    mockProductLookup(unavailableVariantProductRecord);

    renderProductPage("/shop/sold-out-layered-dress");

    const buyNowButtons = await screen.findAllByRole("button", { name: /buy now/i });

    expect(buyNowButtons).toHaveLength(2);
    buyNowButtons.forEach((button) => expect(button).toBeDisabled());
    expect(addToCartMock).not.toHaveBeenCalled();
  });
});
