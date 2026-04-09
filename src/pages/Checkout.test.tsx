import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { storeKeyPrefix } from "@/config/store.config";
import Checkout from "@/pages/Checkout";
import { REDIRECT_AFTER_LOGIN_KEY } from "@/services/authService";

const CHECKOUT_SESSION_STORAGE_KEY = `${storeKeyPrefix}_checkout_session_v1`;

const {
  clearCartMock,
  fetchActiveShippingRatesMock,
  fetchCheckoutSessionDataMock,
  fetchDiscountCodeMock,
  getOrderErrorMessageMock,
  getPaymentSettingsMock,
  getPaystackConfigMock,
  getPaystackMetadataMock,
  getTransactionChargeMock,
  isPaymentConfiguredMock,
  replaceItemsMock,
  resolveShippingRateForStateMock,
  submitOrderRpcMock,
  triggerNewOrderAdminNotificationMock,
  triggerOrderConfirmationEmailMock,
  useCartMock,
  validateCartMock,
} = vi.hoisted(() => ({
  clearCartMock: vi.fn(),
  fetchActiveShippingRatesMock: vi.fn(),
  fetchCheckoutSessionDataMock: vi.fn(),
  fetchDiscountCodeMock: vi.fn(),
  getOrderErrorMessageMock: vi.fn(),
  getPaymentSettingsMock: vi.fn(),
  getPaystackConfigMock: vi.fn(),
  getPaystackMetadataMock: vi.fn(),
  getTransactionChargeMock: vi.fn(),
  isPaymentConfiguredMock: vi.fn(),
  replaceItemsMock: vi.fn(),
  resolveShippingRateForStateMock: vi.fn(),
  submitOrderRpcMock: vi.fn(),
  triggerNewOrderAdminNotificationMock: vi.fn(),
  triggerOrderConfirmationEmailMock: vi.fn(),
  useCartMock: vi.fn(),
  validateCartMock: vi.fn(),
}));

vi.mock("@paystack/inline-js", () => ({
  default: {
    setup: vi.fn(),
  },
}));

