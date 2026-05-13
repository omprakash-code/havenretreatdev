import crypto from "crypto";
import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getRequiredAdvancePaymentAmount } from "@/lib/advance-payment";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import { timingSafeEqualString } from "@/lib/security/timingSafeEqual";
import {
  buildBookingCouponContext,
  findInvalidReservedBookingCoupon,
} from "@/services/coupon/booking-coupon.service";
import {
  CouponRejectionReason,
} from "@/services/coupon/coupon.types";
import { createSuccessToken } from "@/services/booking/successToken.server";
import { sendBookingConfirmationWhatsApp } from "@/services/whatsapp.service";
import { sendBookingConfirmationEmail } from "@/services/booking/booking-confirmation-email.service";
import { sendAdminBookingConfirmationEmail } from "@/services/booking/admin-booking-confirmation-email.service";
import {
  sendPaymentCapturedBookingFailedNotifications,
  type PaymentCapturedBookingFailedNotificationData,
} from "@/services/booking/payment-captured-booking-failed-email.service";
import {
  type BookingConfirmationAddonItem,
  type BookingConfirmationDetail,
  type BookingConfirmationEmailProps,
} from "@/emails/BookingConfirmationEmail";
import { isNumberDecorationProduct } from "@/lib/product-numbering";
import {
  isStrictLockExpired,
  releaseSiblingSessionLocks,
} from "@/services/booking/booking-lock-lifecycle.service";
import { notifyAbandonedBookingsByIds } from "@/services/booking/booking-abandonment-email.service";
import {
  PAYMENT_CAPTURED_FAILURE_MODAL_MESSAGE,
  PAYMENT_CAPTURED_FAILURE_MODAL_TITLE,
  PAYMENT_CAPTURED_SESSION_EXPIRED_REASON,
  PAYMENT_CAPTURED_SLOT_UNAVAILABLE_REASON,
  humanizePaymentCaptureFailureReason,
  isPaymentCapturedBookingFailure,
} from "@/lib/payment-capture-failure";
import { sendMetaCapiEvent, getClientIpAddress } from "@/lib/meta/server";
import { buildMetaPurchaseEventId } from "@/lib/meta/shared";

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

class ApiError extends Error {
  status: number;
  code: string;
  extra?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    extra?: Record<string, unknown>
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

type VerifyPayload = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  bookingId?: string;
};

type ConfirmationEmailData = BookingConfirmationEmailProps & {
  customerName: string;
  customerPhone: string;
  locationName: string;
};

type VerifyResult = {
  bookingRef: string;
  successToken: string;
  email: string | null;
  emailData: ConfirmationEmailData | null;
  autoReleasedBookingIds: string[];
  paymentFailureCode?: "SESSION_EXPIRED" | "SLOT_ALREADY_BOOKED";
  paymentFailureReason?: string;
  paymentFailureNotification?: PaymentCapturedBookingFailedNotificationData;
};

function buildEmailData(input: {
  bookingRef: string;
  successToken: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  locationName: string | null;
  theatreName: string;
  slotDate: Date;
  slotStartTime: string;
  slotEndTime: string;
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
    date: formatInTimeZone(input.slotDate, IST_TIMEZONE, "EEE, dd MMM yyyy"),
    timeSlot: `${input.slotStartTime} - ${input.slotEndTime}`,
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
    successUrl: resolvedBaseUrl
      ? `${resolvedBaseUrl}/booking/success?t=${encodeURIComponent(
          input.successToken
        )}`
      : `/booking/success?t=${encodeURIComponent(input.successToken)}`,
  };

  return data;
}

function resolveRestartBookingUrl() {
  return resolvedBaseUrl ? `${resolvedBaseUrl}/booking` : "/booking";
}

function createPaymentCapturedFailureApiError(input: {
  code: "SESSION_EXPIRED" | "SLOT_ALREADY_BOOKED";
  reason: string;
  bookingRef: string;
}) {
  return new ApiError(409, input.code, PAYMENT_CAPTURED_FAILURE_MODAL_MESSAGE, {
    title: PAYMENT_CAPTURED_FAILURE_MODAL_TITLE,
    paymentCaptured: true,
    bookingRef: input.bookingRef,
    cancelledReason: input.reason,
  });
}

