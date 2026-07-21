import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { resolvePresentedBookingSchedule } from "@/lib/booking-schedule-presenter";
import { resolveLocationDisplayName } from "@/lib/location-display";
import { toMoney } from "@/lib/money";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
import { createSuccessToken } from "@/services/booking/successToken.server";
import { sendBookingConfirmationEmail } from "@/services/booking/booking-confirmation-email.service";
import { isNumberDecorationProduct } from "@/lib/product-numbering";
import {
  type BookingConfirmationAddonItem,
  type BookingConfirmationDetail,
  type BookingConfirmationEmailProps,
} from "@/emails/BookingConfirmationEmail";
import { createStoredAgreementAttachment } from "@/lib/pdf/stored-signed-agreement";

type ConfirmationEmailData = BookingConfirmationEmailProps & {
  customerName: string;
  customerPhone: string;
  locationName: string;
};

async function getAuthenticatedAdminId() {
  return getAuthenticatedAdminIdFromCookies();
}

function stringifyOccasionValue(value: Prisma.JsonValue): string {
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
          return String(item).trim();
        }
        return "";
      })
      .filter(Boolean);

    return parts.join(", ");
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  return "";
}

function normalizeOccasionNumberKey(key: string) {
  return key.trim().toLowerCase().replace(/[_\-\s]+/g, "");
}

function isOccasionNumberKey(key: string) {
  const normalized = normalizeOccasionNumberKey(key);
  return (
    normalized === "lednumber" ||
    normalized === "ledno" ||
    normalized === "led"
  );
}

function extractNumberValues(value: Prisma.JsonValue | undefined): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => extractNumberValues(entry as Prisma.JsonValue))
      .filter(Boolean);
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    const raw = String(value).trim();
    if (!raw) return [];

    return raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
}

function buildOccasionDetails(occasionData: Prisma.JsonValue | null): BookingConfirmationDetail[] {
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
  items: Array<{
    productName: string;
    variantLabel: string;
    quantity: number;
    totalPrice: number;
    image?: string | null;
  }>,
  occasionData: Prisma.JsonValue | null
): BookingConfirmationAddonItem[] {
  const ledNumbers = extractLedNumbersFromOccasionData(occasionData);
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
      image: item.image ?? null,
    };
  });
}

