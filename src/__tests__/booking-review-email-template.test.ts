import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";

import BookingReviewEmail, {
  type BookingReviewEmailProps,
} from "@/emails/BookingReviewEmail";

const baseProps: Omit<BookingReviewEmailProps, "variant"> = {
  bookingRef: "HR0712202600001",
  customerName: "Alex Rivera",
  customerPhone: "3055550123",
  customerEmail: "alex@example.com",
  theatreName: "Signature Package",
  locationName: "Miami",
  date: "Sat, 01 Aug 2026",
  timeSlot: "18:00 - 23:00",
  guestCount: 24,
  occasionLabel: "Birthday",
  decorationRequired: true,
  totalAmount: 2400,
  agreementSigned: true,
  actionUrl: "https://example.com/booking/success?t=abc",
};

describe("BookingReviewEmail template", () => {
  it("tells a submitting customer that no payment is due", async () => {
    const html = await render(
      BookingReviewEmail({ ...baseProps, variant: "SUBMITTED" })
    );

    expect(html).toContain("Booking Request Received");
    expect(html).toContain("Not required today");
    expect(html).toContain("No payment is required today");
    expect(html).toContain("Alex Rivera");
    expect(html).toContain("Signature Package");
  });

  it("confirms the contact details the customer will be reached on", async () => {
    const html = await render(
      BookingReviewEmail({ ...baseProps, variant: "SUBMITTED" })
    );

    expect(html).toContain("3055550123");
    expect(html).toContain("alex@example.com");
  });

  it("never quotes a payment due amount to a submitting customer", async () => {
    const html = await render(
      BookingReviewEmail({ ...baseProps, variant: "SUBMITTED" })
    );

    expect(html).not.toContain("Payment Due Now");
    expect(html.toLowerCase()).not.toContain("deposit");
    expect(html.toLowerCase()).not.toContain("balance");
  });

  it("never asks any variant for money", async () => {
    for (const variant of [
      "SUBMITTED",
      "ADMIN_SUBMITTED",
      "APPROVED",
      "REJECTED",
    ] as const) {
      const html = await render(
        BookingReviewEmail({ ...baseProps, variant })
      );

      expect(html.toLowerCase()).not.toContain("pay now");
      expect(html.toLowerCase()).not.toContain("complete your payment");
      expect(html.toLowerCase()).not.toContain("checkout");
    }
  });

  it("shows the admin the customer contact and agreement state", async () => {
    const html = await render(
      BookingReviewEmail({ ...baseProps, variant: "ADMIN_SUBMITTED" })
    );

    expect(html).toContain("New booking request");
    expect(html).toContain("3055550123");
    expect(html).toContain("alex@example.com");
    expect(html).toContain("Signed");
  });

  it("keeps approval payment instructions neutral", async () => {
    const html = await render(
      BookingReviewEmail({ ...baseProps, variant: "APPROVED" })
    );

    expect(html).toContain("approved");
    expect(html).toContain("contact you with the next steps");
  });

  it("includes the rejection reason for the customer", async () => {
    const html = await render(
      BookingReviewEmail({
        ...baseProps,
        variant: "REJECTED",
        rejectionReason: "The venue is closed for maintenance that weekend.",
      })
    );

    expect(html).toContain("Reason:");
    expect(html).toContain("closed for maintenance");
  });
});
