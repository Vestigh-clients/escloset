import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminOrderDetailPage from "@/pages/admin/AdminOrderDetailPage";
import type { AdminOrderDetail } from "@/services/adminService";

const { cancelAdminOrderMock, fetchAdminOrderDetailMock, updateAdminOrderStatusMock } = vi.hoisted(() => ({
  cancelAdminOrderMock: vi.fn(),
  fetchAdminOrderDetailMock: vi.fn(),
  updateAdminOrderStatusMock: vi.fn(),
}));

vi.mock("@/services/adminService", () => ({
  buildStatusLabel: (value: string) =>
    value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase()),
  cancelAdminOrder: cancelAdminOrderMock,
  fetchAdminOrderDetail: fetchAdminOrderDetailMock,
  updateAdminOrderStatus: updateAdminOrderStatusMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      email: "owner@example.com",
    },
  }),
}));

type OrderOverrides = Partial<AdminOrderDetail> & {
  customer?: Partial<AdminOrderDetail["customer"]>;
  order_items?: AdminOrderDetail["order_items"];
};

const createOrder = (overrides: OrderOverrides = {}): AdminOrderDetail => {
  const baseOrder: AdminOrderDetail = {
    id: "order-1",
    order_number: "ORD-2026-001",
    customer_id: "customer-1",
    created_at: "2026-04-09T10:00:00.000Z",
    status: "pending",
    payment_status: "pending",
    payment_method: "cash_on_delivery",
    payment_reference: null,
    mobile_money_number: null,
    subtotal: 240,
    shipping_fee: 20,
    discount_amount: null,
    total: 260,
    notes: "Please ring at the gate.",
    cancel_reason: null,
    cancelled_at: null,
    shipping_address_snapshot: {
      recipient_name: "Ama Mensah",
      address_line1: "12 Palm Street",
      address_line2: "Near the pharmacy",
      city: "Accra",
      state: "Greater Accra",
      country: "Ghana",
    },
    customer: {
      id: "customer-1",
      first_name: "Ama",
      last_name: "Mensah",
      email: "ama@example.com",
      phone: "0244 123 456",
      total_orders: 5,
      total_spent: 900,
    },
    order_items: [
      {
        id: "item-1",
        product_id: "product-1",
        product_name: "Linen Dress",
        product_sku: "LIN-001",
        product_image_url: "https://example.com/dress.jpg",
        unit_price: 120,
        compare_at_price: null,
        quantity: 2,
        subtotal: 240,
        variant_id: "variant-1",
        variant_label: "Black / XL",
        variant_sku: "LIN-001-BLK-XL",
        product_slug: "linen-dress",
      },
      {
        id: "item-2",
        product_id: "product-2",
        product_name: "Leather Sandals",
        product_sku: "SAN-009",
        product_image_url: null,
        unit_price: 80,
        compare_at_price: null,
        quantity: 1,
        subtotal: 80,
        variant_id: "variant-2",
        variant_label: "Tan / 39",
        variant_sku: "SAN-009-TAN-39",
        product_slug: "leather-sandals",
      },
    ],
    order_status_history: [],
  };

  return {
    ...baseOrder,
    ...overrides,
    customer: {
      ...baseOrder.customer,
      ...overrides.customer,
    },
    order_items: overrides.order_items ?? baseOrder.order_items,
  };
};

