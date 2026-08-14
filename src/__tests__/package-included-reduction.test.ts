import { describe, expect, it } from "vitest";

import { calculateBookingPricing } from "@/lib/booking-pricing";
import {
  buildPackageIncludedAllowances,
  calculatePackageAdjustmentAmount,
  canDecreaseProductQuantity,
  ensurePackageIncludedProducts,
  parsePackageIncludedAllowances,
  priceIncludedProductLine,
  rebuildLegacyPackageIncludedAllowances,
  reconcilePackageIncludedProductSelections,
  resolveBookingPackageAllowances,
  resolvePackageIncludedProducts,
  type PackageIncludedAllowance,
} from "@/lib/package-included-products";
import { buildRangePricingSnapshot } from "@/services/booking/range-booking-pricing.service";

/* ---------------------------------------------------------------------------
   Fixtures — the real seeded catalogue prices.
--------------------------------------------------------------------------- */

const TABLE_PRICE = 15;
const CHAIR_PRICE = 3;

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
        regularPrice: TABLE_PRICE,
        salePrice: null,
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
        regularPrice: CHAIR_PRICE,
        salePrice: null,
        isDefault: true,
      },
    ],
  },
];

const PREMIUM = { name: "Premium Package", baseGuests: 40 };
const STARTER = { name: "Starter Package", baseGuests: 20 };
const INCLUDED_CHAIRS_PREMIUM = 32;
const INCLUDED_TABLES_PREMIUM = 4;

function premiumAllowances() {
  return buildPackageIncludedAllowances({ source: PREMIUM, products });
}

function allowanceFor(
  allowances: PackageIncludedAllowance[],
  variantId: string
) {
  const found = allowances.find((entry) => entry.variantId === variantId);
  if (!found) throw new Error(`no allowance for ${variantId}`);
  return found;
}

/* ---------------------------------------------------------------------------
   Package definition integrity
--------------------------------------------------------------------------- */

describe("package definition matches its price breakdown", () => {
  // Each package's "Tables & Chairs" price-breakdown line is exactly what a
  // reduction credits back, so the two must never drift apart.
  const cases = [
    { source: { name: "Starter Package", baseGuests: 20 }, tablesAndChairs: 78 },
    { source: { name: "Classic Package", baseGuests: 30 }, tablesAndChairs: 117 },
    { source: { name: "Premium Package", baseGuests: 40 }, tablesAndChairs: 156 },
    { source: { name: "Grand Package", baseGuests: 50 }, tablesAndChairs: 195 },
  ];

  it.each(cases)(
    "$source.name included quantities are worth its breakdown line",
    ({ source, tablesAndChairs }) => {
      const included = resolvePackageIncludedProducts(source);
      const value =
        (included.tables ?? 0) * TABLE_PRICE +
        (included.chairs ?? 0) * CHAIR_PRICE;
      expect(value).toBe(tablesAndChairs);
    }
  );

  it("grants Grand 5 tables, matching the $195 it charges for", () => {
    // Regression: the config granted 6 tables while the package only priced 5,
    // so a reduction would have credited a table nobody paid for.
    expect(resolvePackageIncludedProducts({ name: "Grand Package", baseGuests: 50 }))
      .toEqual({ tables: 5, chairs: 40 });
  });
});

/* ---------------------------------------------------------------------------
   Stepper affordance
--------------------------------------------------------------------------- */

describe("canDecreaseProductQuantity", () => {
  // Regression: both product cards independently guarded the minus button with
  // `quantity <= includedQuantity`, so a package-included line could never be
  // reduced from the UI even though every layer beneath it supported the
  // reduction. The floor is 0 for every product, included or not.
  it("allows decreasing while sitting exactly on the included quantity", () => {
    expect(canDecreaseProductQuantity(INCLUDED_CHAIRS_PREMIUM)).toBe(true);
    expect(canDecreaseProductQuantity(INCLUDED_TABLES_PREMIUM)).toBe(true);
  });

  it("allows decreasing all the way down to the last unit", () => {
    expect(canDecreaseProductQuantity(1)).toBe(true);
  });

  it("stops at zero", () => {
    expect(canDecreaseProductQuantity(0)).toBe(false);
    expect(canDecreaseProductQuantity(-1)).toBe(false);
  });

  it("tolerates non-numeric input", () => {
    expect(canDecreaseProductQuantity(Number.NaN)).toBe(false);
    expect(canDecreaseProductQuantity(undefined as unknown as number)).toBe(false);
  });
});

