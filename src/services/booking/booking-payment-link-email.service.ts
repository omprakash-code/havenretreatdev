import BookingPaymentLinkEmail from "@/emails/BookingPaymentLinkEmail";
import { sendEmail } from "@/services/email.service";

type SendBookingPaymentLinkEmailParams = {
  to: string;
  bookingRef: string;
  customerName?: string | null;
  amountDue: number;
  currency?: string;
  paymentLinkUrl: string;
};

export async function sendBookingPaymentLinkEmail({
  to,
  bookingRef,
  customerName,
  amountDue,
  currency,
  paymentLinkUrl,
}: SendBookingPaymentLinkEmailParams) {
  await sendEmail({
    to,
    subject: `Complete your payment for booking ${bookingRef}`,
    react: BookingPaymentLinkEmail({
      bookingRef,
      customerName: customerName ?? undefined,
      amountDue,
      currency,
      paymentLinkUrl,
    }),
  });
}
