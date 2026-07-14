import type {
  BookingConfirmationAddonItem,
  BookingConfirmationDetail,
  BookingConfirmationEmailProps,
} from "@/emails/BookingConfirmationEmail";
import AdminBookingConfirmationEmail from "@/emails/AdminBookingConfirmationEmail";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolvePresentedBookingSchedule } from "@/lib/booking-schedule-presenter";
import { isNumberDecorationProduct } from "@/lib/product-numbering";
import { resolveLocationDisplayName } from "@/lib/location-display";
import { sendEmail, type EmailAttachment } from "@/services/email.service";
import { resolveAdminBookingNotificationRecipients } from "@/services/booking/booking-notification-recipients.service";
import { createStoredAgreementAttachment } from "@/lib/pdf/stored-signed-agreement";

type SendAdminBookingConfirmationEmailParams = {
  bookingRef: string;
  emailData: BookingConfirmationEmailProps;
  confirmationSource?: string;
  agreementAttachment?: EmailAttachment | null;
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
  return (
    normalized === "lednumber" ||
    normalized === "ledno" ||
    normalized === "led"
  );
}

function buildOccasionDetails(
  occasionData: Prisma.JsonValue | null
): BookingConfirmationDetail[] {
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

function extractLedNumbersFromOccasionData(
  occasionData: Prisma.JsonValue | null
) {
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
  bookingItems: Array<{
    productName: string;
    variantLabel: string;
    quantity: number;
    totalPrice: number;
  }>,
  occasionData: Prisma.JsonValue | null
): BookingConfirmationAddonItem[] {
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

export async function sendAdminBookingConfirmationEmail({
  bookingRef,
  emailData,
  agreementAttachment,
}: SendAdminBookingConfirmationEmailParams) {
  const recipients = resolveAdminBookingNotificationRecipients();
  if (recipients.length === 0) {
    return { sentCount: 0 };
  }

  await Promise.allSettled(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: `New Booking - Haven Retreat | ${bookingRef}`,
        react: AdminBookingConfirmationEmail(emailData),
        attachments: agreementAttachment ? [agreementAttachment] : undefined,
      })
    )
  );

  return { sentCount: recipients.length };
}

export async function sendAdminBookingConfirmationEmailByBookingId(
  bookingId: string,
  confirmationSource?: string
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      venue: true,
      items: {
        select: {
          productName: true,
          variantLabel: true,
          quantity: true,
          totalPrice: true,
        },
      },
      payment: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      signedAgreements: {
        orderBy: { signedAt: "desc" },
        take: 1,
        select: {
          agreementRef: true,
          signerName: true,
          signerEmail: true,
          signedAt: true,
          signatureImage: true,
          agreementVersion: true,
          agreementHtmlSnapshot: true,
          acknowledgedClauses: true,
          confirmationAccepted: true,
          pdfFileName: true,
          pdfContent: true,
        },
      },
    },
  });

  if (!booking || booking.bookingStatus !== "APPROVED") {
    return { sentCount: 0 };
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
    return { sentCount: 0 };
  }

  const latestPayment = booking.payment[0];
  const signedAgreement = booking.signedAgreements[0] ?? null;
  const addonItems = buildAddonItemsWithNumberValues(
    booking.items,
    (booking.occasionData as Prisma.JsonValue | null) ?? null
  );
  const emailData: BookingConfirmationEmailProps = {
    bookingRef: booking.bookingRef,
    customerName: booking.contactName ?? "Guest",
    customerPhone: booking.contactPhone ?? "-",
    customerEmail: booking.contactEmail ?? undefined,
    theatreName:
      (booking.packageSnapshot as { name?: string } | null)?.name ??
      "Haven Retreat",
    locationName: resolveLocationDisplayName(null, booking.venue?.city),
    date: schedule.date,
    timeSlot: schedule.timeSlot,
    guestCount: booking.guestCount,
    occasionLabel: booking.occasionLabel ?? undefined,
    occasionDetails: buildOccasionDetails(
      (booking.occasionData as Prisma.JsonValue | null) ?? null
    ),
    addonItems,
    signedAgreement: signedAgreement
      ? {
          id: signedAgreement.agreementRef,
          signerName: signedAgreement.signerName,
          signerEmail: signedAgreement.signerEmail,
          signedAt: signedAgreement.signedAt.toISOString(),
          signatureImage: signedAgreement.signatureImage,
          agreementVersion: signedAgreement.agreementVersion,
          agreementHtmlSnapshot: signedAgreement.agreementHtmlSnapshot,
          acknowledgedClauses: Array.isArray(signedAgreement.acknowledgedClauses)
            ? signedAgreement.acknowledgedClauses.filter(
                (clause): clause is number => typeof clause === "number"
              )
            : [],
          confirmationAccepted: signedAgreement.confirmationAccepted,
        }
      : null,
    paymentType: latestPayment?.provider ?? undefined,
    paymentMethod: latestPayment?.method ?? undefined,
    paymentStatus: booking.paymentStatus ?? latestPayment?.status ?? undefined,
    paymentReference: latestPayment?.transactionId ?? booking.paymentTransactionId ?? undefined,
    totalAmount: booking.totalAmount,
    advancePaid: booking.advancePaid,
    remainingPayable: booking.remainingPayable,
    successUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/booking/success`,
  };

  return sendAdminBookingConfirmationEmail({
    bookingRef: booking.bookingRef,
    emailData,
    confirmationSource,
    agreementAttachment: signedAgreement
      ? createStoredAgreementAttachment({
          filename: signedAgreement.pdfFileName,
          content: signedAgreement.pdfContent,
        })
      : null,
  });
}