/* ---------------------------------------------------------------------------
   Line pricing
--------------------------------------------------------------------------- */

describe("priceIncludedProductLine", () => {
  it("charges nothing and credits nothing at exactly the included quantity", () => {
    const line = priceIncludedProductLine({
      includedQuantity: 32,
      includedUnitPrice: CHAIR_PRICE,
      quantity: 32,
      unitPrice: CHAIR_PRICE,
    });
    expect(line.totalPrice).toBe(0);
    expect(line.adjustmentAmount).toBe(0);
    expect(line.extraQuantity).toBe(0);
  });

  it("charges only the quantity above the included allowance", () => {
    // Premium includes 32 chairs; 35 selected -> 3 chargeable.
    const line = priceIncludedProductLine({
      includedQuantity: 32,
      includedUnitPrice: CHAIR_PRICE,
      quantity: 35,
      unitPrice: CHAIR_PRICE,
    });
    expect(line.extraQuantity).toBe(3);
    expect(line.totalPrice).toBe(9);
    expect(line.adjustmentAmount).toBe(0);
  });

  it("credits the shortfall when the quantity is reduced", () => {
    // Premium 32 -> 20 chairs = 12 x $3 credited off the package price.
    const line = priceIncludedProductLine({
      includedQuantity: 32,
      includedUnitPrice: CHAIR_PRICE,
      quantity: 20,
      unitPrice: CHAIR_PRICE,
    });
    expect(line.totalPrice).toBe(0);
    expect(line.adjustmentAmount).toBe(36);
  });

  it("credits the whole allowance when reduced to zero", () => {
    const line = priceIncludedProductLine({
      includedQuantity: 16,
      includedUnitPrice: CHAIR_PRICE,
      quantity: 0,
      unitPrice: CHAIR_PRICE,
    });
    expect(line.adjustmentAmount).toBe(48);
  });

  it("credits at the snapshotted rate, never the live one", () => {
    // The catalogue price moved $3 -> $5 after this booking was created.
    const line = priceIncludedProductLine({
      includedQuantity: 32,
      includedUnitPrice: 3,
      quantity: 22,
      unitPrice: 5,
    });
    expect(line.adjustmentAmount).toBe(30); // 10 x $3, not 10 x $5
  });

  it("charges extras at the live rate while crediting at the snapshot rate", () => {
    const line = priceIncludedProductLine({
      includedQuantity: 32,
      includedUnitPrice: 3,
      quantity: 42,
      unitPrice: 5,
    });
    expect(line.totalPrice).toBe(50); // 10 extra x live $5
    expect(line.adjustmentAmount).toBe(0);
  });
});

/* ---------------------------------------------------------------------------
   Allowance snapshot
--------------------------------------------------------------------------- */

