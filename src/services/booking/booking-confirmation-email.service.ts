import type { BookingConfirmationEmailProps } from "@/emails/BookingConfirmationEmail";
import { renderBookingConfirmationEmail } from "@/emails/renderBookingConfirmationEmail";
import { buildBookingConfirmationCalendarAttachment } from "@/lib/calendar/booking-confirmation-calendar";
import { buildBookingConfirmationPdfAttachment } from "@/lib/pdf/booking-confirmation";
import {
  isEmailConfigured,
  sendEmail,
  type EmailAttachment,
} from "@/services/email.service";

type SendBookingConfirmationEmailParams = {
  to: string;
  bookingRef: string;
  emailData: BookingConfirmationEmailProps;
  theme?: string | null;
  agreementAttachment?: EmailAttachment | null;
};

export async function sendBookingConfirmationEmail({
  to,
  bookingRef,
  emailData,
  theme,
  agreementAttachment,
}: SendBookingConfirmationEmailParams) {
  if (!isEmailConfigured()) {
    return false;
  }

  const attachments: EmailAttachment[] = [];

  try {
    const pdfAttachment = await buildBookingConfirmationPdfAttachment(
      bookingRef,
      emailData
    );
    attachments.push(pdfAttachment);
  } catch (pdfError) {
    console.error("BOOKING_CONFIRMATION_PDF_BUILD_FAILED", pdfError);
  }

  const calendarAttachment = buildBookingConfirmationCalendarAttachment(
    emailData,
    bookingRef
  );
  if (calendarAttachment) {
    attachments.push(calendarAttachment);
  }
  if (agreementAttachment) {
    attachments.push(agreementAttachment);
  }

  return sendEmail({
    to,
    subject: `Your Haven Retreat booking request received - ${bookingRef}`,
    react: renderBookingConfirmationEmail(emailData, theme),
    attachments: attachments.length > 0 ? attachments : undefined,
  });
}
