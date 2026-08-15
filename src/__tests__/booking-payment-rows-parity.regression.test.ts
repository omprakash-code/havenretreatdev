// The PDF receipt, the customer confirmation email and the admin notification
// email must present identical pricing.
//
// They used to diverge: the PDF explained the breakdown while both emails showed
// a single "Base Amount", so a booking whose package had been reduced looked
// unexplained ("Starter Package … $648"). All three now render rows from
// buildBookingPaymentRows(), and these tests pin that they cannot drift apart.
//
// buildPaymentRows() is the PDF's builder — it delegates the pricing rows to the
// shared helper and appends only receipt-specific payment-state rows. Comparing
// its pricing rows against the shared output proves the PDF did not fork.

import { describe, expect, it } from "vitest";

import {
  buildBookingPaymentRows,
  formatPaymentAmount,
  type PaymentSummaryInput,
  type PaymentSummaryRow,
} from "@/lib/booking-payment-rows";
import { buildPaymentRows } from "@/components/booking/success/pdf/downloadBookingTicketPdf";
import type { BookingSuccessData } from "@/components/booking/success/types";

/* ---------------------------------------------------------------------------
   Scenarios
--------------------------------------------------------------------------- */

const STARTER = 568;

type Scenario = { name: string; input: PaymentSummaryInput };

const scenarios: Scenario[] = [
  {
    name: "normal booking",
    input: { packageAmount: STARTER, totalAmount: STARTER, items: [] },
  },
  {
    name: "reduced included items",
    // Starter $568, 10 chairs given up at $3 = $30 credit -> $538.
    input: {
      packageAmount: 538,
      packageListAmount: STARTER,
      packageAdjustmentAmount: 30,
      totalAmount: 538,
      items: [
        { productName: "Chairs", quantity: 6, unitPrice: 3, totalPrice: 0, includedQuantity: 6, extraQuantity: 0 },
        { productName: "Tables", quantity: 2, unitPrice: 15, totalPrice: 0, includedQuantity: 2, extraQuantity: 0 },
      ],
    },
  },
  {
    name: "reduced included items with extra hours",
    // The example from the report: 568 - 30 + 110 = 648.
    input: {
      packageAmount: 538,
      packageListAmount: STARTER,
      packageAdjustmentAmount: 30,
      extraDurationAmount: 110,
      extraDurationHours: 1,
      totalAmount: 648,
      items: [],
    },
  },
  {
    name: "additional products",
    input: {
      packageAmount: STARTER,
      totalAmount: STARTER + 95,
      items: [
        { productName: "Shimmer Wall", quantity: 1, unitPrice: 95, totalPrice: 95, includedQuantity: 0, extraQuantity: 1 },
        { productName: "Chairs", quantity: 20, unitPrice: 3, totalPrice: 12, includedQuantity: 16, extraQuantity: 4 },
      ],
    },
  },
  {
    name: "additional charge",
    input: {
      packageAmount: STARTER,
      additionalChargeAmount: 50,
      additionalChargeReason: "Late checkout",
      totalAmount: STARTER + 50,
      items: [],
    },
  },
  {
    name: "discount",
    input: {
      packageAmount: STARTER,
      discountAmount: 25,
      totalAmount: STARTER - 25,
      items: [],
    },
  },
  {
    name: "everything at once",
    input: {
      packageAmount: 538,
      packageListAmount: STARTER,
      packageAdjustmentAmount: 30,
      extraDurationAmount: 110,
      extraDurationHours: 1,
      additionalChargeAmount: 50,
      additionalChargeReason: "Late checkout",
      discountAmount: 25,
      totalAmount: 768,
      items: [
        { productName: "Shimmer Wall", quantity: 1, unitPrice: 95, totalPrice: 95, includedQuantity: 0, extraQuantity: 1 },
      ],
    },
  },
];

/** The PDF's builder over the same booking, reduced to its pricing rows. */
function pdfPricingRows(input: PaymentSummaryInput): PaymentSummaryRow[] {
  const data = {
    packageAmount: input.packageAmount,
    packageListAmount: input.packageListAmount,
    packageAdjustmentAmount: input.packageAdjustmentAmount,
    extraDurationAmount: input.extraDurationAmount,
    extraDurationHours: input.extraDurationHours,
    decorationAmount: input.decorationAmount,
    additionalChargeAmount: input.additionalChargeAmount,
    additionalChargeReason: input.additionalChargeReason,
    discountAmount: input.discountAmount,
    totalAmount: input.totalAmount,
    advancePaid: 0,
    remainingPayable: input.totalAmount,
    items: (input.items ?? []).map((item, index) => ({
      id: `item-${index}`,
      productName: item.productName,
      variantLabel: "std",
      category: "GIFT",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      includedQuantity: item.includedQuantity,
      extraQuantity: item.extraQuantity,
      image: null,
    })),
  } as unknown as BookingSuccessData;

  const rows = buildPaymentRows(data);
  // Everything up to and including the total is the shared pricing breakdown;
  // what follows is receipt-only payment state.
  const totalIndex = rows.findIndex((row) => row.tone === "strong");
  return rows.slice(0, totalIndex + 1) as PaymentSummaryRow[];
}