describe("package included allowance snapshot", () => {
  it("captures quantity and unit price for each included product", () => {
    expect(premiumAllowances()).toEqual([
      {
        productSlug: "tables",
        productId: "tables-product",
        variantId: "tables-default",
        includedQuantity: 4,
        includedUnitPrice: TABLE_PRICE,
      },
      {
        productSlug: "chairs",
        productId: "chairs-product",
        variantId: "chairs-default",
        includedQuantity: 32,
        includedUnitPrice: CHAIR_PRICE,
      },
    ]);
  });

  it("snapshots the sale price when one is active", () => {
    const discounted = [
      {
        ...products[1],
        variants: [{ ...products[1].variants[0], salePrice: 2 }],
      },
    ];
    const [chairs] = buildPackageIncludedAllowances({
      source: PREMIUM,
      products: discounted,
    });
    expect(chairs.includedUnitPrice).toBe(2);
  });

  it("survives a JSON round-trip", () => {
    const allowances = premiumAllowances();
    const restored = parsePackageIncludedAllowances(
      JSON.parse(JSON.stringify(allowances))
    );
    expect(restored).toEqual(allowances);
  });

  it("treats a missing snapshot as no allowance rather than guessing", () => {
    expect(parsePackageIncludedAllowances(null)).toEqual([]);
    expect(parsePackageIncludedAllowances(undefined)).toEqual([]);
    expect(parsePackageIncludedAllowances("nonsense")).toEqual([]);
  });

  it("rebuilds a legacy booking's allowance from its stored item prices", () => {
    const allowances = rebuildLegacyPackageIncludedAllowances({
      source: PREMIUM,
      items: [
        {
          productId: "chairs-product",
          variantId: "chairs-default",
          productName: "Chairs",
          unitPrice: CHAIR_PRICE,
        },
      ],
    });
    expect(allowances).toEqual([
      {
        productSlug: "chairs",
        productId: "chairs-product",
        variantId: "chairs-default",
        includedQuantity: 32,
        includedUnitPrice: CHAIR_PRICE,
      },
    ]);
  });
});

/* ---------------------------------------------------------------------------
   Allowance resolution for a saved booking
--------------------------------------------------------------------------- */

describe("resolveBookingPackageAllowances", () => {
  const storedItems = [
    {
      productId: "chairs-product",
      variantId: "chairs-default",
      productName: "Chairs",
      unitPrice: CHAIR_PRICE,
      includedUnitPrice: 0, // pre-migration default
    },
  ];

  it("uses the booking's own snapshot verbatim", () => {
    const snapshot = premiumAllowances();
    const resolved = resolveBookingPackageAllowances({
      snapshot,
      source: PREMIUM,
      items: storedItems,
      products,
    });
    expect(resolved).toEqual(snapshot);
  });

  it("ignores the live catalogue when a snapshot exists", () => {
    const snapshot = premiumAllowances();
    const resolved = resolveBookingPackageAllowances({
      snapshot,
      source: PREMIUM,
      items: [],
      products: [
        { ...products[1], variants: [{ ...products[1].variants[0], regularPrice: 99 }] },
      ],
    });
    expect(allowanceFor(resolved, "chairs-default").includedUnitPrice).toBe(CHAIR_PRICE);
  });

  it("rebuilds a legacy booking's allowance from the catalogue", () => {
    // Regression: a booking with NO stored row for an included product used to
    // resolve to no allowance at all, so the edit form showed the line as
    // unselected and saving would have billed it as a fresh add-on.
    const resolved = resolveBookingPackageAllowances({
      snapshot: null,
      source: PREMIUM,
      items: [],
      products,
    });
    expect(resolved).toHaveLength(2);
    expect(allowanceFor(resolved, "chairs-default").includedQuantity).toBe(32);
    expect(allowanceFor(resolved, "tables-default").includedQuantity).toBe(4);
  });

  it("pins a legacy rate to the price the booking already stored", () => {
    // Chairs are $9 in the catalogue today; this booking was sold at $3.
    const resolved = resolveBookingPackageAllowances({
      snapshot: null,
      source: PREMIUM,
      items: storedItems,
      products: [
        products[0],
        { ...products[1], variants: [{ ...products[1].variants[0], regularPrice: 9 }] },
      ],
    });
    expect(allowanceFor(resolved, "chairs-default").includedUnitPrice).toBe(CHAIR_PRICE);
    // Tables have no stored row, so they take today's catalogue price.
    expect(allowanceFor(resolved, "tables-default").includedUnitPrice).toBe(TABLE_PRICE);
  });

  it("falls back to the booking's rows when no catalogue is available", () => {
    const resolved = resolveBookingPackageAllowances({
      snapshot: null,
      source: PREMIUM,
      items: storedItems,
      products: [],
    });
    expect(resolved).toHaveLength(1);
    expect(allowanceFor(resolved, "chairs-default").includedUnitPrice).toBe(CHAIR_PRICE);
  });

  it("returns nothing for a package with no included products", () => {
    expect(
      resolveBookingPackageAllowances({
        snapshot: null,
        source: { name: "Mystery Package", baseGuests: 7 },
        items: [],
        products,
      })
    ).toEqual([]);
  });
});

