import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";

import BookingPaymentLinkEmail from "@/emails/BookingPaymentLinkEmail";
import BookingReviewEmail from "@/emails/BookingReviewEmail";
import UserBookingAbandonmentEmail from "@/emails/UserBookingAbandonmentEmail";
import UserPaymentReceivedBookingFailedEmail from "@/emails/UserPaymentReceivedBookingFailedEmail";

const ctaTemplates: Array<[string, string, () => Promise<string>]> = [
  [
    "approved review",
    "View Your Booking",
    () =>
      render(
        BookingReviewEmail({
          variant: "APPROVED",
          bookingRef: "HR-CTA-0001",
          customerName: "CTA Customer",
          theatreName: "Haven Retreat",
          date: "2030-01-01",
          timeSlot: "10:00 - 15:00",
          guestCount: 10,
          totalAmount: 675,
          agreementSigned: true,
          actionUrl: "https://example.com/booking/success?t=cta",
          actionLabel: "View Your Booking",
        })
      ),
  ],
  [
    "payment link",
    "Pay Now",
    () =>
      render(
        BookingPaymentLinkEmail({
          bookingRef: "HR-CTA-0001",
          customerName: "CTA Customer",
          amountDue: 150,
          paymentLinkUrl: "https://example.com/pay",
        })
      ),
  ],
  [
    "booking failed restart",
    "Restart Booking",
    () =>
      render(
        UserPaymentReceivedBookingFailedEmail({
          bookingRef: "HR-CTA-0001",
          customerName: "CTA Customer",
          theatreName: "Haven Retreat",
          date: "2030-01-01",
          timeSlot: "10:00 - 15:00",
          guestCount: 10,
          amountPaid: 150,
          restartUrl: "https://example.com/booking",
        })
      ),
  ],
  [
    "booking abandonment",
    "Continue Booking",
    () =>
      render(
        UserBookingAbandonmentEmail({
          bookingRef: "HR-CTA-0001",
          customerName: "CTA Customer",
          theatreName: "Haven Retreat",
          date: "2030-01-01",
          timeSlot: "10:00 - 15:00",
          guestCount: 10,
          resumeUrl: "https://example.com/booking",
        })
      ),
  ],
];

function ctaFragment(html: string, label: string) {
  const labelIndex = html.indexOf(label);
  if (labelIndex === -1) return "";
  const start = html.lastIndexOf("<td", labelIndex);
  const end = html.indexOf("</td>", labelIndex);
  return html.slice(start, end === -1 ? undefined : end);
}

describe.each(ctaTemplates)("%s email CTA", (_name, label, renderEmail) => {
  it("uses white text on the teal action button", async () => {
    const fragment = ctaFragment(await renderEmail(), label);

    expect(fragment).toContain(`>${label}</a>`);
    expect(fragment).toContain("background-color:#347f7c");
    expect(fragment).toContain("color:#ffffff");
    expect(fragment).not.toContain("color:#111827");
  });

  it("renders the action button flat", async () => {
    const fragment = ctaFragment(await renderEmail(), label);

    expect(fragment).toContain("border-radius:0");
    expect(fragment).not.toContain("border-radius:4px");
  });
});
