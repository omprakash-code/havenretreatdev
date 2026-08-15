// The Booking Review emails must show the same payment breakdown as the PDF.
//
// These are the emails sent when a booking is SUBMITTED (and on approval /
// rejection) — a different template from the confirmation emails. It carried
// only a single "Estimated Total", so a booking whose package had been reduced
// arrived unexplained: "Starter Package … $675" with no sign that a chair had
// been removed. The PDF attached to that very email showed the breakdown.
//
// All four variants share one template, so all four are asserted here.

import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";

import BookingReviewEmail, {
  type BookingReviewEmailProps,
} from "@/emails/BookingReviewEmail";
import {
  buildBookingPaymentRows,
  type PaymentSummaryInput,
} from "@/lib/booking-payment-rows";
import { buildPaymentRows } from "@/components/booking/success/pdf/downloadBookingTicketPdf";
import type { BookingSuccessData } from "@/components/booking/success/types";

const VARIANTS = [
  "SUBMITTED",
  "ADMIN_SUBMITTED",
  "APPROVED",
  "REJECTED",
] as const satisfies readonly BookingReviewEmailProps["variant"][];

/* ---------------------------------------------------------------------------
   Scenarios
--------------------------------------------------------------------------- */

const STARTER = 568;

// The exact booking from the report: Starter $568, one included chair removed
// (-$3), one extra hour (+$110) = $675.
const REPORTED: PaymentSummaryInput = {
  packageAmount: 565,
  packageListAmount: STARTER,
  packageAdjustmentAmount: 3,
  extraDurationAmount: 110,
  extraDurationHours: 1,
  totalAmount: 675,
  items: [],
};

const scenarios: Array<{ name: string; input: PaymentSummaryInput }> = [
  {
    name: "normal booking",
    input: { packageAmount: STARTER, totalAmount: STARTER, items: [] },
  },
  { name: "reduced included products", input: REPORTED },
  {
    name: "extra hours",
    input: {
      packageAmount: STARTER,
      extraDurationAmount: 110,
      extraDurationHours: 1,
      totalAmount: STARTER + 110,
      items: [],
    },
  },
  {
    name: "add-ons",
    input: {
      packageAmount: STARTER,
      totalAmount: STARTER + 95,
      items: [
        {
          productName: "Shimmer Wall",
          quantity: 1,
          unitPrice: 95,
          totalPrice: 95,
          includedQuantity: 0,
          extraQuantity: 1,
        },
      ],
    },
  },
  {
    name: "additional charge",
    input: {
      packageAmount: STARTER,
      additionalChargeAmount: 20,
      additionalChargeReason: "Late checkout",
      totalAmount: STARTER + 20,
      items: [],
    },
  },
  {
    name: "discount",
    input: {
      packageAmount: STARTER,
      discountAmount: 10,
      totalAmount: STARTER - 10,
      items: [],
    },
  },
  {
    name: "all adjustments combined",
    input: {
      packageAmount: 565,
      packageListAmount: STARTER,
      packageAdjustmentAmount: 3,
      extraDurationAmount: 110,
      extraDurationHours: 1,
      additionalChargeAmount: 20,
      additionalChargeReason: "Late checkout",
      discountAmount: 10,
      totalAmount: 760,
      items: [
        {
          productName: "Shimmer Wall",
          quantity: 1,
          unitPrice: 95,
          totalPrice: 95,
          includedQuantity: 0,
          extraQuantity: 1,
        },
      ],
    },
  },
];

function reviewProps(
  variant: BookingReviewEmailProps["variant"],
  input: PaymentSummaryInput
): BookingReviewEmailProps {
  return {
    variant,
    bookingRef: "HR-TEST-0001",
    customerName: "Review Customer",
    customerPhone: "9998887777",
    customerEmail: "review@example.com",
    theatreName: "Starter Package",
    locationName: "Miami",
    date: "2030-01-01",
    timeSlot: "10:00 - 15:00",
    guestCount: 12,
    occasionLabel: "Birthday",
    decorationRequired: false,
    additionalChargeAmount: input.additionalChargeAmount ?? 0,
    additionalChargeReason: input.additionalChargeReason ?? null,
    totalAmount: input.totalAmount,
    paymentRows: buildBookingPaymentRows(input),
    agreementSigned: true,
    rejectionReason: variant === "REJECTED" ? "Date unavailable" : null,
  };
}