/* ---------------------------------------------------------------------------
   Booking-level adjustment
--------------------------------------------------------------------------- */

describe("calculatePackageAdjustmentAmount", () => {
  it("is zero when every allowance is taken in full", () => {
    expect(
      calculatePackageAdjustmentAmount({
        allowances: premiumAllowances(),
        quantityByVariantId: new Map([
          ["tables-default", 4],
          ["chairs-default", 32],
        ]),
      })
    ).toBe(0);
  });

  it("is zero when quantities are increased above the allowance", () => {
    expect(
      calculatePackageAdjustmentAmount({
        allowances: premiumAllowances(),
        quantityByVariantId: new Map([
          ["tables-default", 10],
          ["chairs-default", 40],
        ]),
      })
    ).toBe(0);
  });

  it("sums credits across several reduced lines", () => {
    // 2 tables short ($30) + 12 chairs short ($36).
    expect(
      calculatePackageAdjustmentAmount({
        allowances: premiumAllowances(),
        quantityByVariantId: new Map([
          ["tables-default", 2],
          ["chairs-default", 20],
        ]),
      })
    ).toBe(66);
  });

  it("credits the full Tables & Chairs line when everything is dropped", () => {
    expect(
      calculatePackageAdjustmentAmount({
        allowances: premiumAllowances(),
        quantityByVariantId: new Map([
          ["tables-default", 0],
          ["chairs-default", 0],
        ]),
      })
    ).toBe(156);
  });

  it("treats an allowance with no matching line as fully reduced", () => {
    expect(
      calculatePackageAdjustmentAmount({
        allowances: premiumAllowances(),
        quantityByVariantId: new Map([["tables-default", 4]]),
      })
    ).toBe(96); // all 32 chairs credited
  });

  it("returns zero for a booking with no allowance snapshot", () => {
    expect(
      calculatePackageAdjustmentAmount({
        allowances: [],
        quantityByVariantId: new Map([["chairs-default", 0]]),
      })
    ).toBe(0);
  });
});

/* ---------------------------------------------------------------------------
   Pricing engine
--------------------------------------------------------------------------- */

