import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import CheckoutEntry from "@/pages/CheckoutEntry";

describe("CheckoutEntry", () => {
  it("redirects checkout visitors straight to contact information", () => {
    render(
      <MemoryRouter initialEntries={["/checkout"]}>
        <Routes>
          <Route path="/checkout" element={<CheckoutEntry />} />
          <Route path="/checkout/contact" element={<div>Contact Information</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Contact Information")).toBeInTheDocument();
    expect(screen.queryByText("How would you like to continue?")).not.toBeInTheDocument();
  });
});
