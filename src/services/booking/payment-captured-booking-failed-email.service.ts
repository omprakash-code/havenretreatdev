import type {
  BookingConfirmationAddonItem,
  BookingConfirmationDetail,
} from "@/emails/BookingConfirmationEmail";
import { sendEmail } from "@/services/email.service";
import { resolveAdminBookingNotificationRecipients } from "@/services/booking/booking-notification-recipients.service";
import UserPaymentReceivedBookingFailedEmail from "@/emails/UserPaymentReceivedBookingFailedEmail";
import AdminPaymentReceivedBookingFailedEmail from "@/emails/AdminPaymentReceivedBookingFailedEmail";

export type PaymentCapturedBookingFailedNotificationData = {
  bookingRef: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  theatreName: string;
  locationName?: string | null;
  date: string;
  timeSlot: string;
  guestCount: number;
  amountPaid: number;
  paymentReference?: string | null;
  failureReason: string;
  restartUrl: string;
  occasionLabel?: string | null;
  occasionDetails?: BookingConfirmationDetail[];
  addonItems?: BookingConfirmationAddonItem[];
};

export async function sendPaymentCapturedBookingFailedNotifications(
  data: PaymentCapturedBookingFailedNotificationData
) {
  if (data.customerEmail) {
    await sendEmail({
      to: data.customerEmail,
      subject: `Payment Received | Booking Update | ${data.bookingRef}`,
      react: UserPaymentReceivedBookingFailedEmail({
        bookingRef: data.bookingRef,
        customerName: data.customerName ?? undefined,
        theatreName: data.theatreName,
        locationName: data.locationName ?? undefined,
        date: data.date,
        timeSlot: data.timeSlot,
        guestCount: data.guestCount,
        amountPaid: data.amountPaid,
        paymentReference: data.paymentReference ?? undefined,
        restartUrl: data.restartUrl,
        occasionLabel: data.occasionLabel ?? undefined,
        occasionDetails: data.occasionDetails ?? [],
        addonItems: data.addonItems ?? [],
      }),
    });
  }

  const adminRecipients = resolveAdminBookingNotificationRecipients();
  if (adminRecipients.length === 0) {
    return { sentCount: data.customerEmail ? 1 : 0 };
  }

  const adminSends = await Promise.allSettled(
    adminRecipients.map((to) =>
      sendEmail({
        to,
        subject: `Admin Action Required | Payment Captured But Booking Failed | ${data.bookingRef}`,
        react: AdminPaymentReceivedBookingFailedEmail({
          bookingRef: data.bookingRef,
          customerName: data.customerName ?? undefined,
          customerPhone: data.customerPhone ?? undefined,
          customerEmail: data.customerEmail ?? undefined,
          theatreName: data.theatreName,
          locationName: data.locationName ?? undefined,
          date: data.date,
          timeSlot: data.timeSlot,
          guestCount: data.guestCount,
          amountPaid: data.amountPaid,
          paymentReference: data.paymentReference ?? undefined,
          failureReason: data.failureReason,
          occasionLabel: data.occasionLabel ?? undefined,
          occasionDetails: data.occasionDetails ?? [],
          addonItems: data.addonItems ?? [],
        }),
      })
    )
  );

  return {
    sentCount:
      (data.customerEmail ? 1 : 0) +
      adminSends.filter((result) => result.status === "fulfilled").length,
  };
}