describe("calculateBookingPricing with a package adjustment", () => {
  const premiumBase = {
    slotBasePrice: 841,
    slotFinalPrice: 841,
    guestCount: 40,
    theatreBaseGuests: 40,
    theatreExtraPersonPrice: 0,
  };

  it("leaves the package price alone when nothing is reduced", () => {
    const pricing = calculateBookingPricing(premiumBase);
    expect(pricing.packageListAmount).toBe(841);
    expect(pricing.packageAdjustmentAmount).toBe(0);
    expect(pricing.packageBaseAmount).toBe(841);
    expect(pricing.totalAmount).toBe(841);
  });

  it("reduces the package price by the adjustment (Client Example 1)", () => {
    // Premium $841, chairs 32 -> 10 = 22 x $3 = $66 credit -> $775.
    const pricing = calculateBookingPricing({
      ...premiumBase,
      packageAdjustmentAmount: 66,
    });
    expect(pricing.packageListAmount).toBe(841);
    expect(pricing.packageAdjustmentAmount).toBe(66);
    expect(pricing.packageBaseAmount).toBe(775);
    expect(pricing.totalAmount).toBe(775);
  });

  it("nets a reduction against a paid add-on in the same booking", () => {
    // Chairs 32 -> 20 (-$36) and 6 extra tables (+$90) = $895.
    const pricing = calculateBookingPricing({
      ...premiumBase,
      packageAdjustmentAmount: 36,
      productsAmount: 90,
    });
    expect(pricing.totalAmount).toBe(895);
  });

  it("keeps extra hours at the full package rate (Client Example 7)", () => {
    // Premium 6h: 841 + 2 x $150 - $66 = $1,075.
    const pricing = calculateBookingPricing({
      ...premiumBase,
      durationHours: 6,
      includedDurationHours: 4,
      extraHourlyRate: 150,
      packageAdjustmentAmount: 66,
    });
    expect(pricing.extraHoursAmount).toBe(300);
    expect(pricing.packageBaseAmount).toBe(775);
    expect(pricing.baseAmount).toBe(1075);
    expect(pricing.totalAmount).toBe(1075);
  });

  it("applies the coupon AFTER the reduction (Client Example 6)", () => {
    // Reduce then discount: (841 - 66) x 0.90 = $697.50.
    // The engine takes an absolute discount, so the caller derives 10% of the
    // already-reduced base — which is what slotAmount/baseAmount now carries.
    const reduced = calculateBookingPricing({
      ...premiumBase,
      packageAdjustmentAmount: 66,
    });
    const tenPercentOfReduced = reduced.baseAmount * 0.1;
    expect(tenPercentOfReduced).toBe(77.5);

    const withCoupon = calculateBookingPricing({
      ...premiumBase,
      packageAdjustmentAmount: 66,
      discountAmount: tenPercentOfReduced,
    });
    expect(withCoupon.totalAmount).toBe(697.5);
  });

  it("exposes the reduced base as the package-only coupon basis", () => {
    // slotAmount for coupon scoping is baseAmount, so a PACKAGE_ONLY coupon
    // discounts the adjusted package, not the list price.
    const pricing = calculateBookingPricing({
      ...premiumBase,
      packageAdjustmentAmount: 66,
    });
    expect(pricing.baseAmount).toBe(775);
  });

  it("reduces the balance due without touching a deposit (Client Example 8)", () => {
    const pricing = calculateBookingPricing({
      ...premiumBase,
      packageAdjustmentAmount: 66,
      advancePaid: 200,
    });
    expect(pricing.totalAmount).toBe(775);
    expect(pricing.advancePaid).toBe(200);
    expect(pricing.remainingPayable).toBe(575);
  });

  it("never lets the adjustment push the package below zero", () => {
    const pricing = calculateBookingPricing({
      ...premiumBase,
      packageAdjustmentAmount: 5000,
    });
    expect(pricing.packageAdjustmentAmount).toBe(841);
    expect(pricing.packageBaseAmount).toBe(0);
    expect(pricing.totalAmount).toBe(0);
  });

  it("ignores a negative adjustment", () => {
    const pricing = calculateBookingPricing({
      ...premiumBase,
      packageAdjustmentAmount: -100,
    });
    expect(pricing.packageBaseAmount).toBe(841);
  });

  it("keeps a Starter reduce-to-nothing at rental + cleaning (Client Example 5)", () => {
    // Starter $568 less the whole $78 Tables & Chairs line = $490.
    const pricing = calculateBookingPricing({
      slotBasePrice: 568,
      slotFinalPrice: 568,
      guestCount: 20,
      theatreBaseGuests: 20,
      theatreExtraPersonPrice: 0,
      packageAdjustmentAmount: 78,
    });
    expect(pricing.totalAmount).toBe(490);
  });
});

/* ---------------------------------------------------------------------------
   Customer snapshot recalculation
--------------------------------------------------------------------------- */