function buildEmailData(input: {
  bookingRef: string;
  successToken: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  locationName: string | null;
  theatreName: string;
  date: string;
  timeSlot: string;
  guestCount: number;
  occasionLabel: string | null;
  occasionData: Prisma.JsonValue | null;
  addonItems: BookingConfirmationAddonItem[];
  paymentType: string | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  paymentReference: string | null;
  baseAmount: number;
  extrasAmount: number;
  productsAmount: number;
  decorationAmount: number;
  discountAmount: number;
  totalAmount: number;
  advancePaid: number;
  remainingPayable: number;
}) {
  const data: ConfirmationEmailData = {
    bookingRef: input.bookingRef,
    customerName: input.contactName ?? "Guest",
    customerPhone: input.contactPhone ?? "—",
    customerEmail: input.contactEmail ?? undefined,
    locationName: input.locationName ?? "—",
    theatreName: input.theatreName,
    date: input.date,
    timeSlot: input.timeSlot,
    guestCount: input.guestCount,
    occasionLabel: input.occasionLabel ?? undefined,
    occasionDetails: buildOccasionDetails(input.occasionData),
    addonItems: input.addonItems,
    paymentType: input.paymentType ?? undefined,
    paymentMethod: input.paymentMethod ?? undefined,
    paymentStatus: input.paymentStatus ?? undefined,
    paymentReference: input.paymentReference ?? undefined,
    baseAmount: input.baseAmount,
    extrasAmount: input.extrasAmount,
    productsAmount: input.productsAmount,
    decorationAmount: input.decorationAmount,
    discountAmount: input.discountAmount,
    totalAmount: input.totalAmount,
    advancePaid: input.advancePaid,
    remainingPayable: input.remainingPayable,
    successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/booking/success?t=${encodeURIComponent(
      input.successToken
    )}`,
  };

  return data;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await getAuthenticatedAdminId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = (await req.json().catch(() => null)) as
      | {
          toEmail?: string;
        }
      | null;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        venue: true,
        items: {
          orderBy: { createdAt: "asc" },
          include: {
            product: {
              select: { image: true },
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

    if (!booking) {
      return NextResponse.json(
        { success: false, message: "Booking not found." },
        { status: 404 }
      );
    }

    const requestedToEmail = String(body?.toEmail ?? "").trim();
    if (requestedToEmail && !isValidEmail(requestedToEmail)) {
      return NextResponse.json(
        { success: false, message: "Invalid toEmail value." },
        { status: 400 }
      );
    }

    const emailToSend = requestedToEmail || booking.contactEmail || "";
    if (!emailToSend) {
      return NextResponse.json(
        { success: false, message: "Booking does not have a customer email." },
        { status: 400 }
      );
    }

    const successToken = createSuccessToken(booking.id, booking.bookingRef);
    const addonItems = buildAddonItemsWithNumberValues(
      booking.items.map((item) => ({
        productName: item.productName,
        variantLabel: item.variantLabel,
        quantity: item.quantity,
        totalPrice: toMoney(item.totalPrice),
        image: item.product?.image ?? null,
      })),
      booking.occasionData as Prisma.JsonValue | null
    );

    const latestPayment = booking.payment[0];
    const signedAgreement = booking.signedAgreements[0] ?? null;
    const schedule = resolvePresentedBookingSchedule({
      eventDate: booking.eventDate,
      eventStartTime: booking.eventStartTime,
      eventEndTime: booking.eventEndTime,
      startsAtUtc: booking.startsAtUtc,
      endsAtUtc: booking.endsAtUtc,
      timezone: booking.timezone,
    });

    if (!schedule) {
      return NextResponse.json(
        {
          success: false,
          message: "Booking does not have event schedule details.",
        },
        { status: 400 }
      );
    }

    const emailData: BookingConfirmationEmailProps = {
      ...buildEmailData({
      bookingRef: booking.bookingRef,
      successToken,
      contactName: booking.contactName,
      contactPhone: booking.contactPhone,
      contactEmail: booking.contactEmail,
      locationName: resolveLocationDisplayName(null, booking.venue?.city),
      theatreName: (booking.packageSnapshot as { name?: string } | null)?.name ?? booking.venue?.name ?? "Haven Retreat",
      date: schedule.date,
      timeSlot: schedule.timeSlot,
      guestCount: booking.guestCount,
      occasionLabel: booking.occasionLabel,
      occasionData: booking.occasionData as Prisma.JsonValue | null,
      addonItems,
      paymentType: latestPayment?.provider ?? null,
      paymentMethod: latestPayment?.method ?? null,
      paymentStatus: booking.paymentStatus ?? latestPayment?.status ?? null,
      paymentReference:
        latestPayment?.transactionId ?? booking.paymentTransactionId ?? null,
      baseAmount: toMoney(booking.baseAmount),
      extrasAmount: toMoney(booking.extrasAmount),
      productsAmount: toMoney(booking.productsAmount),
      decorationAmount: toMoney(booking.decorationAmount),
      discountAmount: toMoney(booking.discountAmount),
      totalAmount: toMoney(booking.totalAmount),
      advancePaid: toMoney(booking.advancePaid),
      remainingPayable: toMoney(booking.remainingPayable),
      }),
      signedAgreement: signedAgreement
        ? {
            id: signedAgreement.agreementRef,
            signerName: signedAgreement.signerName,
            signerEmail: signedAgreement.signerEmail,
            signedAt: signedAgreement.signedAt.toISOString(),
            signatureImage: signedAgreement.signatureImage,
            agreementVersion: signedAgreement.agreementVersion,
            agreementHtmlSnapshot: signedAgreement.agreementHtmlSnapshot,
            acknowledgedClauses: Array.isArray(
              signedAgreement.acknowledgedClauses
            )
              ? signedAgreement.acknowledgedClauses.filter(
                  (clause): clause is number => typeof clause === "number"
                )
              : [],
            confirmationAccepted: signedAgreement.confirmationAccepted,
          }
        : null,
    };

    await sendBookingConfirmationEmail({
      to: emailToSend,
      bookingRef: booking.bookingRef,
      emailData,
      theme: process.env.BOOKING_EMAIL_THEME,
      agreementAttachment: signedAgreement
        ? createStoredAgreementAttachment({
            filename: signedAgreement.pdfFileName,
            content: signedAgreement.pdfContent,
          })
        : null,
    });

    if (!requestedToEmail || requestedToEmail === booking.contactEmail) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { confirmationEmailSent: true },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        sentTo: emailToSend,
      },
    });
  } catch (error) {
    console.error("ADMIN_RESEND_BOOKING_EMAIL_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Failed to resend confirmation email." },
      { status: 500 }
    );
  }
}
