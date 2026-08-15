import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { renderBookingConfirmationEmail } from "@/emails/renderBookingConfirmationEmail";
import AdminBookingConfirmationEmail from "@/emails/AdminBookingConfirmationEmail";
import {
  BOOKING_CONFIRMED_TITLE,
  BOOKING_CONFIRMED_MESSAGE,
  BOOKING_PAYMENT_APPLIED_MESSAGE,
  BOOKING_PAY_LATER_MESSAGE,
} from "@/constants/booking-status-copy";

const baseProps = {
  bookingRef: "DS-BOOK-200",
  customerName: "Test User",
  customerPhone: "9999999999",
  customerEmail: "test@example.com",
  theatreName: "Gold Screen",
  locationName: "Pitampura",
  date: "Mon, 02 Mar 2026",
  timeSlot: "10:00 - 12:00",
  guestCount: 2,
  totalAmount: 3000,
  advancePaid: 3000,
  remainingPayable: 0,
  successUrl: "https://example.com/booking/success?t=abc",
};

describe("BookingConfirmationEmail template", () => {
  it("hides balance row when remaining payable is zero (dark theme)", async () => {
    const html = await render(renderBookingConfirmationEmail(baseProps, "dark"));
    expect(html).not.toContain("Balance at Theatre");
  });

  it("hides balance row when remaining payable is zero (light theme)", async () => {
    const html = await render(renderBookingConfirmationEmail(baseProps, "light"));
    expect(html).not.toContain("Balance at Theatre");
  });

  it("shows balance row when remaining payable is greater than zero", async () => {
    const html = await render(
      renderBookingConfirmationEmail(
        {
          ...baseProps,
          advancePaid: 1000,
          remainingPayable: 2000,
        },
        "dark"
      )
    );
    expect(html).toContain("Balance at Venue");
  });

  it("uses reassuring post-payment status language", async () => {
    const html = await render(renderBookingConfirmationEmail(baseProps, "dark"));

    expect(html).toContain(BOOKING_CONFIRMED_TITLE);
    expect(html).toContain(
      `${BOOKING_CONFIRMED_MESSAGE} ${BOOKING_PAYMENT_APPLIED_MESSAGE}`
    );
    expect(html).not.toContain(`${BOOKING_CONFIRMED_MESSAGE}</p>`);
    expect(html).not.toContain("Booking NOT Confirmed");
    expect(html).not.toContain("deposit is non-refundable");
  });

  it("uses pay-later copy and hides zero paid amount for admin-created pay-later customer email", async () => {
    const html = await render(
      renderBookingConfirmationEmail(
        {
          ...baseProps,
          advancePaid: 0,
          remainingPayable: baseProps.totalAmount,
        },
        "light"
      )
    );

    expect(html).toContain(BOOKING_PAY_LATER_MESSAGE);
    expect(html).not.toContain(BOOKING_PAYMENT_APPLIED_MESSAGE);
    expect(html).not.toContain("Amount Paid");
    expect(html).not.toContain("$0.00");
    expect(html).toContain("Balance Due");
  });

  it("uses pay-later balance wording in the admin confirmation email", async () => {
    const html = await render(
      AdminBookingConfirmationEmail({
        ...baseProps,
        advancePaid: 0,
        remainingPayable: baseProps.totalAmount,
        paymentStatus: "INITIALIZED",
      })
    );

    expect(html).not.toContain("Paid");
    expect(html).not.toContain("$0.00");
    expect(html).toContain("Balance Due");
    expect(html).toContain("Awaiting Payment");
    expect(html).not.toContain("INITIALIZED");
  });
});
