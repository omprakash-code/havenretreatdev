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
import { centsToMoney, toCents, toMoney } from "@/lib/money";
import { buildBookingPaymentRows } from "@/lib/booking-payment-rows";
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
    includedQuantity?: number;
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
      includedQuantity: item.includedQuantity ?? 0,
      extraQuantity: Math.max(item.quantity - (item.includedQuantity ?? 0), 0),
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

  const results = await Promise.allSettled(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: `New Booking - Haven Retreat | ${bookingRef}`,
        react: AdminBookingConfirmationEmail(emailData),
        attachments: agreementAttachment ? [agreementAttachment] : undefined,
      })
    )
  );

  const sentCount = results.filter(
    (result) => result.status === "fulfilled" && result.value
  ).length;
  return { sentCount };
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
          unitPrice: true,
          totalPrice: true,
          includedQuantity: true,
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
    // A quantity-0 row is an included line reduced to nothing — a pricing
    // record, not something to list as a booked add-on.
    booking.items
      .filter((item) => item.quantity > 0)
      .map((item) => ({
        ...item,
        totalPrice: toMoney(item.totalPrice),
      })),
    (booking.occasionData as Prisma.JsonValue | null) ?? null
  );
  // Resolved exactly as the customer email and PDF resolve it, then handed to
  // the one shared row builder. No pricing is recalculated here.
  const adminPricingSnapshot =
    booking.pricingSnapshot &&
    typeof booking.pricingSnapshot === "object" &&
    !Array.isArray(booking.pricingSnapshot)
      ? (booking.pricingSnapshot as Record<string, unknown>)
      : null;
  const adminPackageSnapshot =
    booking.packageSnapshot &&
    typeof booking.packageSnapshot === "object" &&
    !Array.isArray(booking.packageSnapshot)
      ? (booking.packageSnapshot as Record<string, unknown>)
      : null;
  const adminPackageAmount = Number(
    adminPricingSnapshot?.packageAmount ??
      adminPackageSnapshot?.subtotalAmount ??
      adminPackageSnapshot?.finalAmount ??
      0
  );
  const adminPackageAdjustment = toMoney(booking.packageAdjustmentAmount);
  const adminPackageListAmount = Number(
    adminPricingSnapshot?.packageListAmount ??
      centsToMoney(
        toCents(adminPackageAmount) + toCents(adminPackageAdjustment)
      )
  );
  const paymentRows = buildBookingPaymentRows({
    packageAmount: adminPackageAmount,
    packageListAmount: adminPackageListAmount,
    packageAdjustmentAmount: adminPackageAdjustment,
    extraDurationAmount: Number(adminPricingSnapshot?.extraDurationAmount ?? 0),
    extraDurationHours: Number(adminPricingSnapshot?.extraDurationHours ?? 0),
    decorationAmount: toMoney(booking.decorationAmount),
    additionalChargeAmount: toMoney(booking.additionalChargeAmount),
    additionalChargeReason: booking.additionalChargeReason,
    discountAmount: toMoney(booking.discountAmount),
    totalAmount: toMoney(booking.totalAmount),
    items: booking.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: toMoney(item.unitPrice),
      totalPrice: toMoney(item.totalPrice),
      includedQuantity: item.includedQuantity,
      extraQuantity: Math.max(item.quantity - item.includedQuantity, 0),
    })),
  });

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
    paymentRows,
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
    baseAmount: toMoney(booking.baseAmount),
    extrasAmount: toMoney(booking.extrasAmount),
    productsAmount: toMoney(booking.productsAmount),
    additionalChargeAmount: toMoney(booking.additionalChargeAmount),
    additionalChargeReason: booking.additionalChargeReason,
    decorationAmount: toMoney(booking.decorationAmount),
    discountAmount: toMoney(booking.discountAmount),
    totalAmount: toMoney(booking.totalAmount),
    advancePaid: toMoney(booking.advancePaid),
    remainingPayable: toMoney(booking.remainingPayable),
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
