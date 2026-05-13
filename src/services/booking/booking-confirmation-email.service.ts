import type { BookingConfirmationEmailProps } from "@/emails/BookingConfirmationEmail";
import { renderBookingConfirmationEmail } from "@/emails/renderBookingConfirmationEmail";
import { buildBookingConfirmationCalendarAttachment } from "@/lib/calendar/booking-confirmation-calendar";
import { buildBookingConfirmationPdfAttachment } from "@/lib/pdf/booking-confirmation";
import { sendEmail } from "@/services/email.service";

type SendBookingConfirmationEmailParams = {
  to: string;
  bookingRef: string;
  emailData: BookingConfirmationEmailProps;
  theme?: string | null;
};

export async function sendBookingConfirmationEmail({
  to,
  bookingRef,
  emailData,
  theme,
}: SendBookingConfirmationEmailParams) {
  const attachments: Array<{ filename: string; content: string; contentType: string }> =
    [];

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

  await sendEmail({
    to,
    subject: `Your Private Theatre is Booked – ${bookingRef}`,
    react: renderBookingConfirmationEmail(emailData, theme),
    attachments: attachments.length > 0 ? attachments : undefined,
  });
}
