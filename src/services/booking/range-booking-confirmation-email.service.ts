import { Prisma } from "@prisma/client";

import type {
  BookingConfirmationAddonItem,
  BookingConfirmationDetail,
  BookingConfirmationEmailProps,
} from "@/emails/BookingConfirmationEmail";
import { prisma } from "@/lib/db";
import { resolvePresentedBookingSchedule } from "@/lib/booking-schedule-presenter";
import { isNumberDecorationProduct } from "@/lib/product-numbering";
import { resolveLocationDisplayName } from "@/lib/location-display";
import { sendBookingConfirmationEmail } from "@/services/booking/booking-confirmation-email.service";
import { sendAdminBookingConfirmationEmail } from "@/services/booking/admin-booking-confirmation-email.service";
import { createStoredAgreementAttachment } from "@/lib/pdf/stored-signed-agreement";

function stringifyOccasionValue(value: Prisma.JsonValue): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyOccasionValue(item as Prisma.JsonValue))
      .filter((v) => v.length > 0)
      .join(", ");
  }
  return "";
}

function isOccasionNumberKey(key: string) {
  const normalized = key.trim().toLowerCase().replace(/[_\-\s]+/g, "");
  return normalized === "lednumber" || normalized === "ledno" || normalized === "led";
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
    .map(([label, value]) => ({ label, value: stringifyOccasionValue(value) }))
    .filter((entry) => entry.value.length > 0);
}

function extractNumberValues(value: Prisma.JsonValue): string[] {
  if (typeof value === "string") {
    const clean = value.trim();
    return clean ? [clean] : [];
  }
  if (typeof value === "number" && Number.isFinite(value)) return [String(value)];
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? "").trim())
      .filter((entry) => entry.length > 0);
  }
  return [];
}

function extractLedNumbers(occasionData: Prisma.JsonValue | null): string[] {
  if (!occasionData || typeof occasionData !== "object" || Array.isArray(occasionData)) {
    return [];
  }
  const source = occasionData as Record<string, Prisma.JsonValue>;
  const directKeys = ["ledNumber", "led_number", "ledNo", "ledno", "led"];
  for (const key of directKeys) {
    if (key in source) {
      const values = extractNumberValues(source[key]);
      if (values.length > 0) return values;
    }
  }
  for (const [key, value] of Object.entries(source)) {
    if (!isOccasionNumberKey(key)) continue;
    const values = extractNumberValues(value);
    if (values.length > 0) return values;
  }
  return [];
}

function buildAddonItems(
  items: Array<{
    productName: string;
    variantLabel: string;
    quantity: number;
    totalPrice: number;
    product: { image: string | null } | null;
  }>,
  occasionData: Prisma.JsonValue | null
): BookingConfirmationAddonItem[] {
  const ledNumbers = extractLedNumbers(occasionData);
  let ledIndex = 0;
  return items.map((item) => {
    const isNumberItem = isNumberDecorationProduct({ name: item.productName });
    const numberValue = isNumberItem ? ledNumbers[ledIndex++] : undefined;
    return {
      name: item.productName,
      variantLabel: item.variantLabel,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      numberValue,
      image: item.product?.image ?? null,
    };
  });
}

export async function sendRangeBookingConfirmationEmails({
  bookingId,
  successToken,
  confirmationSource,
}: {
  bookingId: string;
  successToken: string;
  confirmationSource?: string;
}) {
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
          product: {
            select: {
              image: true,
            },
          },
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
          id: true,
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

  if (!booking || booking.bookingStatus !== "CONFIRMED") return;

  const schedule = resolvePresentedBookingSchedule({
    eventDate: booking.eventDate,
    eventStartTime: booking.eventStartTime,
    eventEndTime: booking.eventEndTime,
    startsAtUtc: booking.startsAtUtc,
    endsAtUtc: booking.endsAtUtc,
    timezone: booking.timezone,
  });

  if (!schedule) return;

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const successUrl = `${baseUrl}/booking/success?t=${encodeURIComponent(successToken)}`;
  const latestPayment = booking.payment[0];
  const signedAgreement = booking.signedAgreements[0] ?? null;
  const agreementAttachment = signedAgreement
    ? createStoredAgreementAttachment({
        filename: signedAgreement.pdfFileName,
        content: signedAgreement.pdfContent,
      })
    : null;
  const packageSnapshot =
    booking.packageSnapshot &&
    typeof booking.packageSnapshot === "object" &&
    !Array.isArray(booking.packageSnapshot)
      ? (booking.packageSnapshot as Record<string, unknown>)
      : null;
  const pricingSnapshot =
    booking.pricingSnapshot &&
    typeof booking.pricingSnapshot === "object" &&
    !Array.isArray(booking.pricingSnapshot)
      ? (booking.pricingSnapshot as Record<string, unknown>)
      : null;
  const durationHours = schedule.durationHours;
  const includedDurationHours = Math.max(
    0,
    Number(
      pricingSnapshot?.includedDurationHours ??
        packageSnapshot?.eventDurationHours ??
        durationHours ??
        0
    )
  );
  const extraDurationHours =
    durationHours !== null
      ? Math.max(durationHours - includedDurationHours, 0)
      : null;
  const extraDurationAmount = Math.max(
    0,
    Number(pricingSnapshot?.extraDurationAmount ?? 0)
  ) || null;
  const addonItems = buildAddonItems(
    booking.items,
    booking.occasionData as Prisma.JsonValue | null
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
    durationHours,
    includedDurationHours,
    extraDurationHours,
    extraDurationAmount,
    guestCount: booking.guestCount,
    occasionLabel: booking.occasionLabel ?? undefined,
    occasionDetails: buildOccasionDetails(booking.occasionData as Prisma.JsonValue | null),
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
    paymentType: booking.paymentProvider ?? latestPayment?.provider ?? undefined,
    paymentMethod: latestPayment?.method ?? "ONLINE",
    paymentStatus: booking.paymentStatus ?? latestPayment?.status ?? undefined,
    paymentReference: booking.paymentTransactionId ?? latestPayment?.transactionId ?? undefined,
    baseAmount: booking.baseAmount,
    extrasAmount: booking.extrasAmount,
    productsAmount: booking.productsAmount,
    decorationAmount: booking.decorationAmount,
    discountAmount: booking.discountAmount,
    totalAmount: booking.totalAmount,
    advancePaid: booking.advancePaid,
    remainingPayable: booking.remainingPayable,
    successUrl,
  };

  if (booking.contactEmail && !booking.confirmationEmailSent) {
    try {
      await sendBookingConfirmationEmail({
        to: booking.contactEmail,
        bookingRef: booking.bookingRef,
        emailData,
        theme: process.env.BOOKING_EMAIL_THEME,
        agreementAttachment,
      });
      await prisma.booking.update({
        where: { id: booking.id },
        data: { confirmationEmailSent: true },
      });
    } catch (err) {
      console.error("RANGE_BOOKING_CUSTOMER_EMAIL_FAILED", err);
    }
  }

  try {
    await sendAdminBookingConfirmationEmail({
      bookingRef: booking.bookingRef,
      emailData,
      confirmationSource,
      agreementAttachment,
    });
  } catch (err) {
    console.error("RANGE_BOOKING_ADMIN_EMAIL_FAILED", err);
  }
}
