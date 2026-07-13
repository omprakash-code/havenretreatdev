import { formatInTimeZone } from "date-fns-tz";
import { Prisma } from "@prisma/client";
import AdminBookingAbandonmentEmail from "@/emails/AdminBookingAbandonmentEmail";
import UserBookingAbandonmentEmail from "@/emails/UserBookingAbandonmentEmail";
import { resolvePresentedBookingSchedule } from "@/lib/booking-schedule-presenter";
import { prisma } from "@/lib/db";
import { isNumberDecorationProduct } from "@/lib/product-numbering";
import { sendEmail } from "@/services/email.service";
import { resolveAdminBookingNotificationRecipients } from "@/services/booking/booking-notification-recipients.service";

const IST_TIMEZONE = "Asia/Kolkata";

const resolvedBaseUrl = (() => {
  const nextPublic = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (nextPublic) return nextPublic.replace(/\/+$/, "");

  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) return appUrl.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "";
})();

function resolveResumeUrl() {
  return resolvedBaseUrl ? `${resolvedBaseUrl}/booking` : "/booking";
}

type BookingForAbandonmentNotification = {
  id: string;
  bookingRef: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  guestCount: number;
  occasionLabel: string | null;
  occasionData: Prisma.JsonValue | null;
  cancelledReason: string | null;
  cancelledAt: Date | null;
  bookingStatus: string;
  eventDate: Date | null;
  eventStartTime: string | null;
  eventEndTime: string | null;
  startsAtUtc: Date | null;
  endsAtUtc: Date | null;
  timezone: string | null;
  packageSnapshot: Prisma.JsonValue | null;
  items: Array<{
    productName: string;
    variantLabel: string;
    quantity: number;
    totalPrice: number;
  }>;
};

function stringifyOccasionValue(value: Prisma.JsonValue): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyOccasionValue(item as Prisma.JsonValue))
      .filter((item) => item.length > 0)
      .join(", ");
  }
  return "";
}

function isOccasionNumberKey(key: string) {
  const normalized = key.trim().toLowerCase().replace(/[_\-\s]+/g, "");
  return normalized === "lednumber" || normalized === "ledno" || normalized === "led";
}

function buildOccasionDetails(occasionData: Prisma.JsonValue | null) {
  if (!occasionData || typeof occasionData !== "object" || Array.isArray(occasionData)) {
    return [];
  }

  const source = occasionData as Record<string, Prisma.JsonValue>;
  return Object.entries(source)
    .filter(([label]) => !isOccasionNumberKey(label))
    .map(([label, value]) => ({
      label,
      value: stringifyOccasionValue(value),
    }))
    .filter((entry) => entry.value.length > 0);
}

function extractNumberValues(value: Prisma.JsonValue): string[] {
  if (typeof value === "string") {
    const clean = value.trim();
    return clean ? [clean] : [];
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? "").trim())
      .filter((entry) => entry.length > 0);
  }
  return [];
}

function extractLedNumbersFromOccasionData(occasionData: Prisma.JsonValue | null) {
  if (!occasionData || typeof occasionData !== "object" || Array.isArray(occasionData)) {
    return [] as string[];
  }

  const source = occasionData as Record<string, Prisma.JsonValue>;
  const directKeys = ["ledNumber", "led_number", "ledNo", "ledno", "led"];

  for (const key of directKeys) {
    if (key in source) {
      const values = extractNumberValues(source[key]);
      if (values.length > 0) {
        return values;
      }
    }
  }

  for (const [key, value] of Object.entries(source)) {
    if (!isOccasionNumberKey(key)) continue;
    const values = extractNumberValues(value);
    if (values.length > 0) {
      return values;
    }
  }

  return [] as string[];
}

function buildAddonItemsWithNumberValues(
  bookingItems: BookingForAbandonmentNotification["items"],
  occasionData: Prisma.JsonValue | null
) {
  const ledNumbers = extractLedNumbersFromOccasionData(occasionData);
  let ledIndex = 0;

  return bookingItems.map((item) => {
    const isNumberItem = isNumberDecorationProduct({ name: item.productName });
    const numberValue = isNumberItem ? ledNumbers[ledIndex++] : undefined;

    return {
      name: item.productName,
      variantLabel: item.variantLabel,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      numberValue,
    };
  });
}

function hasMeaningfulContactData(booking: BookingForAbandonmentNotification) {
  return Boolean(
    booking.contactName?.trim() ||
      booking.contactPhone?.trim() ||
      booking.contactEmail?.trim()
  );
}

function isPaymentStageAbandonment(reason: string | null | undefined) {
  return (
    reason === "PAYMENT_CHECKOUT_ABANDONED" ||
    reason === "PAYMENT_STEP_ABANDONED" ||
    reason === "SESSION_SLOT_SWITCHED"
  );
}

function areAbandonmentEmailsEnabled() {
  return false;
}

