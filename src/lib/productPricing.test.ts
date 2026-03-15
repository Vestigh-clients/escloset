import { describe, expect, it } from "vitest";
import { shouldShowPriceVariesByVariantNote } from "@/lib/productPricing";

describe("shouldShowPriceVariesByVariantNote", () => {
  it("returns false when selected variant price is undefined", () => {
    expect(shouldShowPriceVariesByVariantNote(true, undefined, 120)).toBe(false);
  });

  it("returns false when selected variant price is null", () => {
    expect(shouldShowPriceVariesByVariantNote(true, null, 120)).toBe(false);
  });

  it("returns false when variant price equals product price", () => {
    expect(shouldShowPriceVariesByVariantNote(true, 120, 120)).toBe(false);
  });

  it("returns true when variant price differs from product price", () => {
    expect(shouldShowPriceVariesByVariantNote(true, 150, 120)).toBe(true);
  });

  it("returns false when there is no price difference across variants", () => {
    expect(shouldShowPriceVariesByVariantNote(false, 150, 120)).toBe(false);
  });
});