describe("buildRangePricingSnapshot", () => {
  const packageSnapshot = { guestLimit: 40 };
  const initialSnapshot = {
    packageAmount: 841,
    packageListAmount: 841,
    packageAdjustmentAmount: 0,
    extraDurationAmount: 0,
    advancePaid: 0,
  };

  it("applies the reduction to the package amount", () => {
    const snapshot = buildRangePricingSnapshot({
      packageSnapshot,
      pricingSnapshot: initialSnapshot,
      guestCount: 40,
      productsAmount: 0,
      packageAdjustmentAmount: 66,
      discountAmount: 0,
    });
    expect(snapshot.packageListAmount).toBe(841);
    expect(snapshot.packageAdjustmentAmount).toBe(66);
    expect(snapshot.packageAmount).toBe(775);
    expect(snapshot.totalAmount).toBe(775);
  });

  it("does not compound the reduction when recalculated repeatedly", () => {
    // Regression: reading the already-net packageAmount as the basis would
    // subtract the credit again on every save.
    let snapshot = buildRangePricingSnapshot({
      packageSnapshot,
      pricingSnapshot: initialSnapshot,
      guestCount: 40,
      productsAmount: 0,
      packageAdjustmentAmount: 66,
      discountAmount: 0,
    });
    for (let i = 0; i < 5; i += 1) {
      snapshot = buildRangePricingSnapshot({
        packageSnapshot,
        pricingSnapshot: snapshot,
        guestCount: 40,
        productsAmount: 0,
        packageAdjustmentAmount: 66,
        discountAmount: 0,
      });
    }
    expect(snapshot.packageAmount).toBe(775);
    expect(snapshot.totalAmount).toBe(775);
  });

  it("restores the full package price when the reduction is undone", () => {
    const reduced = buildRangePricingSnapshot({
      packageSnapshot,
      pricingSnapshot: initialSnapshot,
      guestCount: 40,
      productsAmount: 0,
      packageAdjustmentAmount: 66,
      discountAmount: 0,
    });
    const restored = buildRangePricingSnapshot({
      packageSnapshot,
      pricingSnapshot: reduced,
      guestCount: 40,
      productsAmount: 0,
      packageAdjustmentAmount: 0,
      discountAmount: 0,
    });
    expect(restored.packageAmount).toBe(841);
    expect(restored.totalAmount).toBe(841);
  });

  it("reads a pre-feature snapshot without inventing a reduction", () => {
    const legacy = buildRangePricingSnapshot({
      packageSnapshot,
      pricingSnapshot: { packageAmount: 841, extraDurationAmount: 0 },
      guestCount: 40,
      productsAmount: 0,
      discountAmount: 0,
    });
    expect(legacy.packageListAmount).toBe(841);
    expect(legacy.packageAdjustmentAmount).toBe(0);
    expect(legacy.packageAmount).toBe(841);
  });
});

/* ---------------------------------------------------------------------------
   Client-side seeding and reconciliation
--------------------------------------------------------------------------- */

describe("ensurePackageIncludedProducts", () => {
  const seedProducts = products.map((product) => ({
    ...product,
    image: null,
    variants: product.variants.map((variant) => ({
      ...variant,
      price: null,
      regularPrice: variant.regularPrice,
      salePrice: null,
    })),
  }));

  it("seeds the package quantities on a fresh selection", () => {
    const items = ensurePackageIncludedProducts({
      currentItems: [],
      products: seedProducts,
      selectedPackage: PREMIUM,
    });
    expect(items.map((item) => [item.productSlug, item.quantity])).toEqual([
      ["tables", 4],
      ["chairs", 32],
    ]);
    expect(items[1].includedQuantity).toBe(32);
    expect(items[1].includedUnitPrice).toBe(CHAIR_PRICE);
  });

  it("never re-raises a reduced quantity", () => {
    // Regression: seeding used to push the quantity back up to the included
    // count on every page load, making reductions impossible.
    const reduced = ensurePackageIncludedProducts({
      currentItems: [
        {
          id: "1",
          productId: "chairs-product",
          variantId: "chairs-default",
          productName: "Chairs",
          productSlug: "chairs",
          variantLabel: "Per Chair",
          category: "GIFT",
          unitPrice: CHAIR_PRICE,
          quantity: 10,
          totalPrice: 0,
          includedQuantity: 32,
          includedUnitPrice: CHAIR_PRICE,
        },
      ],
      products: seedProducts,
      selectedPackage: PREMIUM,
    });
    const chairs = reduced.find((item) => item.productSlug === "chairs");
    expect(chairs?.quantity).toBe(10);
  });

  it("never re-adds a line reduced to zero", () => {
    const zeroed = ensurePackageIncludedProducts({
      currentItems: [
        {
          id: "1",
          productId: "chairs-product",
          variantId: "chairs-default",
          productName: "Chairs",
          productSlug: "chairs",
          variantLabel: "Per Chair",
          category: "GIFT",
          unitPrice: CHAIR_PRICE,
          quantity: 0,
          totalPrice: 0,
          includedQuantity: 32,
          includedUnitPrice: CHAIR_PRICE,
        },
      ],
      products: seedProducts,
      selectedPackage: PREMIUM,
    });
    const chairs = zeroed.find((item) => item.productSlug === "chairs");
    expect(chairs?.quantity).toBe(0);
  });
});