/* ---------------------------------------------------------------------------
   Parity
--------------------------------------------------------------------------- */

describe("PDF, customer email and admin email share one pricing breakdown", () => {
  it.each(scenarios)(
    "$name — the PDF renders exactly the shared rows",
    ({ input }) => {
      // Both emails render buildBookingPaymentRows() verbatim, so proving the
      // PDF matches it proves all three agree.
      expect(pdfPricingRows(input)).toEqual(buildBookingPaymentRows(input));
    }
  );

  it.each(scenarios)("$name — rows end on the booking total", ({ input }) => {
    const rows = buildBookingPaymentRows(input);
    const last = rows[rows.length - 1];
    expect(last.tone).toBe("strong");
    expect(last.value).toBe(formatPaymentAmount(input.totalAmount));
  });
});

/* ---------------------------------------------------------------------------
   The breakdown explains the reduction
--------------------------------------------------------------------------- */

describe("reduced bookings are explained rather than just totalled", () => {
  it("shows the published package price and the credit as separate rows", () => {
    // The reported confusion: "$648" with no explanation of why the Starter
    // package was not its usual $568 plus extra hours.
    const rows = buildBookingPaymentRows(scenarios[2].input);
    const labels = rows.map((row) => row.label);

    expect(labels).toContain("Package");
    expect(labels).toContain("Included Items Reduced");
    expect(rows.find((r) => r.label === "Package")?.value).toBe("$568");
    expect(rows.find((r) => r.label === "Included Items Reduced")?.value).toBe("- $30");
    expect(rows.find((r) => r.label.startsWith("Extra Hours"))?.value).toBe("$110");
    expect(rows[rows.length - 1].value).toBe("$648");
  });

  it("labels extra hours with the hourly rate", () => {
    const rows = buildBookingPaymentRows(scenarios[2].input);
    expect(rows.find((r) => r.label.startsWith("Extra Hours"))?.label).toBe(
      "Extra Hours (1h × $110/hr)"
    );
  });

  it("omits the reduction row entirely when nothing was reduced", () => {
    const labels = buildBookingPaymentRows(scenarios[0].input).map((r) => r.label);
    expect(labels).not.toContain("Included Items Reduced");
    expect(labels).toEqual(["Package", "Total Amount"]);
  });

  it("shows the net package price when there is no reduction", () => {
    const rows = buildBookingPaymentRows(scenarios[0].input);
    expect(rows.find((r) => r.label === "Package")?.value).toBe("$568");
  });

  it("bills only quantities above the allowance", () => {
    const rows = buildBookingPaymentRows(scenarios[3].input);
    const labels = rows.map((r) => r.label);
    // 20 chairs with 16 included -> 4 billed, not 20.
    expect(labels).toContain("Chairs (4 × $3)");
    expect(labels).toContain("Shimmer Wall (1 × $95)");
  });

  it("never lists a fully-included line as a charge", () => {
    const labels = buildBookingPaymentRows(scenarios[1].input).map((r) => r.label);
    expect(labels.some((l) => l.startsWith("Chairs"))).toBe(false);
    expect(labels.some((l) => l.startsWith("Tables"))).toBe(false);
  });

  it("breaks out the subtotal before a discount", () => {
    const rows = buildBookingPaymentRows(scenarios[5].input);
    const labels = rows.map((r) => r.label);
    expect(labels).toContain("Subtotal (Before Discount)");
    expect(rows.find((r) => r.label === "Discount")?.value).toBe("-$25");
    expect(labels[labels.length - 1]).toBe("Final Total (After Discount)");
  });

  it("names the reason on an additional charge", () => {
    const labels = buildBookingPaymentRows(scenarios[4].input).map((r) => r.label);
    expect(labels).toContain("Additional Charge (Late checkout)");
  });

  it("keeps every row for a booking that has all of them", () => {
    const labels = buildBookingPaymentRows(scenarios[6].input).map((r) => r.label);
    expect(labels).toEqual([
      "Package",
      "Included Items Reduced",
      "Extra Hours (1h × $110/hr)",
      "Shimmer Wall (1 × $95)",
      "Additional Charge (Late checkout)",
      "Subtotal (Before Discount)",
      "Discount",
      "Final Total (After Discount)",
    ]);
  });
});

/* ---------------------------------------------------------------------------
   Formatting is defined once
--------------------------------------------------------------------------- */

describe("money formatting", () => {
  it("drops decimals on whole amounts and keeps them otherwise", () => {
    expect(formatPaymentAmount(568)).toBe("$568");
    expect(formatPaymentAmount(45.32)).toBe("$45.32");
    expect(formatPaymentAmount(0)).toBe("$0");
  });
});