/** React splits adjacent text nodes with a comment; join them back. */
function renderedText(html: string) {
  return html.replace(/<!--.*?-->/g, "");
}

/** The PDF's rows for the same booking, trimmed to the pricing breakdown. */
function pdfPricingRows(input: PaymentSummaryInput) {
  const data = {
    ...input,
    advancePaid: 0,
    remainingPayable: input.totalAmount,
    items: (input.items ?? []).map((item, index) => ({
      ...item,
      id: `item-${index}`,
      variantLabel: "std",
      category: "GIFT",
      image: null,
    })),
  } as unknown as BookingSuccessData;

  const rows = buildPaymentRows(data);
  return rows.slice(0, rows.findIndex((row) => row.tone === "strong") + 1);
}

/* ---------------------------------------------------------------------------
   Every variant renders the breakdown
--------------------------------------------------------------------------- */

describe.each(VARIANTS)("BookingReviewEmail — %s", (variant) => {
  it.each(scenarios)("$name renders every breakdown row", async ({ input }) => {
    const props = reviewProps(variant, input);
    const html = renderedText(await render(BookingReviewEmail(props)));

    for (const row of props.paymentRows!.filter((r) => r.tone !== "strong")) {
      expect(html, `missing label: ${row.label}`).toContain(row.label);
      expect(html, `missing value: ${row.value}`).toContain(row.value);
    }
  });

  it("keeps the variant's own total wording", async () => {
    const html = renderedText(
      await render(BookingReviewEmail(reviewProps(variant, REPORTED)))
    );
    const expectedLabel =
      variant === "ADMIN_SUBMITTED" ? "Total Estimate" : "Estimated Total";

    expect(html).toContain(expectedLabel);
    // The total itself comes from the shared builder, so it matches the PDF.
    expect(html).toContain("$675");
  });

  it("explains a reduced package instead of only totalling it", async () => {
    const html = renderedText(
      await render(BookingReviewEmail(reviewProps(variant, REPORTED)))
    );

    expect(html).toContain("Package");
    expect(html).toContain("$568");
    expect(html).toContain("Included Items Reduced");
    expect(html).toContain("- $3");
    expect(html).toContain("Extra Hours (1h × $110/hr)");
  });

  it("omits the reduction row when nothing was reduced", async () => {
    const html = renderedText(
      await render(BookingReviewEmail(reviewProps(variant, scenarios[0].input)))
    );
    expect(html).not.toContain("Included Items Reduced");
  });
});

/* ---------------------------------------------------------------------------
   Parity with the PDF
--------------------------------------------------------------------------- */

describe("review email and PDF share one breakdown", () => {
  it.each(scenarios)(
    "$name — the PDF's pricing rows equal the review email's rows",
    ({ input }) => {
      expect(pdfPricingRows(input)).toEqual(buildBookingPaymentRows(input));
    }
  );

  it("renders an Included Items Reduced row whenever the adjustment is > 0", async () => {
    for (const input of scenarios.map((s) => s.input)) {
      const html = renderedText(
        await render(BookingReviewEmail(reviewProps("SUBMITTED", input)))
      );
      const expected = (input.packageAdjustmentAmount ?? 0) > 0;
      expect(html.includes("Included Items Reduced")).toBe(expected);
    }
  });

  it("does not repeat the additional charge row", async () => {
    // The template used to render its own additional-charge row; the shared
    // builder now supplies it, and it must appear exactly once.
    const input = scenarios[4].input;
    const html = renderedText(
      await render(BookingReviewEmail(reviewProps("SUBMITTED", input)))
    );
    const occurrences = html.split("Additional Charge (Late checkout)").length - 1;
    expect(occurrences).toBe(1);
  });

  it("renders no rows at all when the builder supplies none", async () => {
    // A caller that has not been migrated must not crash or show empty rows.
    const props = { ...reviewProps("SUBMITTED", REPORTED), paymentRows: undefined };
    const html = renderedText(await render(BookingReviewEmail(props)));

    expect(html).toContain("Estimated Total");
    expect(html).not.toContain("Included Items Reduced");
  });
});
