import BookingReviewEmail, {
  type BookingReviewEmailProps,
  type BookingReviewEmailVariant,
} from "@/emails/BookingReviewEmail";
import { prisma } from "@/lib/db";
import { resolveLocationDisplayName } from "@/lib/location-display";
import { resolvePresentedBookingSchedule } from "@/lib/booking-schedule-presenter";
import { createStoredAgreementAttachment } from "@/lib/pdf/stored-signed-agreement";
import { sendEmail, type EmailAttachment } from "@/services/email.service";
import { resolveAdminBookingNotificationRecipients } from "@/services/booking/booking-notification-recipients.service";
import { createSuccessToken } from "@/services/booking/successToken.server";

/**
 * Emails for the review workflow. Sending is synchronous today but isolated
 * here, so it can move to a queue without touching booking logic.
 *
 * A failed email must never fail the booking decision it reports, so every send
 * is logged and swallowed.
 */

function resolveBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
}

async function loadReviewEmailContext(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      venue: true,
      signedAgreements: {
        orderBy: { signedAt: "desc" },
        take: 1,
        select: { id: true, pdfFileName: true, pdfContent: true },
      },
    },
  });

  if (!booking) return null;

  const schedule = resolvePresentedBookingSchedule({
    eventDate: booking.eventDate,
    eventStartTime: booking.eventStartTime,
    eventEndTime: booking.eventEndTime,
    startsAtUtc: booking.startsAtUtc,
    endsAtUtc: booking.endsAtUtc,
    timezone: booking.timezone,
  });

  if (!schedule) return null;

  const signedAgreement = booking.signedAgreements[0] ?? null;

  const base: Omit<BookingReviewEmailProps, "variant"> = {
    bookingRef: booking.bookingRef,
    customerName: booking.contactName ?? "Guest",
    customerPhone: booking.contactPhone,
    customerEmail: booking.contactEmail,
    theatreName:
      (booking.packageSnapshot as { name?: string } | null)?.name ??
      "Haven Retreat",
    locationName: resolveLocationDisplayName(null, booking.venue?.city),
    date: schedule.date,
    timeSlot: schedule.timeSlot,
    guestCount: booking.guestCount,
    occasionLabel: booking.occasionLabel,
    decorationRequired: booking.decorationRequired,
    totalAmount: booking.totalAmount,
    agreementSigned: Boolean(signedAgreement),
    rejectionReason: booking.rejectionReason,
  };

  const agreementAttachment: EmailAttachment | null = signedAgreement
    ? createStoredAgreementAttachment({
        filename: signedAgreement.pdfFileName,
        content: signedAgreement.pdfContent,
      })
    : null;

  return {
    booking,
    base,
    agreementAttachment,
    successUrl: `${resolveBaseUrl()}/booking/success?t=${encodeURIComponent(
      createSuccessToken(booking.id, booking.bookingRef)
    )}`,
  };
}

async function send(
  variant: BookingReviewEmailVariant,
  to: string,
  subject: string,
  props: Omit<BookingReviewEmailProps, "variant">,
  options: {
    actionUrl?: string | null;
    actionLabel?: string;
    attachments?: EmailAttachment[];
  } = {}
) {
  await sendEmail({
    to,
    subject,
    react: BookingReviewEmail({
      ...props,
      variant,
      actionUrl: options.actionUrl,
      actionLabel: options.actionLabel,
    }),
    attachments:
      options.attachments && options.attachments.length > 0
        ? options.attachments
        : undefined,
  });
}

/** Customer + admin notification for a newly submitted booking request. */
export async function sendBookingSubmittedEmails(bookingId: string) {
  const context = await loadReviewEmailContext(bookingId);
  if (!context) return;

  const { booking, base, agreementAttachment, successUrl } = context;

  if (booking.contactEmail) {
    try {
      await send(
        "SUBMITTED",
        booking.contactEmail,
        `Booking Request Received - ${booking.bookingRef}`,
        base,
        {
          actionUrl: successUrl,
          actionLabel: "View Request",
          attachments: agreementAttachment ? [agreementAttachment] : undefined,
        }
      );
    } catch (error) {
      console.error("BOOKING_SUBMITTED_CUSTOMER_EMAIL_FAILED", error);
    }
  }

  const adminRecipients = resolveAdminBookingNotificationRecipients();
  const reviewUrl = `${resolveBaseUrl()}/admin/bookings?status=PENDING_REVIEW`;

  for (const recipient of adminRecipients) {
    try {
      await send(
        "ADMIN_SUBMITTED",
        recipient,
        `New Booking Request - Review Required - ${booking.bookingRef}`,
        base,
        {
          actionUrl: reviewUrl,
          actionLabel: "Review Request",
          attachments: agreementAttachment ? [agreementAttachment] : undefined,
        }
      );
    } catch (error) {
      console.error("BOOKING_SUBMITTED_ADMIN_EMAIL_FAILED", error);
    }
  }
}

/** Customer notification for an approved booking. Payment stays neutral. */
export async function sendBookingApprovedEmail(bookingId: string) {
  const context = await loadReviewEmailContext(bookingId);
  if (!context?.booking.contactEmail) return;

  const { booking, base, successUrl } = context;

  try {
    await send(
      "APPROVED",
      booking.contactEmail!,
      `Booking approved - ${booking.bookingRef}`,
      base,
      { actionUrl: successUrl, actionLabel: "View Booking" }
    );
  } catch (error) {
    console.error("BOOKING_APPROVED_CUSTOMER_EMAIL_FAILED", error);
  }
}

/** Customer notification for a rejected request, including the admin's reason. */
export async function sendBookingRejectedEmail(bookingId: string) {
  const context = await loadReviewEmailContext(bookingId);
  if (!context?.booking.contactEmail) return;

  const { booking, base } = context;

  try {
    await send(
      "REJECTED",
      booking.contactEmail!,
      `Booking request update - ${booking.bookingRef}`,
      base,
      { actionUrl: `${resolveBaseUrl()}/contact`, actionLabel: "Contact Us" }
    );
  } catch (error) {
    console.error("BOOKING_REJECTED_CUSTOMER_EMAIL_FAILED", error);
  }
}
