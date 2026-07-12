import { describe, expect, it } from "vitest";

import { calculateBookingPricing } from "@/lib/booking-pricing";
import {
  getPackageIncludedProductTotalPrice,
  reconcilePackageIncludedProductSelections,
} from "@/lib/package-included-products";

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

  it("charges only for quantities above the package allowance", () => {
    const source = { name: "Starter Package", baseGuests: 20 };

    expect(
      getPackageIncludedProductTotalPrice({
        source,
        product: products[0],
        quantity: 2,
        unitPrice: 15,
      })
    ).toBe(0);
    expect(
      getPackageIncludedProductTotalPrice({
        source,
        product: products[0],
        quantity: 4,
        unitPrice: 15,
      })
    ).toBe(30);
  });

  it("does not apply an included allowance without a matching package item", () => {
    expect(
      getPackageIncludedProductTotalPrice({
        source: null,
        product: products[0],
        quantity: 2,
        unitPrice: 15,
      })
    ).toBe(30);
  });

  it("keeps a Premium package's tables and chairs free, as the edit route prices them", () => {
    // Regression: the admin edit route priced every item at unit × quantity, so
    // saving a booking re-charged tables and chairs that the package price
    // already covers ($156 on Premium) and inflated the customer's total.
    const source = { name: "Premium Package", baseGuests: 40 };

    const tables = getPackageIncludedProductTotalPrice({
      source,
      product: products[0],
      quantity: 4,
      unitPrice: 15,
    });
    const chairs = getPackageIncludedProductTotalPrice({
      source,
      product: products[1],
      quantity: 32,
      unitPrice: 3,
    });

    expect(tables).toBe(0);
    expect(chairs).toBe(0);
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
});
