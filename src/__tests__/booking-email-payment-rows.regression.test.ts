// Both confirmation emails must actually RENDER the shared pricing rows.
//
// Row-builder parity is covered in booking-payment-rows-parity; this asserts the
// templates consume it, so a template that silently stopped rendering the rows
// (the original bug — emails showed only a final total) fails here.

import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";

import BookingConfirmationEmail from "@/emails/BookingConfirmationEmail";
import AdminBookingConfirmationEmail from "@/emails/AdminBookingConfirmationEmail";
import { buildBookingPaymentRows } from "@/lib/booking-payment-rows";

// Starter $568, 10 chairs given up (-$30), 1 extra hour (+$110) = $648 — the
// booking from the report that read as an unexplained "$648".
const paymentRows = buildBookingPaymentRows({
  packageAmount: 538,
  packageListAmount: 568,
  packageAdjustmentAmount: 30,
  extraDurationAmount: 110,
  extraDurationHours: 1,
  totalAmount: 648,
  items: [],
});

const props = {
  bookingRef: "HR-TEST-0001",
  customerName: "Parity Customer",
  customerPhone: "9998887777",
  theatreName: "Starter Package",
  locationName: "Miami",
  date: "2030-01-01",
  timeSlot: "10:00 - 15:00",
  guestCount: 10,
  occasionDetails: [],
  totalAmount: 648,
  advancePaid: 150,
  remainingPayable: 498,
  paymentRows,
  addonItems: [
    { name: "Chairs", quantity: 6, totalPrice: 0, includedQuantity: 6, extraQuantity: 0 },
    { name: "Tables", quantity: 2, totalPrice: 0, includedQuantity: 2, extraQuantity: 0 },
  ],
} as never;

/** React splits adjacent text nodes with an HTML comment; join them back. */
function renderedText(html: string) {
  return html.replace(/<!--.*?-->/g, "");
}

describe("confirmation emails render the shared payment rows", () => {
  it("the customer email shows every breakdown row label and value", async () => {
    const html = renderedText(await render(BookingConfirmationEmail(props)));

    // The template keeps its own styled "TOTAL" heading for the final row, but
    // renders the shared VALUE for it (asserted separately below).
    for (const row of paymentRows.filter((r) => r.tone !== "strong")) {
      expect(html, `missing label: ${row.label}`).toContain(row.label);
      expect(html, `missing value: ${row.value}`).toContain(row.value);
    }
  });

  it("the admin email shows every row label and value", async () => {
    const html = renderedText(await render(AdminBookingConfirmationEmail(props)));

    for (const row of paymentRows) {
      expect(html, `missing label: ${row.label}`).toContain(row.label);
      expect(html, `missing value: ${row.value}`).toContain(row.value);
    }
  });

  it("explains the reduction rather than showing a bare total", async () => {
    const html = renderedText(await render(BookingConfirmationEmail(props)));

    expect(html).toContain("Package");
    expect(html).toContain("$568");
    expect(html).toContain("Included Items Reduced");
    expect(html).toContain("- $30");
    expect(html).toContain("Extra Hours (1h × $110/hr)");
    expect(html).toContain("$648");
  });

  it("shows the booking's final included quantities, not package defaults", async () => {
    const customer = renderedText(await render(BookingConfirmationEmail(props)));
    const admin = renderedText(await render(AdminBookingConfirmationEmail(props)));

    // The package includes 16 chairs; this booking kept 6.
    expect(customer).toContain("Included: 6");
    expect(customer).toContain("Included: 2");
    expect(customer).not.toContain("Included: 16");
    expect(admin).toContain("included: 6");
    expect(admin).not.toContain("included: 16");
  });

  it("keeps the customer total identical to the shared row", async () => {
    const html = renderedText(await render(BookingConfirmationEmail(props)));
    const total = paymentRows[paymentRows.length - 1].value;

    expect(total).toBe("$648");
    expect(html).toContain(total);
    // The old template formatted its own total and drifted from the PDF.
    expect(html).not.toContain("$648.00");
  });
});
