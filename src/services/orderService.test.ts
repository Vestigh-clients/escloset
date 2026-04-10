import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SubmitOrderInput } from "@/services/orderService";
import { getOrderErrorMessage, submitOrderRpc } from "@/services/orderService";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

const baseInput: SubmitOrderInput = {
  customerId: null,
  firstName: "Test",
  lastName: "User",
  email: "test@example.com",
  phone: "0240000000",
  addressLine1: "123 Test Street",
  addressLine2: "",
  city: "Accra",
  state: "Greater Accra",
  country: "Ghana",
  deliveryInstructions: "",
  saveAddress: false,
  items: [
    {
      product_id: "11111111-1111-1111-1111-111111111111",
      name: "Sample Product",
      slug: "sample-product",
      category: "Category",
      price: 120,
      compare_at_price: null,
      image_url: "",
      image_alt: "Sample Product",
      sku: "SKU-1",
      quantity: 1,
      stock_quantity: 10,
      added_at: new Date().toISOString(),
      variant_id: null,
      variant_label: null,
    },
  ],
  subtotal: 120,
  shippingFee: 10,
  discountAmount: 0,
  total: 130,
  notes: "",
  paymentMethod: "cash_on_delivery",
  mobileMoneyNumber: null,
  orderStatus: "confirmed",
  paymentStatus: "pending",
  marketingOptIn: false,
  ipAddress: null,
};

describe("submitOrderRpc error mapping", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("maps postgres 42702 to service_unavailable", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: "42702",
        message: 'column reference "created_at" is ambiguous',
        details: "",
        hint: "",
      },
    });

    await expect(submitOrderRpc(baseInput)).rejects.toMatchObject({ type: "service_unavailable" });
  });

  it("maps postgrest PGRST202 to service_unavailable", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function public.submit_order without parameters in the schema cache",
        details: "",
        hint: "",
      },
    });

    await expect(submitOrderRpc(baseInput)).rejects.toMatchObject({ type: "service_unavailable" });
  });

  it("maps stock conflict messages to stock_conflict", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: "P0001",
        message: "STOCK_CONFLICT",
        details: "",
        hint: "",
      },
    });

    await expect(submitOrderRpc(baseInput)).rejects.toMatchObject({ type: "stock_conflict" });
  });

  it("maps timeout/network messages to timeout", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        message: "network request failed",
      },
    });

    await expect(submitOrderRpc(baseInput)).rejects.toMatchObject({ type: "timeout" });
  });

  it("falls back to generic for unknown errors", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: "22003",
        message: "numeric value out of range",
      },
    });

    await expect(submitOrderRpc(baseInput)).rejects.toMatchObject({ type: "generic" });
  });
});

describe("getOrderErrorMessage", () => {
  it("returns a dedicated message for service_unavailable", () => {
    expect(getOrderErrorMessage("service_unavailable")).toBe(
      "Checkout is temporarily unavailable. Please try again shortly.",
    );
  });
});