describe("reconcilePackageIncludedProductSelections", () => {
  const selectionProducts = products.map((product) => ({
    ...product,
    image: null,
    variants: product.variants.map((variant) => ({
      ...variant,
      price: null,
      salePrice: null,
    })),
  }));

  it("carries a manual addition across a package switch", () => {
    // Starter (16 chairs) + 4 manual = 20 -> Premium (32) + 4 = 36.
    const selections = reconcilePackageIncludedProductSelections({
      currentSelections: { "chairs-product:chairs-default": { quantity: 20 } },
      products: selectionProducts,
      previousPackage: STARTER,
      selectedPackage: PREMIUM,
    });
    expect(selections["chairs-product:chairs-default"].quantity).toBe(36);
  });

  it("carries a reduction across a package switch", () => {
    // Starter 16 -> 10 is -6; Premium 32 - 6 = 26.
    const selections = reconcilePackageIncludedProductSelections({
      currentSelections: { "chairs-product:chairs-default": { quantity: 10 } },
      products: selectionProducts,
      previousPackage: STARTER,
      selectedPackage: PREMIUM,
    });
    expect(selections["chairs-product:chairs-default"].quantity).toBe(26);
  });

  it("keeps a zero-quantity row while the new package still grants an allowance", () => {
    const selections = reconcilePackageIncludedProductSelections({
      currentSelections: { "chairs-product:chairs-default": { quantity: 0 } },
      products: selectionProducts,
      previousPackage: STARTER,
      selectedPackage: PREMIUM,
    });
    expect(selections["chairs-product:chairs-default"].quantity).toBe(16);
  });
});

/* ---------------------------------------------------------------------------
   End-to-end arithmetic for the scenarios approved by the client
--------------------------------------------------------------------------- */

