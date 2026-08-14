import { describe, expect, it } from "vitest";

import { calculateBookingPricing } from "@/lib/booking-pricing";
import { reconcilePackageIncludedProductSelections } from "@/lib/package-included-products";

const products = [
  {
    id: "tables-product",
    slug: "tables",
    name: "Tables",
    category: "GIFT",
    variants: [
      {
        id: "tables-default",
        label: "Per Table",
        regularPrice: 15,
        isDefault: true,
      },
    ],
  },
  {
    id: "chairs-product",
    slug: "chairs",
    name: "Chairs",
    category: "GIFT",
    variants: [
      {
        id: "chairs-default",
        label: "Per Chair",
        regularPrice: 3,
        isDefault: true,
      },
    ],
  },
];

// Line-level allowance pricing moved to priceIncludedProductLine(); see
// package-included-reduction.test.ts. What remains here is package-switch
// reconciliation and extra-hour pricing.
describe("package included products", () => {
  it("auto-adds the package quantities", () => {
    const selections = reconcilePackageIncludedProductSelections({
      currentSelections: {},
      products,
      previousPackage: null,
      selectedPackage: { name: "Starter Package", baseGuests: 20 },
    });

    expect(selections).toEqual({
      "tables-product:tables-default": { quantity: 2 },
      "chairs-product:chairs-default": { quantity: 16 },
    });
  });

  it("preserves manually added quantities when switching packages", () => {
    const selections = reconcilePackageIncludedProductSelections({
      currentSelections: {
        "tables-product:tables-default": { quantity: 4 },
        "chairs-product:chairs-default": { quantity: 20 },
      },
      products,
      previousPackage: { name: "Starter Package", baseGuests: 20 },
      selectedPackage: { name: "Classic Package", baseGuests: 30 },
    });

    expect(selections).toEqual({
      "tables-product:tables-default": { quantity: 5 },
      "chairs-product:chairs-default": { quantity: 28 },
    });
  });

});

describe("package extra-hour pricing", () => {
  it("uses the selected package duration and hourly rate", () => {
    const pricing = calculateBookingPricing({
      slotBasePrice: 692,
      slotFinalPrice: 692,
      guestCount: 30,
      theatreBaseGuests: 30,
      theatreExtraPersonPrice: 25,
      durationHours: 6,
      includedDurationHours: 4,
      extraHourlyRate: 125,
    });

    expect(pricing.packageBaseAmount).toBe(692);
    expect(pricing.extraHoursAmount).toBe(250);
    expect(pricing.baseAmount).toBe(942);
    expect(pricing.totalAmount).toBe(942);
  });

  it("includes a booking-level additional charge in totals and balance", () => {
    const pricing = calculateBookingPricing({
      slotBasePrice: 500,
      slotFinalPrice: 500,
      guestCount: 10,
      theatreBaseGuests: 10,
      theatreExtraPersonPrice: 25,
      productsAmount: 250.5,
      additionalChargeAmount: 50.5,
      discountAmount: 0,
      advancePaid: 125.25,
    });

    expect(pricing.productsAmount).toBe(250.5);
    expect(pricing.additionalChargeAmount).toBe(50.5);
    expect(pricing.totalAmount).toBe(801);
    expect(pricing.advancePaid).toBe(125.25);
    expect(pricing.remainingPayable).toBe(675.75);
  });
});
