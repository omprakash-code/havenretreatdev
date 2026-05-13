import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { renderBookingConfirmationEmail } from "@/emails/renderBookingConfirmationEmail";

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
    expect(html).toContain("Balance at Theatre");
  });
});