function runInBackground(
  errorLabel: string,
  work: () => Promise<void>
) {
  void work().catch((error) => {
    console.error(errorLabel, error);
  });
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

function isPayableBookingStatus(status: string) {
  return status === "AWAITING_PAYMENT" || status === "PAYMENT_PROCESSING";
}

function couponRejectionReasonToMessage(reason: CouponRejectionReason): string {
  switch (reason) {
    case CouponRejectionReason.COUPON_INACTIVE:
      return "Coupon is inactive.";
    case CouponRejectionReason.OUTSIDE_VALIDITY:
      return "Coupon is outside validity.";
    case CouponRejectionReason.USAGE_LIMIT_EXCEEDED:
      return "This coupon has reached its usage limit.";
    case CouponRejectionReason.PER_USER_LIMIT_EXCEEDED:
      return "You’ve reached the usage limit for this coupon.";
    case CouponRejectionReason.RULE_NOT_SATISFIED:
      return "Coupon rules are no longer satisfied.";
    case CouponRejectionReason.MINIMUM_AMOUNT_NOT_MET:
      return "Minimum amount requirement is not met.";
    case CouponRejectionReason.MINIMUM_PAYABLE_VIOLATION:
      return "Minimum payable requirement is not met.";
    default:
      return "Coupon is no longer valid.";
  }
}

async function finalizePaymentCapturedBookingFailure(input: {
  bookingId: string;
  bookingRef: string;
  slotId: string;
  bookingSnapshot: {
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    guestCount: number;
    occasionLabel: string | null;
    occasionData: Prisma.JsonValue | null;
    items: Array<{
      productName: string;
      variantLabel: string;
      quantity: number;
      totalPrice: number;
    }>;
    totalAmount: number;
    advancePaid: number;
    theatre: {
      name: string;
      locationId: string;
    };
    slot: {
      date: Date;
      startTime: string;
      endTime: string;
      status: string;
    } | null;
  };
  paymentAttemptId: string;
  paymentAmount: number;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  reason:
    | typeof PAYMENT_CAPTURED_SESSION_EXPIRED_REASON
    | typeof PAYMENT_CAPTURED_SLOT_UNAVAILABLE_REASON;
  code: "SESSION_EXPIRED" | "SLOT_ALREADY_BOOKED";
}) {
  const paidAmount =
    input.bookingSnapshot.advancePaid && input.bookingSnapshot.advancePaid > 0
      ? input.bookingSnapshot.advancePaid
      : input.paymentAmount;

  await prisma.$transaction(async (tx) => {
    if (input.bookingSnapshot.slot?.status === "LOCKED") {
      await tx.slot.updateMany({
        where: {
          id: input.slotId,
          status: "LOCKED",
        },
        data: {
          status: "AVAILABLE",
          lockedAt: null,
          lockExpiresAt: null,
          lockedBy: null,
        },
      });
    }

    await tx.booking.update({
      where: { id: input.bookingId },
      data: {
        bookingStatus: "PAID_EXPIRED",
        paymentStatus: "PAID",
        cancelledReason: input.reason,
        cancelledAt: new Date(),
        advancePaid: paidAmount,
        remainingPayable: Math.max(input.bookingSnapshot.totalAmount - paidAmount, 0),
        razorpayPaymentId: input.razorpayPaymentId,
        razorpayOrderId: input.razorpayOrderId,
        razorpaySignature: input.razorpaySignature,
      },
    });

    await tx.payment.update({
      where: { id: input.paymentAttemptId },
      data: {
        status: "PAID",
        transactionId: input.razorpayPaymentId,
      },
    });
  });

  runInBackground(
    "PAYMENT_CAPTURED_BOOKING_FAILED_NOTIFICATION_ERROR",
    async () => {
      const location = await prisma.location.findUnique({
        where: { id: input.bookingSnapshot.theatre.locationId },
        select: { name: true },
      });

      await sendPaymentCapturedBookingFailedNotifications({
        bookingRef: input.bookingRef,
        customerName: input.bookingSnapshot.contactName,
        customerPhone: input.bookingSnapshot.contactPhone,
        customerEmail: input.bookingSnapshot.contactEmail,
        theatreName: input.bookingSnapshot.theatre.name,
        locationName: location?.name ?? null,
        date: input.bookingSnapshot.slot
          ? formatInTimeZone(
              input.bookingSnapshot.slot.date,
              IST_TIMEZONE,
              "EEE, dd MMM yyyy"
            )
          : "-",
        timeSlot: input.bookingSnapshot.slot
          ? `${input.bookingSnapshot.slot.startTime} - ${input.bookingSnapshot.slot.endTime}`
          : "-",
        guestCount: input.bookingSnapshot.guestCount,
        occasionLabel: input.bookingSnapshot.occasionLabel,
        occasionDetails: buildOccasionDetails(input.bookingSnapshot.occasionData),
        addonItems: buildAddonItemsWithNumberValues(
          input.bookingSnapshot.items,
          input.bookingSnapshot.occasionData
        ),
        amountPaid: paidAmount,
        paymentReference: input.razorpayPaymentId,
        failureReason: humanizePaymentCaptureFailureReason(input.reason),
        restartUrl: resolveRestartBookingUrl(),
      });
    }
  );

  return bookingErrorResponse(
    409,
    input.code,
    PAYMENT_CAPTURED_FAILURE_MODAL_MESSAGE,
    {
      title: PAYMENT_CAPTURED_FAILURE_MODAL_TITLE,
      paymentCaptured: true,
      bookingRef: input.bookingRef,
      cancelledReason: input.reason,
    }
  );
}

export async function POST(req: Request) {
  try {
    const payload = (await req
      .json()
      .catch(() => null)) as VerifyPayload | null;

    const razorpay_order_id = payload?.razorpay_order_id;
    const razorpay_payment_id = payload?.razorpay_payment_id;
    const razorpay_signature = payload?.razorpay_signature;
    const bookingId = payload?.bookingId;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !bookingId
    ) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        "Missing payment details."
      );
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (!timingSafeEqualString(expectedSignature, razorpay_signature)) {
      return bookingErrorResponse(
        403,
        "UNAUTHORIZED",
        "Invalid payment signature."
      );
    }

    const bookingSnapshot = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        slot: true,
        theatre: true,
        items: {
          select: {
            productName: true,
            variantLabel: true,
            quantity: true,
            totalPrice: true,
          },
        },
        user: true,
      },
    });

    if (!bookingSnapshot) {
      return bookingErrorResponse(
        404,
        "BOOKING_NOT_FOUND",
        "Booking not found."
      );
    }

    const paymentAmount =
      bookingSnapshot.advancePaid && bookingSnapshot.advancePaid > 0
        ? bookingSnapshot.advancePaid
        : await getRequiredAdvancePaymentAmount(prisma);

    // Persist ledger entry before branching into business decisions.
    const paymentAttempt = await prisma.payment.create({
      data: {
        bookingId,
        provider: "RAZORPAY",
        transactionId: razorpay_payment_id,
        method: "ONLINE",
        amount: paymentAmount,
        status: "INITIALIZED",
      },
    });

    let paymentMarkedPaid = false;

    const markAttemptFailed = async () => {
      if (paymentMarkedPaid) return;
      try {
        await prisma.payment.update({
          where: { id: paymentAttempt.id },
          data: { status: "FAILED" },
        });
      } catch (updateError) {
        console.error(
          "PAYMENT_ATTEMPT_FAIL_STATUS_UPDATE_ERROR",
          updateError
        );
      }
    };

    try {
      if (!bookingSnapshot.slot) {
        const response = await finalizePaymentCapturedBookingFailure({
          bookingId: bookingSnapshot.id,
          bookingRef: bookingSnapshot.bookingRef,
          slotId: bookingSnapshot.slotId,
          bookingSnapshot: {
            contactName: bookingSnapshot.contactName,
            contactPhone: bookingSnapshot.contactPhone,
            contactEmail: bookingSnapshot.contactEmail,
            guestCount: bookingSnapshot.guestCount,
            occasionLabel: bookingSnapshot.occasionLabel,
            occasionData: bookingSnapshot.occasionData as Prisma.JsonValue | null,
            items: bookingSnapshot.items,
            totalAmount: bookingSnapshot.totalAmount,
            advancePaid: bookingSnapshot.advancePaid,
            theatre: {
              name: bookingSnapshot.theatre.name,
              locationId: bookingSnapshot.theatre.locationId,
            },
            slot: null,
          },
          paymentAttemptId: paymentAttempt.id,
          paymentAmount,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          reason: PAYMENT_CAPTURED_SLOT_UNAVAILABLE_REASON,
          code: "SLOT_ALREADY_BOOKED",
        });
        paymentMarkedPaid = true;
        return response;
      }

      if (isStrictLockExpired(bookingSnapshot, new Date())) {
        const response = await finalizePaymentCapturedBookingFailure({
          bookingId: bookingSnapshot.id,
          bookingRef: bookingSnapshot.bookingRef,
          slotId: bookingSnapshot.slotId,
          bookingSnapshot: {
            contactName: bookingSnapshot.contactName,
            contactPhone: bookingSnapshot.contactPhone,
            contactEmail: bookingSnapshot.contactEmail,
            guestCount: bookingSnapshot.guestCount,
            occasionLabel: bookingSnapshot.occasionLabel,
            occasionData: bookingSnapshot.occasionData as Prisma.JsonValue | null,
            items: bookingSnapshot.items,
            totalAmount: bookingSnapshot.totalAmount,
            advancePaid: bookingSnapshot.advancePaid,
            theatre: {
              name: bookingSnapshot.theatre.name,
              locationId: bookingSnapshot.theatre.locationId,
            },
            slot: {
              date: bookingSnapshot.slot.date,
              startTime: bookingSnapshot.slot.startTime,
              endTime: bookingSnapshot.slot.endTime,
              status: bookingSnapshot.slot.status,
            },
          },
          paymentAttemptId: paymentAttempt.id,
          paymentAmount,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          reason: PAYMENT_CAPTURED_SESSION_EXPIRED_REASON,
          code: "SESSION_EXPIRED",
        });
        paymentMarkedPaid = true;
        return response;
      }

      if (
        isPaymentCapturedBookingFailure({
          bookingStatus: bookingSnapshot.bookingStatus,
          paymentStatus: bookingSnapshot.paymentStatus,
          cancelledReason: bookingSnapshot.cancelledReason,
        }) &&
        bookingSnapshot.razorpayPaymentId === razorpay_payment_id
      ) {
        await prisma.payment.update({
          where: { id: paymentAttempt.id },
          data: { status: "PAID" },
        });
        paymentMarkedPaid = true;

        throw createPaymentCapturedFailureApiError({
          code:
            bookingSnapshot.cancelledReason ===
            PAYMENT_CAPTURED_SLOT_UNAVAILABLE_REASON
              ? "SLOT_ALREADY_BOOKED"
              : "SESSION_EXPIRED",
          reason: bookingSnapshot.cancelledReason ?? PAYMENT_CAPTURED_SESSION_EXPIRED_REASON,
          bookingRef: bookingSnapshot.bookingRef,
        });
      }

      if (
        bookingSnapshot.bookingStatus === "CONFIRMED" &&
        bookingSnapshot.paymentStatus === "PAID"
      ) {
        const location = await prisma.location.findUnique({
          where: { id: bookingSnapshot.theatre.locationId },
        });

        if (
          bookingSnapshot.razorpayPaymentId &&
          bookingSnapshot.razorpayPaymentId === razorpay_payment_id
        ) {
          const successToken = createSuccessToken(
            bookingSnapshot.id,
            bookingSnapshot.bookingRef
          );
          await prisma.payment.update({
            where: { id: paymentAttempt.id },
            data: { status: "PAID" },
          });
          paymentMarkedPaid = true;

          const idempotentResponse = NextResponse.json({
            success: true,
            bookingRef: bookingSnapshot.bookingRef,
            successToken,
          });

          idempotentResponse.cookies.set("ds_booking_session", "", {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge: 0,
          });
          idempotentResponse.cookies.set("ds_lock_owner", "", {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge: 0,
          });

          return idempotentResponse;
        }

        throw new ApiError(
          409,
          "DUPLICATE_PAYMENT_ATTEMPT",
          "This booking was already paid. If amount was deducted, it will be refunded automatically.",
          {
            bookingRef: bookingSnapshot.bookingRef,
            successToken: createSuccessToken(
              bookingSnapshot.id,
              bookingSnapshot.bookingRef
            ),
            locationName: location?.name,
          }
        );
      }

      const verifyResult = await prisma.$transaction(async (tx) => {
        // Serialize payment verification per booking to prevent race conditions
        // (double stock decrement / duplicate finalization) on concurrent callbacks.
        await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT id
          FROM "Booking"
          WHERE id = ${bookingId}
          FOR UPDATE
        `);

        const existing = await tx.booking.findUnique({
          where: { id: bookingId },
          include: {
            slot: true,
            theatre: true,
            user: true,
          },
        });

        if (!existing) {
          throw new ApiError(
            404,
            "BOOKING_NOT_FOUND",
            "Booking not found."
          );
        }

        if (!existing.slot) {
          const fallbackLocation = await tx.location.findUnique({
            where: { id: existing.theatre.locationId },
          });
          const paidAmount =
            existing.advancePaid && existing.advancePaid > 0
              ? existing.advancePaid
              : paymentAmount;

          const updatedBooking = await tx.booking.update({
            where: { id: existing.id },
            data: {
              bookingStatus: "PAID_EXPIRED",
              paymentStatus: "PAID",
              cancelledReason: PAYMENT_CAPTURED_SLOT_UNAVAILABLE_REASON,
              cancelledAt: new Date(),
              advancePaid: paidAmount,
              remainingPayable: Math.max(existing.totalAmount - paidAmount, 0),
              razorpayPaymentId: razorpay_payment_id,
              razorpayOrderId: razorpay_order_id,
              razorpaySignature: razorpay_signature,
            },
          });

          await tx.payment.update({
            where: { id: paymentAttempt.id },
            data: {
              status: "PAID",
              transactionId: razorpay_payment_id,
            },
          });
          paymentMarkedPaid = true;

          return {
            bookingRef: updatedBooking.bookingRef,
            successToken: "",
            email: null,
            emailData: null,
            autoReleasedBookingIds: [],
            paymentFailureCode: "SLOT_ALREADY_BOOKED",
            paymentFailureReason: PAYMENT_CAPTURED_SLOT_UNAVAILABLE_REASON,
            paymentFailureNotification: {
              bookingRef: updatedBooking.bookingRef,
              customerName: existing.contactName,
              customerPhone: existing.contactPhone,
              customerEmail: existing.contactEmail,
              theatreName: existing.theatre.name,
              locationName: fallbackLocation?.name ?? null,
              date: bookingSnapshot.slot
                ? formatInTimeZone(bookingSnapshot.slot.date, IST_TIMEZONE, "EEE, dd MMM yyyy")
                : "-",
              timeSlot: bookingSnapshot.slot
                ? `${bookingSnapshot.slot.startTime} - ${bookingSnapshot.slot.endTime}`
                : "-",
              guestCount: existing.guestCount,
              amountPaid: paidAmount,
              paymentReference: razorpay_payment_id,
              failureReason: humanizePaymentCaptureFailureReason(
                PAYMENT_CAPTURED_SLOT_UNAVAILABLE_REASON
              ),
              restartUrl: resolveRestartBookingUrl(),
            },
          } satisfies VerifyResult;
        }

        const location = await tx.location.findUnique({
          where: { id: existing.theatre.locationId },
        });

        if (isStrictLockExpired(existing, new Date())) {
          await tx.slot.update({
            where: { id: existing.slotId },
            data: {
              status: "AVAILABLE",
              lockedAt: null,
              lockExpiresAt: null,
              lockedBy: null,
            },
          });

          const paidAmount =
            existing.advancePaid && existing.advancePaid > 0
              ? existing.advancePaid
              : paymentAmount;

          const updatedBooking = await tx.booking.update({
            where: { id: existing.id },
            data: {
              bookingStatus: "PAID_EXPIRED",
              paymentStatus: "PAID",
              cancelledReason: PAYMENT_CAPTURED_SESSION_EXPIRED_REASON,
              cancelledAt: new Date(),
              advancePaid: paidAmount,
              remainingPayable: Math.max(existing.totalAmount - paidAmount, 0),
              razorpayPaymentId: razorpay_payment_id,
              razorpayOrderId: razorpay_order_id,
              razorpaySignature: razorpay_signature,
            },
          });

          await tx.payment.update({
            where: { id: paymentAttempt.id },
            data: {
              status: "PAID",
              transactionId: razorpay_payment_id,
            },
          });
          paymentMarkedPaid = true;

          return {
            bookingRef: updatedBooking.bookingRef,
            successToken: "",
            email: null,
            emailData: null,
            autoReleasedBookingIds: [],
            paymentFailureCode: "SESSION_EXPIRED",
            paymentFailureReason: PAYMENT_CAPTURED_SESSION_EXPIRED_REASON,
            paymentFailureNotification: {
              bookingRef: updatedBooking.bookingRef,
              customerName: existing.contactName,
              customerPhone: existing.contactPhone,
              customerEmail: existing.contactEmail,
              theatreName: existing.theatre.name,
              locationName: location?.name ?? null,
              date: formatInTimeZone(existing.slot.date, IST_TIMEZONE, "EEE, dd MMM yyyy"),
              timeSlot: `${existing.slot.startTime} - ${existing.slot.endTime}`,
              guestCount: existing.guestCount,
              amountPaid: paidAmount,
              paymentReference: razorpay_payment_id,
              failureReason: humanizePaymentCaptureFailureReason(
                PAYMENT_CAPTURED_SESSION_EXPIRED_REASON
              ),
              restartUrl: resolveRestartBookingUrl(),
            },
          } satisfies VerifyResult;
        }

        const bookingItems = await tx.bookingItem.findMany({
          where: { bookingId: existing.id },
          select: {
            productId: true,
            variantId: true,
            category: true,
            quantity: true,
            totalPrice: true,
            productName: true,
            variantLabel: true,
          },
        });
        const addonItems = buildAddonItemsWithNumberValues(
          bookingItems,
          existing.occasionData as Prisma.JsonValue | null
        );

        if (
          existing.bookingStatus === "CONFIRMED" &&
          existing.paymentStatus === "PAID"
        ) {
          if (
            existing.razorpayPaymentId &&
            existing.razorpayPaymentId === razorpay_payment_id
          ) {
            await tx.payment.update({
              where: { id: paymentAttempt.id },
              data: { status: "PAID" },
            });
            paymentMarkedPaid = true;

            const successToken = createSuccessToken(
              existing.id,
              existing.bookingRef
            );
            return {
              bookingRef: existing.bookingRef,
              successToken,
              email: existing.confirmationEmailSent
                ? null
                : existing.contactEmail ?? null,
              emailData: existing.confirmationEmailSent
                ? null
                : buildEmailData({
                    bookingRef: existing.bookingRef,
                    successToken,
                    contactName: existing.contactName,
                    contactPhone: existing.contactPhone,
                    contactEmail: existing.contactEmail,
                    locationName: location?.name ?? null,
                    theatreName: existing.theatre.name,
                    slotDate: existing.slot.date,
                    slotStartTime: existing.slot.startTime,
                    slotEndTime: existing.slot.endTime,
                    guestCount: existing.guestCount,
                    occasionLabel: existing.occasionLabel,
                    occasionData: existing.occasionData as Prisma.JsonValue | null,
                    addonItems,
                    paymentType: "ONLINE",
                    paymentMethod: "RAZORPAY",
                    paymentStatus: existing.paymentStatus ?? "PAID",
                    paymentReference:
                      existing.razorpayPaymentId ?? razorpay_payment_id ?? null,
                    baseAmount: existing.baseAmount,
                    extrasAmount: existing.extrasAmount,
                    productsAmount: existing.productsAmount,
                    decorationAmount: existing.decorationAmount,
                    discountAmount: existing.discountAmount,
                    totalAmount: existing.totalAmount,
                    advancePaid: existing.advancePaid,
                    remainingPayable: existing.remainingPayable,
                  }),
              autoReleasedBookingIds: [],
            } satisfies VerifyResult;
          }

          throw new ApiError(
            409,
            "DUPLICATE_PAYMENT_ATTEMPT",
            "This booking was already paid. If amount was deducted, it will be refunded automatically.",
            {
              bookingRef: existing.bookingRef,
              successToken: createSuccessToken(
                existing.id,
                existing.bookingRef
              ),
            }
          );
        }

        if (
          existing.razorpayOrderId &&
          existing.razorpayOrderId !== razorpay_order_id
        ) {
          throw new ApiError(
            403,
            "UNAUTHORIZED",
            "Payment order does not match this booking."
          );
        }

        if (
          existing.slot.status === "BOOKED" &&
          existing.bookingStatus !== "CONFIRMED"
        ) {
          const paidAmount =
            existing.advancePaid && existing.advancePaid > 0
              ? existing.advancePaid
              : paymentAmount;

          const updatedBooking = await tx.booking.update({
            where: { id: existing.id },
            data: {
              bookingStatus: "PAID_EXPIRED",
              paymentStatus: "PAID",
              cancelledReason: PAYMENT_CAPTURED_SLOT_UNAVAILABLE_REASON,
              cancelledAt: new Date(),
              advancePaid: paidAmount,
              remainingPayable: Math.max(existing.totalAmount - paidAmount, 0),
              razorpayPaymentId: razorpay_payment_id,
              razorpayOrderId: razorpay_order_id,
              razorpaySignature: razorpay_signature,
            },
          });

          await tx.payment.update({
            where: { id: paymentAttempt.id },
            data: {
              status: "PAID",
              transactionId: razorpay_payment_id,
            },
          });
          paymentMarkedPaid = true;

          return {
            bookingRef: updatedBooking.bookingRef,
            successToken: "",
            email: null,
            emailData: null,
            autoReleasedBookingIds: [],
            paymentFailureCode: "SLOT_ALREADY_BOOKED",
            paymentFailureReason: PAYMENT_CAPTURED_SLOT_UNAVAILABLE_REASON,
            paymentFailureNotification: {
              bookingRef: updatedBooking.bookingRef,
              customerName: existing.contactName,
              customerPhone: existing.contactPhone,
              customerEmail: existing.contactEmail,
              theatreName: existing.theatre.name,
              locationName: location?.name ?? null,
              date: formatInTimeZone(existing.slot.date, IST_TIMEZONE, "EEE, dd MMM yyyy"),
              timeSlot: `${existing.slot.startTime} - ${existing.slot.endTime}`,
              guestCount: existing.guestCount,
              amountPaid: paidAmount,
              paymentReference: razorpay_payment_id,
              failureReason: humanizePaymentCaptureFailureReason(
                PAYMENT_CAPTURED_SLOT_UNAVAILABLE_REASON
              ),
              restartUrl: resolveRestartBookingUrl(),
            },
          } satisfies VerifyResult;
        }

        if (existing.slot.status !== "LOCKED") {
          const paidAmount =
            existing.advancePaid && existing.advancePaid > 0
              ? existing.advancePaid
              : paymentAmount;

          const updatedBooking = await tx.booking.update({
            where: { id: existing.id },
            data: {
              bookingStatus: "PAID_EXPIRED",
              paymentStatus: "PAID",
              cancelledReason: PAYMENT_CAPTURED_SLOT_UNAVAILABLE_REASON,
              cancelledAt: new Date(),
              advancePaid: paidAmount,
              remainingPayable: Math.max(existing.totalAmount - paidAmount, 0),
              razorpayPaymentId: razorpay_payment_id,
              razorpayOrderId: razorpay_order_id,
              razorpaySignature: razorpay_signature,
            },
          });

          await tx.payment.update({
            where: { id: paymentAttempt.id },
            data: {
              status: "PAID",
              transactionId: razorpay_payment_id,
            },
          });
          paymentMarkedPaid = true;

          return {
            bookingRef: updatedBooking.bookingRef,
            successToken: "",
            email: null,
            emailData: null,
            autoReleasedBookingIds: [],
            paymentFailureCode: "SLOT_ALREADY_BOOKED",
            paymentFailureReason: PAYMENT_CAPTURED_SLOT_UNAVAILABLE_REASON,
            paymentFailureNotification: {
              bookingRef: updatedBooking.bookingRef,
              customerName: existing.contactName,
              customerPhone: existing.contactPhone,
              customerEmail: existing.contactEmail,
              theatreName: existing.theatre.name,
              locationName: location?.name ?? null,
              date: formatInTimeZone(existing.slot.date, IST_TIMEZONE, "EEE, dd MMM yyyy"),
              timeSlot: `${existing.slot.startTime} - ${existing.slot.endTime}`,
              guestCount: existing.guestCount,
              amountPaid: paidAmount,
              paymentReference: razorpay_payment_id,
              failureReason: humanizePaymentCaptureFailureReason(
                PAYMENT_CAPTURED_SLOT_UNAVAILABLE_REASON
              ),
              restartUrl: resolveRestartBookingUrl(),
            },
          } satisfies VerifyResult;
        }

        if (!isPayableBookingStatus(existing.bookingStatus)) {
          throw new ApiError(
            409,
            "PAYMENT_ALREADY_PROCESSED",
            "This payment is already processed for the booking.",
            { bookingRef: existing.bookingRef }
          );
        }

        if (bookingItems.length > 0) {
          const variantIds = [...new Set(bookingItems.map((item) => item.variantId))];
          const variants = await tx.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: {
              id: true,
              stock: true,
              product: {
                select: {
                  name: true,
                },
              },
            },
          });

          const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

          for (const item of bookingItems) {
            const variant = variantMap.get(item.variantId);
            if (!variant) {
              throw new ApiError(
                409,
                "PRODUCT_UNAVAILABLE",
                `${item.productName} is no longer available for booking.`
              );
            }

            const decremented = await tx.productVariant.updateMany({
              where: {
                id: variant.id,
                stock: {
                  gte: item.quantity,
                },
              },
              data: {
                stock: {
                  decrement: item.quantity,
                },
              },
            });

            if (decremented.count === 0) {
              throw new ApiError(
                409,
                "PRODUCT_OUT_OF_STOCK",
                `${variant.product.name} is out of stock. Please update your add-ons and try again.`
              );
            }
          }
        }

        const productsTotal = bookingItems.reduce(
          (sum, item) => sum + Math.max(Number(item.totalPrice ?? 0), 0),
          0
        );
        const slotAmount = existing.baseAmount;
        const nonSlotAmount =
          existing.extrasAmount +
          existing.decorationAmount +
          productsTotal;
        const couponContext = buildBookingCouponContext({
          slot: {
            id: existing.slot.id,
            date: existing.slot.date,
            startTime: existing.slot.startTime,
            endTime: existing.slot.endTime,
            durationMin: existing.slot.durationMin,
          },
          theatreId: existing.theatreId,
          locationId: existing.theatre.locationId,
          userId: existing.userId,
          contactPhone: existing.contactPhone,
          decorationRequired: existing.decorationRequired,
          items: bookingItems.map((item) => ({
            itemKey: item.variantId,
            productId: item.productId,
            category: item.category,
            totalPrice: item.totalPrice,
          })),
          slotAmount,
          nonSlotAmount,
          productsTotal,
          extrasTotal: existing.extrasAmount,
        });
        const invalidReservedCoupon = await findInvalidReservedBookingCoupon({
          tx,
          bookingId: existing.id,
          context: couponContext,
          resolvedUserId: existing.userId ?? null,
        });

        if (invalidReservedCoupon) {
          throw new ApiError(
            409,
            "COUPON_NOT_APPLICABLE",
            `${invalidReservedCoupon.code} can no longer be confirmed. ${couponRejectionReasonToMessage(
              invalidReservedCoupon.reason
            )}`
          );
        }

        const lockedAdvance =
          existing.advancePaid && existing.advancePaid > 0
            ? existing.advancePaid
            : await getRequiredAdvancePaymentAmount(tx);
        const confirmedLockOwner = existing.slot.lockedBy;
        let autoReleasedBookingIds: string[] = [];

        const updatedBooking = await tx.booking.update({
          where: { id: bookingId },
          data: {
            paymentStatus: "PAID",
            bookingStatus: "CONFIRMED",
            razorpayPaymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            razorpaySignature: razorpay_signature,
            advancePaid: lockedAdvance,
            remainingPayable: Math.max(existing.totalAmount - lockedAdvance, 0),
          },
        });

        await tx.slot.update({
          where: { id: existing.slotId },
          data: {
            status: "BOOKED",
            lockedAt: null,
            lockExpiresAt: null,
            lockedBy: null,
          },
        });

        // Release any other slots still locked by the same owner after successful confirmation.
        if (confirmedLockOwner) {
          const siblingReleaseResult = await releaseSiblingSessionLocks(tx, {
            lockOwner: confirmedLockOwner,
            keepSlotId: existing.slotId,
            now: new Date(),
            cancelledReason: "AUTO_RELEASED_AFTER_CONFIRMATION",
          });
          autoReleasedBookingIds = siblingReleaseResult.releasedBookingIds;
        }

        await tx.couponUsage.updateMany({
          where: {
            bookingId,
            status: "RESERVED",
          },
          data: {
            status: "CONFIRMED",
            confirmedAt: new Date(),
          },
        });

        await tx.payment.update({
          where: { id: paymentAttempt.id },
          data: { status: "PAID" },
        });
        paymentMarkedPaid = true;

        const successToken = createSuccessToken(
          updatedBooking.id,
          updatedBooking.bookingRef
        );
        return {
          bookingRef: updatedBooking.bookingRef,
          successToken,
          email: existing.contactEmail ?? null,
          emailData: buildEmailData({
            bookingRef: updatedBooking.bookingRef,
            successToken,
            contactName: existing.contactName,
            contactPhone: existing.contactPhone,
            contactEmail: existing.contactEmail,
            locationName: location?.name ?? null,
            theatreName: existing.theatre.name,
            slotDate: existing.slot.date,
            slotStartTime: existing.slot.startTime,
            slotEndTime: existing.slot.endTime,
            guestCount: updatedBooking.guestCount,
            occasionLabel: existing.occasionLabel,
            occasionData: existing.occasionData as Prisma.JsonValue | null,
            addonItems,
            paymentType: "ONLINE",
            paymentMethod: "RAZORPAY",
            paymentStatus: updatedBooking.paymentStatus ?? "PAID",
            paymentReference: razorpay_payment_id,
            baseAmount: updatedBooking.baseAmount,
            extrasAmount: updatedBooking.extrasAmount,
            productsAmount: updatedBooking.productsAmount,
            decorationAmount: updatedBooking.decorationAmount,
            discountAmount: updatedBooking.discountAmount,
            totalAmount: updatedBooking.totalAmount,
            advancePaid: updatedBooking.advancePaid,
            remainingPayable: updatedBooking.remainingPayable,
          }),
          autoReleasedBookingIds,
        } satisfies VerifyResult;
      });

      if (
        verifyResult.paymentFailureCode &&
        verifyResult.paymentFailureReason &&
        verifyResult.paymentFailureNotification
      ) {
        runInBackground(
          "PAYMENT_CAPTURED_BOOKING_FAILED_NOTIFICATION_ERROR",
          async () => {
            await sendPaymentCapturedBookingFailedNotifications(
              verifyResult.paymentFailureNotification
            );
          }
        );

        return bookingErrorResponse(
          409,
          verifyResult.paymentFailureCode,
          PAYMENT_CAPTURED_FAILURE_MODAL_MESSAGE,
          {
            title: PAYMENT_CAPTURED_FAILURE_MODAL_TITLE,
            paymentCaptured: true,
            bookingRef: verifyResult.bookingRef,
            cancelledReason: verifyResult.paymentFailureReason,
          }
        );
      }

      const emailData = verifyResult.emailData;
      if (emailData) {
        runInBackground("META_PURCHASE_EVENT_FAILED", async () => {
          const metaResult = await sendMetaCapiEvent({
            eventName: "Purchase",
            eventId: buildMetaPurchaseEventId({
              bookingRef: verifyResult.bookingRef,
              paymentReference: emailData.paymentReference,
            }),
            eventSourceUrl:
              emailData.successUrl ||
              `/booking/success?t=${encodeURIComponent(verifyResult.successToken)}`,
            customData: {
              currency: "INR",
              value: emailData.totalAmount,
              advance_paid_value: emailData.advancePaid,
              total_booking_value: emailData.totalAmount,
              order_id: verifyResult.bookingRef,
              content_name: "Haven Retreat Booking",
              content_category: "event_venue",
              payment_method: "razorpay",
            },
            cookieHeader: req.headers.get("cookie"),
            clientIpAddress: getClientIpAddress(req.headers),
            clientUserAgent: req.headers.get("user-agent"),
            email: emailData.customerEmail ?? verifyResult.email,
            phone: emailData.customerPhone,
            externalId: verifyResult.bookingRef,
          });

          if (!metaResult.sent) {
            console.warn("META_PURCHASE_EVENT_SKIPPED", metaResult);
          }
        });
      }

      runInBackground(
        "RAZORPAY_VERIFY_POST_CONFIRMATION_SIDE_EFFECTS_FAILED",
        async () => {
          await Promise.allSettled([
            (async () => {
              if (!verifyResult.email || !verifyResult.emailData) return;
              try {
                await sendBookingConfirmationEmail({
                  to: verifyResult.email,
                  bookingRef: verifyResult.bookingRef,
                  emailData: verifyResult.emailData,
                  theme: process.env.BOOKING_EMAIL_THEME,
                });

                await prisma.booking.update({
                  where: { bookingRef: verifyResult.bookingRef },
                  data: { confirmationEmailSent: true },
                });
              } catch (emailError) {
                console.error(
                  "BOOKING_CONFIRMATION_EMAIL_FAILED",
                  emailError
                );
              }
            })(),
            (async () => {
              if (!verifyResult.emailData) return;
              try {
                await sendAdminBookingConfirmationEmail({
                  bookingRef: verifyResult.bookingRef,
                  emailData: verifyResult.emailData,
                  confirmationSource: "ONLINE_PAYMENT_VERIFY",
                });
              } catch (adminEmailError) {
                console.error(
                  "ADMIN_BOOKING_CONFIRMATION_EMAIL_FAILED",
                  adminEmailError
                );
              }
            })(),
            (async () => {
              if (verifyResult.autoReleasedBookingIds.length === 0) return;
              try {
                await notifyAbandonedBookingsByIds(
                  verifyResult.autoReleasedBookingIds
                );
              } catch (notifyError) {
                console.error(
                  "RAZORPAY_VERIFY_SIBLING_ABANDONMENT_NOTIFY_FAILED",
                  notifyError
                );
              }
            })(),
            (async () => {
              if (!verifyResult.emailData?.customerPhone) return;
              try {
                await sendBookingConfirmationWhatsApp({
                  phone: verifyResult.emailData.customerPhone.startsWith("91")
                    ? verifyResult.emailData.customerPhone
                    : `91${verifyResult.emailData.customerPhone}`,
                  customerName: verifyResult.emailData.customerName,
                  bookingRef: verifyResult.bookingRef,
                  location: verifyResult.emailData.locationName,
                  theatre: verifyResult.emailData.theatreName,
                  dateTime: `${verifyResult.emailData.date}, ${verifyResult.emailData.timeSlot}`,
                  guests: String(verifyResult.emailData.guestCount),
                  totalAmount: String(verifyResult.emailData.totalAmount),
                  advancePaid: String(verifyResult.emailData.advancePaid),
                  payAtTheatre: String(verifyResult.emailData.remainingPayable),
                  bookingUrl: verifyResult.emailData.successUrl,
                });
              } catch (whatsAppError) {
                console.error(
                  "BOOKING_CONFIRMATION_WHATSAPP_FAILED",
                  whatsAppError
                );
              }
            })(),
          ]);
        }
      );

      const response = NextResponse.json({
        success: true,
        bookingRef: verifyResult.bookingRef,
        successToken: verifyResult.successToken,
      });

      response.cookies.set("ds_booking_session", "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      response.cookies.set("ds_lock_owner", "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });

      return response;
    } catch (error) {
      await markAttemptFailed();
      throw error;
    }
  } catch (error) {
    console.error("RAZORPAY_VERIFY_ERROR", error);

    if (error instanceof ApiError) {
      return bookingErrorResponse(
        error.status,
        error.code,
        error.message,
        error.extra
      );
    }

    return bookingErrorResponse(
      500,
      "PAYMENT_VERIFICATION_FAILED",
      "Payment verification failed."
    );
  }
}
