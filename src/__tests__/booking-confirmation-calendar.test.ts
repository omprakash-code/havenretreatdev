import { describe, expect, it } from "vitest";

import type { BookingConfirmationEmailProps } from "@/emails/BookingConfirmationEmail";
import { buildBookingConfirmationCalendarAttachment } from "@/lib/calendar/booking-confirmation-calendar";

const baseEmailData: BookingConfirmationEmailProps = {
  bookingRef: "DS-BOOK-100",
  customerName: "Demo User",
  customerPhone: "9999999999",
  customerEmail: "demo@example.com",
  theatreName: "Silver Screen",
  locationName: "Delhi",
  date: "Mon, 02 Mar 2026",
  timeSlot: "10:00 - 11:00",
  guestCount: 2,
  totalAmount: 2000,
  advancePaid: 750,
  remainingPayable: 1250,
  successUrl: "https://example.com/booking/success?t=abc",
};

describe("buildBookingConfirmationCalendarAttachment", () => {
  it("builds an attachment from valid booking data", () => {
    const attachment = buildBookingConfirmationCalendarAttachment(
      baseEmailData,
      "DS-BOOK-100"
    );

    expect(attachment).toEqual(
      expect.objectContaining({
        filename: "DS-BOOK-100.ics",
        contentType: "text/calendar; charset=utf-8; method=REQUEST",
        content: expect.stringContaining("BEGIN:VCALENDAR"),
      })
    );
  });

  it("returns undefined when date/time cannot be parsed", () => {
    const attachment = buildBookingConfirmationCalendarAttachment(
      {
        ...baseEmailData,
        date: "invalid-date",
        timeSlot: "bad-slot",
      },
      "DS-BOOK-100"
    );

    expect(attachment).toBeUndefined();
  });
});
