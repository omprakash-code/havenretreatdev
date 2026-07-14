import { describe, expect, it } from "vitest";

import { buildPaymentRows } from "@/components/booking/success/pdf/downloadBookingTicketPdf";
import type { BookingSuccessData } from "@/components/booking/success/types";

function makeBookingData(
  overrides: Partial<BookingSuccessData> = {}
): BookingSuccessData {
  return {
    bookingRef: "HR0617202600001",
    bookingStatus: "APPROVED",
    paymentStatus: "OFFLINE",
    createdByRole: "ADMIN",
    contact: {
      name: "Test Guest",
      phone: "9999999999",
    },
    theatreName: "Starter Package",
    date: "17 Jun 2026",
    timeSlot: "14:30 - 19:30",
    durationHours: 5,
    includedDurationHours: 4,
    extraDurationHours: 1,
    locationName: "Miami",
    dateTime: "17 Jun 2026, 14:30 - 19:30",
    occasionDetails: [],
    guestCount: 20,
    packageAmount: 568,
    extraDurationAmount: 110,
    decorationAmount: 375,
    totalAmount: 1053,
    advancePaid: 150,
    remainingPayable: 903,
    items: [],
    ...overrides,
  };
}

describe("booking ticket payment rows", () => {
  it("shows package, extra hours, and decoration as separate charges", () => {
    const rows = buildPaymentRows(makeBookingData());

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Package", value: "$568" }),
        expect.objectContaining({
          label: "Extra Hours (1h × $110/hr)",
          value: "$110",
        }),
        expect.objectContaining({ label: "Decoration", value: "$375" }),
      ])
    );
  });

  it("never renders an extra-guest charge (guests above included are free)", () => {
    const rows = buildPaymentRows(
      makeBookingData({
        guestCount: 23,
        includedGuestCount: 20,
        extraGuestCount: 3,
        extraPersonPrice: 20,
        extrasAmount: 60,
      })
    );

    expect(
      rows.some((row) => row.label.startsWith("Extra Guests"))
    ).toBe(false);
  });
});