const renderPage = () => {
  render(
    <MemoryRouter initialEntries={["/admin/orders/ORD-2026-001"]}>
      <Routes>
        <Route path="/admin/orders/:orderNumber" element={<AdminOrderDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("AdminOrderDetailPage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1280,
    });

    fetchAdminOrderDetailMock.mockReset();
    cancelAdminOrderMock.mockReset();
    updateAdminOrderStatusMock.mockReset();
  });

  it("renders the simplified order view and hides the removed admin controls", async () => {
    fetchAdminOrderDetailMock.mockResolvedValue(createOrder());

    renderPage();

    await waitFor(() => {
      expect(fetchAdminOrderDetailMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole("link", { name: "Back to Orders" })).toHaveAttribute("href", "/admin/orders");
    expect(screen.getByRole("heading", { name: "ORD-2026-001" })).toBeInTheDocument();
    expect(screen.getByText("Linen Dress")).toBeInTheDocument();
    expect(screen.getByText("Leather Sandals")).toBeInTheDocument();
    expect(screen.getByText("Color: Black / XL")).toBeInTheDocument();
    expect(screen.getByText("Qty: 2")).toBeInTheDocument();
    expect(screen.getByTestId("payment-status-badge")).toHaveTextContent("Pending Payment");
    expect(screen.getByTestId("payment-status-badge")).toHaveAttribute("data-payment-state", "pending");
    expect(screen.getByText("Ama Mensah")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call Ama Mensah" })).toHaveAttribute("href", "tel:0244123456");
    expect(screen.getByText("12 Palm Street")).toBeInTheDocument();
    expect(screen.getByText("Near the pharmacy")).toBeInTheDocument();
    expect(screen.getByText("Accra, Greater Accra")).toBeInTheDocument();
    expect(screen.getByTestId("desktop-status-card")).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-status-bar")).not.toBeInTheDocument();

    expect(screen.queryByText("Payment Status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update Payment" })).not.toBeInTheDocument();
    expect(screen.queryByText("Notify customer")).not.toBeInTheDocument();
    expect(screen.queryByText("Order History")).not.toBeInTheDocument();
    expect(screen.queryByText("View Customer")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel Order" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Note about this status change...")).not.toBeInTheDocument();
  });

  it("renders a paid payment badge when the order is paid", async () => {
    fetchAdminOrderDetailMock.mockResolvedValue(createOrder({ payment_status: "paid" }));

    renderPage();

    await waitFor(() => {
      expect(fetchAdminOrderDetailMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId("payment-status-badge")).toHaveTextContent("Paid");
    expect(screen.getByTestId("payment-status-badge")).toHaveAttribute("data-payment-state", "paid");
  });

  it.each(["pending", "failed", "review"] as const)("maps %s payment status to pending payment badge", async (paymentStatus) => {
    fetchAdminOrderDetailMock.mockResolvedValue(createOrder({ payment_status: paymentStatus }));

    renderPage();

    await waitFor(() => {
      expect(fetchAdminOrderDetailMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId("payment-status-badge")).toHaveTextContent("Pending Payment");
    expect(screen.getByTestId("payment-status-badge")).toHaveAttribute("data-payment-state", "pending");
  });

  it("shows out-of-flow statuses as inactive while still allowing status actions", async () => {
    fetchAdminOrderDetailMock.mockResolvedValue(createOrder({ status: "pending" }));

    renderPage();

    await waitFor(() => {
      expect(fetchAdminOrderDetailMock).toHaveBeenCalledTimes(1);
    });

    const processingButton = screen.getByRole("button", { name: "Processing" });
    const shippedButton = screen.getByRole("button", { name: "Shipped" });
    const deliveredButton = screen.getByRole("button", { name: "Delivered" });

    expect(processingButton).toHaveAttribute("data-stage-state", "inactive");
    expect(shippedButton).toHaveAttribute("data-stage-state", "inactive");
    expect(deliveredButton).toHaveAttribute("data-stage-state", "inactive");
    expect(processingButton).not.toBeDisabled();
    expect(shippedButton).not.toBeDisabled();
    expect(deliveredButton).not.toBeDisabled();

    fireEvent.click(shippedButton);
    expect(screen.getByRole("dialog", { name: "Mark this order as Shipped" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(updateAdminOrderStatusMock).not.toHaveBeenCalled();
  });

  it("disables fulfillment actions and hides cancel once the order is cancelled", async () => {
    fetchAdminOrderDetailMock.mockResolvedValue(createOrder({ status: "cancelled", cancel_reason: "Customer requested cancellation." }));

    renderPage();

    await waitFor(() => {
      expect(fetchAdminOrderDetailMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("This order has been cancelled. No further processing is needed.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel Order" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Processing" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Shipped" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delivered" })).not.toBeInTheDocument();
  });

  it("cancels an order with the default admin reason", async () => {
    cancelAdminOrderMock.mockResolvedValue(undefined);
    fetchAdminOrderDetailMock
      .mockResolvedValueOnce(createOrder({ status: "processing" }))
      .mockResolvedValueOnce(createOrder({ status: "cancelled", cancel_reason: "Cancelled by store owner" }));

    renderPage();

    await waitFor(() => {
      expect(fetchAdminOrderDetailMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel Order" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel this order" });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel Order" }));

    await waitFor(() => {
      expect(cancelAdminOrderMock).toHaveBeenCalledTimes(1);
    });

    expect(cancelAdminOrderMock).toHaveBeenCalledWith(expect.objectContaining({
      reason: "Cancelled by store owner",
      adminEmail: "owner@example.com",
      order: expect.objectContaining({
        status: "processing",
      }),
    }));
    expect(updateAdminOrderStatusMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText("This order has been cancelled. No further processing is needed.")).toBeInTheDocument();
    });
  });

  it("updates shipped sequentially from a pending order", async () => {
    fetchAdminOrderDetailMock
      .mockResolvedValueOnce(createOrder({ status: "pending" }))
      .mockResolvedValueOnce(createOrder({ status: "shipped" }));

    renderPage();

    await waitFor(() => {
      expect(fetchAdminOrderDetailMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Shipped" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(updateAdminOrderStatusMock).toHaveBeenCalledTimes(2);
    });

    expect(updateAdminOrderStatusMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      nextStatus: "processing",
      note: "",
      notifyCustomer: true,
      adminEmail: "owner@example.com",
    }));
    expect(updateAdminOrderStatusMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      nextStatus: "shipped",
      note: "",
      notifyCustomer: true,
      adminEmail: "owner@example.com",
      order: expect.objectContaining({
        status: "processing",
      }),
    }));

    await waitFor(() => {
      expect(screen.getByText("Updated")).toBeInTheDocument();
    });
  });

  it("reflects completed stages and disables earlier buttons once the order has progressed", async () => {
    fetchAdminOrderDetailMock.mockResolvedValue(createOrder({ status: "delivered" }));

    renderPage();

    await waitFor(() => {
      expect(fetchAdminOrderDetailMock).toHaveBeenCalledTimes(1);
    });

    const processingButton = screen.getByRole("button", { name: "Processing" });
    const shippedButton = screen.getByRole("button", { name: "Shipped" });
    const deliveredButton = screen.getByRole("button", { name: "Delivered" });

    expect(processingButton).toHaveAttribute("data-stage-state", "active");
    expect(shippedButton).toHaveAttribute("data-stage-state", "active");
    expect(deliveredButton).toHaveAttribute("data-stage-state", "active");
    expect(processingButton).toBeDisabled();
    expect(shippedButton).toBeDisabled();
    expect(deliveredButton).toBeDisabled();
  });

  it("updates delivered sequentially from processing", async () => {
    fetchAdminOrderDetailMock
      .mockResolvedValueOnce(createOrder({ status: "processing" }))
      .mockResolvedValueOnce(createOrder({ status: "delivered" }));

    renderPage();

    await waitFor(() => {
      expect(fetchAdminOrderDetailMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Delivered" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(updateAdminOrderStatusMock).toHaveBeenCalledTimes(2);
    });

    expect(updateAdminOrderStatusMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      nextStatus: "shipped",
      note: "",
      notifyCustomer: true,
      adminEmail: "owner@example.com",
      order: expect.objectContaining({
        status: "processing",
      }),
    }));
    expect(updateAdminOrderStatusMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      nextStatus: "delivered",
      note: "",
      notifyCustomer: true,
      adminEmail: "owner@example.com",
      order: expect.objectContaining({
        status: "shipped",
      }),
    }));
  });

  it("stops the sequence on error and shows the failure message", async () => {
    fetchAdminOrderDetailMock
      .mockResolvedValueOnce(createOrder({ status: "pending" }))
      .mockResolvedValueOnce(createOrder({ status: "processing" }));
    updateAdminOrderStatusMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Unable to update order status."));

    renderPage();

    await waitFor(() => {
      expect(fetchAdminOrderDetailMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Delivered" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(updateAdminOrderStatusMock).toHaveBeenCalledTimes(2);
    });

    expect(updateAdminOrderStatusMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      nextStatus: "processing",
    }));
    expect(updateAdminOrderStatusMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      nextStatus: "shipped",
    }));
    expect(screen.getAllByText("Unable to update order status.").length).toBeGreaterThan(0);
    expect(updateAdminOrderStatusMock).not.toHaveBeenCalledWith(expect.objectContaining({ nextStatus: "delivered" }));
  });
});