async function sendAbandonmentNotificationForBooking(
  booking: BookingForAbandonmentNotification
) {
  if (booking.bookingStatus !== "ABANDONED") {
    return;
  }

  if (!hasMeaningfulContactData(booking)) {
    return;
  }

  const schedule = resolvePresentedBookingSchedule({
    eventDate: booking.eventDate,
    eventStartTime: booking.eventStartTime,
    eventEndTime: booking.eventEndTime,
    startsAtUtc: booking.startsAtUtc,
    endsAtUtc: booking.endsAtUtc,
    timezone: booking.timezone,
  });

  if (!schedule) {
    return;
  }

  const date = schedule.date;
  const timeSlot = schedule.timeSlot;
  const occasionDetails = buildOccasionDetails(booking.occasionData);
  const addonItems = buildAddonItemsWithNumberValues(
    booking.items,
    booking.occasionData
  );
  const abandonedAt = formatInTimeZone(
    booking.cancelledAt ?? new Date(),
    IST_TIMEZONE,
    "EEE, dd MMM yyyy, hh:mm a"
  );

  let customerEmailSent = false;
  let adminEmailSent = false;

  if (booking.contactEmail) {
    await sendEmail({
      to: booking.contactEmail,
      subject: `Payment Not Completed | ${booking.bookingRef}`,
      react: UserBookingAbandonmentEmail({
        bookingRef: booking.bookingRef,
        customerName: booking.contactName ?? undefined,
        theatreName: (booking.packageSnapshot as { name?: string } | null)?.name ?? "Haven Retreat",
        locationName: undefined,
        date,
        timeSlot,
        guestCount: booking.guestCount,
        resumeUrl: resolveResumeUrl(),
        cancelledReason: booking.cancelledReason ?? undefined,
        occasionLabel: booking.occasionLabel ?? undefined,
        occasionDetails,
        addonItems,
      }),
    });
    customerEmailSent = true;
  }

  const adminRecipients = resolveAdminBookingNotificationRecipients();
  if (adminRecipients.length > 0) {
    const adminSubject = isPaymentStageAbandonment(booking.cancelledReason)
      ? `Admin Alert | Payment Not Completed | ${booking.bookingRef}`
      : `Admin Alert | Booking Abandoned | ${booking.bookingRef}`;
    const adminResults = await Promise.allSettled(
      adminRecipients.map((to) =>
        sendEmail({
          to,
          subject: adminSubject,
          react: AdminBookingAbandonmentEmail({
            bookingRef: booking.bookingRef,
            customerName: booking.contactName ?? undefined,
            customerPhone: booking.contactPhone ?? undefined,
            customerEmail: booking.contactEmail ?? undefined,
            theatreName: (booking.packageSnapshot as { name?: string } | null)?.name ?? "Haven Retreat",
            locationName: undefined,
            date,
            timeSlot,
            guestCount: booking.guestCount,
            cancelledReason: booking.cancelledReason ?? undefined,
            abandonedAt,
            occasionLabel: booking.occasionLabel ?? undefined,
            occasionDetails,
            addonItems,
          }),
        })
      )
    );
    adminEmailSent = adminResults.some(
      (result) => result.status === "fulfilled"
    );
  }

  if (customerEmailSent || adminEmailSent) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        ...(customerEmailSent
          ? { abandonmentCustomerEmailSentAt: new Date() }
          : {}),
        ...(adminEmailSent
          ? { abandonmentAdminEmailSentAt: new Date() }
          : {}),
      },
    });
  }
}

export async function notifyAbandonedBookingsByIds(
  abandonedBookingIds: string[]
) {
  // Abandonment recovery is paused until the future selling/recovery workflow
  // is ready. Keep callers harmless while still returning a stable shape.
  if (!areAbandonmentEmailsEnabled()) {
    return { notifiedBookingIds: [] as string[] };
  }

  const uniqueIds = Array.from(
    new Set(
      abandonedBookingIds
        .map((id) => String(id).trim())
        .filter((id) => id.length > 0)
    )
  );

  if (uniqueIds.length === 0) {
    return { notifiedBookingIds: [] as string[] };
  }

  const bookings = await prisma.booking.findMany({
    where: {
      id: { in: uniqueIds },
      bookingStatus: "ABANDONED",
      OR: [{ createdByRole: null }, { createdByRole: { not: "ADMIN" } }],
    },
    select: {
      id: true,
      bookingRef: true,
      contactName: true,
      contactPhone: true,
      contactEmail: true,
      guestCount: true,
      occasionLabel: true,
      occasionData: true,
      cancelledReason: true,
      cancelledAt: true,
      bookingStatus: true,
      eventDate: true,
      eventStartTime: true,
      eventEndTime: true,
      startsAtUtc: true,
      endsAtUtc: true,
      timezone: true,
      packageSnapshot: true,
      items: {
        select: {
          productName: true,
          variantLabel: true,
          quantity: true,
          totalPrice: true,
        },
      },
    },
  });

  const notifiedBookingIds: string[] = [];

  for (const booking of bookings) {
    try {
      await sendAbandonmentNotificationForBooking(booking);
      notifiedBookingIds.push(booking.id);
    } catch (error) {
      console.error("BOOKING_ABANDONMENT_EMAIL_FAILED", {
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        error,
      });
    }
  }

  return { notifiedBookingIds };
}
