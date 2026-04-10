import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import AdminAddWithAIPage from "@/pages/admin/AdminAddWithAIPage";

const {
  navigateMock,
  fetchAdminCategoriesMock,
  createAdminProductMock,
  updateAdminProductMock,
  uploadProductImageMock,
  invokeMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  fetchAdminCategoriesMock: vi.fn(),
  createAdminProductMock: vi.fn(),
  updateAdminProductMock: vi.fn(),
  uploadProductImageMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/services/adminService", () => ({
  fetchAdminCategories: fetchAdminCategoriesMock,
  createAdminProduct: createAdminProductMock,
  updateAdminProduct: updateAdminProductMock,
  uploadProductImage: uploadProductImageMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

describe("AdminAddWithAIPage", () => {
  beforeAll(() => {
    if (!HTMLElement.prototype.hasPointerCapture) {
      HTMLElement.prototype.hasPointerCapture = () => false;
    }
    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = () => {};
    }
    if (!HTMLElement.prototype.releasePointerCapture) {
      HTMLElement.prototype.releasePointerCapture = () => {};
    }
  });

  beforeEach(() => {
    navigateMock.mockReset();
    fetchAdminCategoriesMock.mockReset();
    createAdminProductMock.mockReset();
    updateAdminProductMock.mockReset();
    uploadProductImageMock.mockReset();
    invokeMock.mockReset();

    fetchAdminCategoriesMock.mockResolvedValue([
      { id: "cat-1", name: "Women", slug: "women" },
    ]);
  });

  it("validates category and prompt before submit", async () => {
    render(
      <MemoryRouter>
        <AdminAddWithAIPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchAdminCategoriesMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Draft with AI" }));
    expect(screen.getByText("Select a category before creating with AI.")).toBeInTheDocument();

    const categoryTrigger = screen.getByRole("combobox", { name: "Category" });
    fireEvent.keyDown(categoryTrigger, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "Women" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Draft with AI" }));
    expect(screen.getByText("Enter product notes in the prompt field.")).toBeInTheDocument();
  });

  it("keeps user prompt when AI extraction fails", async () => {
    invokeMock.mockResolvedValue({
      data: { success: false, message: "AI extraction failed. Please try again." },
      error: null,
    });

    render(
      <MemoryRouter>
        <AdminAddWithAIPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchAdminCategoriesMock).toHaveBeenCalledTimes(1);
    });

    const categoryTrigger = screen.getByRole("combobox", { name: "Category" });
    fireEvent.keyDown(categoryTrigger, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "Women" }));

    const promptField = screen.getByRole("textbox");
    fireEvent.change(promptField, { target: { value: "name=Three set\nprice=180gh" } });

    fireEvent.click(screen.getByRole("button", { name: "Create Draft with AI" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("AI extraction failed. Please try again.")).toBeInTheDocument();
    expect((promptField as HTMLTextAreaElement).value).toBe("name=Three set\nprice=180gh");
  });
});