vi.mock("@/contexts/CartContext", () => ({
  useCart: useCartMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("@/services/orderService", () => {
  class MockOrderSubmissionError extends Error {}

  return {
    fetchActiveShippingRates: fetchActiveShippingRatesMock,
    fetchCheckoutSessionData: fetchCheckoutSessionDataMock,
    fetchDiscountCode: fetchDiscountCodeMock,
    getOrderErrorMessage: getOrderErrorMessageMock,
    OrderSubmissionError: MockOrderSubmissionError,
    resolveShippingRateForState: resolveShippingRateForStateMock,
    submitOrderRpc: submitOrderRpcMock,
    triggerNewOrderAdminNotification: triggerNewOrderAdminNotificationMock,
    triggerOrderConfirmationEmail: triggerOrderConfirmationEmailMock,
  };
});

vi.mock("@/services/paymentSettingsService", () => ({
  getPaymentSettings: getPaymentSettingsMock,
}));

vi.mock("@/services/paystackService", () => ({
  getPaystackConfig: getPaystackConfigMock,
  getPaystackMetadata: getPaystackMetadataMock,
  getTransactionCharge: getTransactionChargeMock,
  isPaymentConfigured: isPaymentConfiguredMock,
}));

const baseCartItem = {
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

const baseSnapshot = {
  contact: {
    firstName: "Ama",
    lastName: "Mensah",
    email: "ama@example.com",
    phone: "0241234567",
    marketingOptIn: false,
  },
  delivery: {
    addressLine1: "12 Oxford Street",
    addressLine2: "",
    city: "Accra",
    state: "Greater Accra",
    country: "Ghana",
    deliveryInstructions: "",
    saveForFuture: false,
  },
  payment: {
    method: null,
  },
  review: {
    orderNotes: "",
  },
  completed: [] as string[],
  selectedSavedAddressId: null,
  discountInput: "",
  appliedDiscount: null,
};

const renderCheckout = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/checkout/*" element={<Checkout />} />
      </Routes>
    </MemoryRouter>,
  );

const writeCheckoutSnapshot = (snapshotOverrides: Partial<typeof baseSnapshot>) => {
  window.sessionStorage.setItem(
    CHECKOUT_SESSION_STORAGE_KEY,
    JSON.stringify({
      ...baseSnapshot,
      ...snapshotOverrides,
      contact: {
        ...baseSnapshot.contact,
        ...(snapshotOverrides.contact ?? {}),
      },
      delivery: {
        ...baseSnapshot.delivery,
        ...(snapshotOverrides.delivery ?? {}),
      },
      payment: {
        ...baseSnapshot.payment,
        ...(snapshotOverrides.payment ?? {}),
      },
      review: {
        ...baseSnapshot.review,
        ...(snapshotOverrides.review ?? {}),
      },
    }),
  );
};

describe("Checkout", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    clearCartMock.mockReset();
    fetchActiveShippingRatesMock.mockReset();
    fetchCheckoutSessionDataMock.mockReset();
    fetchDiscountCodeMock.mockReset();
    getOrderErrorMessageMock.mockReset();
    getPaymentSettingsMock.mockReset();
    getPaystackConfigMock.mockReset();
    getPaystackMetadataMock.mockReset();
    getTransactionChargeMock.mockReset();
    isPaymentConfiguredMock.mockReset();
    replaceItemsMock.mockReset();
    resolveShippingRateForStateMock.mockReset();
    submitOrderRpcMock.mockReset();
    triggerNewOrderAdminNotificationMock.mockReset();
    triggerOrderConfirmationEmailMock.mockReset();
    useCartMock.mockReset();
    validateCartMock.mockReset();

    validateCartMock.mockResolvedValue({
      state: {
        items: [baseCartItem],
      },
    });

    useCartMock.mockReturnValue({
      items: [baseCartItem],
      subtotal: 25000,
      totalItems: 1,
      validateCart: validateCartMock,
      isValidating: false,
      clearCart: clearCartMock,
      replaceItems: replaceItemsMock,
    });

    fetchCheckoutSessionDataMock.mockResolvedValue({
      isLoggedIn: false,
      userId: null,
      contactProfile: null,
      savedAddresses: [],
    });

    fetchActiveShippingRatesMock.mockResolvedValue([
      {
        id: "shipping-1",
        name: "Greater Accra",
        states: ["Greater Accra"],
        base_rate: 1500,
        estimated_days_min: 1,
        estimated_days_max: 2,
        is_active: true,
      },
    ]);

    getPaymentSettingsMock.mockResolvedValue({
      id: "payment-settings-1",
      cash_on_delivery_enabled: true,
      online_payment_enabled: true,
      updated_at: "2026-04-09T00:00:00.000Z",
    });

    getPaystackConfigMock.mockReturnValue({
      mode: "own_account",
      publicKey: "pk_test_checkout",
      subaccountCode: null,
      platformFeePercent: 0,
      bearer: "account",
      isSubaccountMode: false,
      isOwnAccountMode: true,
    });

    getPaystackMetadataMock.mockReturnValue({
      store_id: "escloset",
    });

    getTransactionChargeMock.mockReturnValue(0);
    getOrderErrorMessageMock.mockReturnValue("Something went wrong.");
    isPaymentConfiguredMock.mockReturnValue(true);
    submitOrderRpcMock.mockResolvedValue({
      order_number: "ORD-123",
      authorization_url: null,
      access_code: null,
      reference: null,
    });
    triggerNewOrderAdminNotificationMock.mockResolvedValue(undefined);
    triggerOrderConfirmationEmailMock.mockResolvedValue(undefined);
    fetchDiscountCodeMock.mockResolvedValue(null);
    resolveShippingRateForStateMock.mockResolvedValue(null);
  });

  it("shows guest checkout copy on the contact step and keeps sign-in redirect wiring", async () => {
    renderCheckout("/checkout/contact");

    await waitFor(() => {
      expect(screen.getByText(/Checking out as guest/i)).toBeInTheDocument();
    });

    const signInLink = screen.getByRole("link", { name: "Sign in instead" });
    expect(signInLink.getAttribute("href")).toContain("auth=login");
    expect(signInLink.getAttribute("href")).toContain("redirect=%2Fcheckout%2Fcontact");

    fireEvent.click(signInLink);

    expect(window.sessionStorage.getItem(REDIRECT_AFTER_LOGIN_KEY)).toBe("/checkout/contact");
  });

  it("auto-advances to review when a payment method is selected and persists the choice", async () => {
    writeCheckoutSnapshot({
      completed: ["contact", "delivery"],
    });

    renderCheckout("/checkout/payment");

    const paymentOption = await screen.findByRole("button", { name: /Cash on Delivery/i });
    fireEvent.click(paymentOption);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Review Your Order" })).toBeInTheDocument();
    });

    expect(screen.getByText("Cash on Delivery")).toBeInTheDocument();

    const storedSnapshot = JSON.parse(window.sessionStorage.getItem(CHECKOUT_SESSION_STORAGE_KEY) ?? "{}");
    expect(storedSnapshot.payment?.method).toBe("cash_on_delivery");
    expect(storedSnapshot.completed).toEqual(expect.arrayContaining(["payment"]));
  });

  it("does not auto-advance when a payment method is already restored", async () => {
    writeCheckoutSnapshot({
      payment: {
        method: "online",
      },
      completed: ["contact", "delivery"],
    });

    renderCheckout("/checkout/payment");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "How would you like to pay?" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("heading", { name: "Review Your Order" })).not.toBeInTheDocument();
  });
});