describe("approved client scenarios", () => {
  function priceBooking({
    listPrice,
    allowances,
    quantities,
    extraProductsAmount = 0,
    discountAmount = 0,
    advancePaid = 0,
    durationHours,
    includedDurationHours,
    extraHourlyRate,
  }: {
    listPrice: number;
    allowances: PackageIncludedAllowance[];
    quantities: Record<string, number>;
    extraProductsAmount?: number;
    discountAmount?: number;
    advancePaid?: number;
    durationHours?: number;
    includedDurationHours?: number;
    extraHourlyRate?: number;
  }) {
    const packageAdjustmentAmount = calculatePackageAdjustmentAmount({
      allowances,
      quantityByVariantId: quantities,
    });
    const productsAmount = allowances.reduce((sum, allowance) => {
      const line = priceIncludedProductLine({
        includedQuantity: allowance.includedQuantity,
        includedUnitPrice: allowance.includedUnitPrice,
        quantity: quantities[allowance.variantId] ?? 0,
        unitPrice: allowance.includedUnitPrice,
      });
      return sum + line.totalPrice;
    }, extraProductsAmount);

    return calculateBookingPricing({
      slotBasePrice: listPrice,
      slotFinalPrice: listPrice,
      guestCount: 0,
      theatreBaseGuests: 0,
      theatreExtraPersonPrice: 0,
      productsAmount,
      packageAdjustmentAmount,
      discountAmount,
      advancePaid,
      durationHours,
      includedDurationHours,
      extraHourlyRate,
    });
  }

  it("Example 1 — Premium, chairs 32 -> 10, total $775", () => {
    const pricing = priceBooking({
      listPrice: 841,
      allowances: premiumAllowances(),
      quantities: { "tables-default": 4, "chairs-default": 10 },
    });
    expect(pricing.packageAdjustmentAmount).toBe(66);
    expect(pricing.totalAmount).toBe(775);
  });

  it("Example 2 — Starter, chairs 16 -> 10, total $550", () => {
    const pricing = priceBooking({
      listPrice: 568,
      allowances: buildPackageIncludedAllowances({
        source: STARTER,
        products,
      }),
      quantities: { "tables-default": 2, "chairs-default": 10 },
    });
    expect(pricing.packageAdjustmentAmount).toBe(18);
    expect(pricing.totalAmount).toBe(550);
  });

  it("Example 3 — Classic, tables 3 -> 1, total $662", () => {
    const pricing = priceBooking({
      listPrice: 692,
      allowances: buildPackageIncludedAllowances({
        source: { name: "Classic Package", baseGuests: 30 },
        products,
      }),
      quantities: { "tables-default": 1, "chairs-default": 24 },
    });
    expect(pricing.packageAdjustmentAmount).toBe(30);
    expect(pricing.totalAmount).toBe(662);
  });

  it("Example 4 — Premium, chairs 32 -> 20 and tables 4 -> 10, total $895", () => {
    const pricing = priceBooking({
      listPrice: 841,
      allowances: premiumAllowances(),
      quantities: { "tables-default": 10, "chairs-default": 20 },
    });
    expect(pricing.packageAdjustmentAmount).toBe(36);
    expect(pricing.productsAmount).toBe(90);
    expect(pricing.totalAmount).toBe(895);
  });

  it("Example 5 — Starter, everything reduced to zero, total $490", () => {
    const pricing = priceBooking({
      listPrice: 568,
      allowances: buildPackageIncludedAllowances({
        source: STARTER,
        products,
      }),
      quantities: { "tables-default": 0, "chairs-default": 0 },
    });
    expect(pricing.packageAdjustmentAmount).toBe(78);
    expect(pricing.totalAmount).toBe(490);
  });

  it("Example 7 — Premium 6 hours with a reduction, total $1,075", () => {
    const pricing = priceBooking({
      listPrice: 841,
      allowances: premiumAllowances(),
      quantities: { "tables-default": 4, "chairs-default": 10 },
      durationHours: 6,
      includedDurationHours: 4,
      extraHourlyRate: 150,
    });
    expect(pricing.totalAmount).toBe(1075);
  });

  it("re-increasing above the allowance charges only the extras", () => {
    // Client's stated rule: 32 included, later 35 selected -> charge 3 chairs.
    const allowances = premiumAllowances();
    const reduced = priceBooking({
      listPrice: 841,
      allowances,
      quantities: { "tables-default": 4, "chairs-default": 20 },
    });
    expect(reduced.totalAmount).toBe(805);

    const increased = priceBooking({
      listPrice: 841,
      allowances,
      quantities: { "tables-default": 4, "chairs-default": 35 },
    });
    expect(increased.packageAdjustmentAmount).toBe(0);
    expect(increased.productsAmount).toBe(9);
    expect(increased.totalAmount).toBe(850);
  });

  it("returns to the original total when the reduction is fully undone", () => {
    const allowances = premiumAllowances();
    const restored = priceBooking({
      listPrice: 841,
      allowances,
      quantities: { "tables-default": 4, "chairs-default": 32 },
    });
    expect(restored.packageAdjustmentAmount).toBe(0);
    expect(restored.totalAmount).toBe(841);
  });

  it("prices the same booking identically after a catalogue price rise", () => {
    // The whole point of snapshotting: chairs go $3 -> $5 tomorrow, this
    // booking's credit stays at the $3 it was sold at.
    const allowances = allowanceFor(premiumAllowances(), "chairs-default");
    expect(allowances.includedUnitPrice).toBe(3);

    const pricing = priceBooking({
      listPrice: 841,
      allowances: [allowances],
      quantities: { "chairs-default": 10 },
    });
    expect(pricing.packageAdjustmentAmount).toBe(66);
    expect(pricing.totalAmount).toBe(775);
  });
});
