import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  AdvancePaymentConfigError,
  getRequiredAdvancePaymentAmount,
} from "@/lib/advance-payment";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import { RESERVATION_TIMED_OUT_MESSAGE } from "@/lib/booking-session-expiry";
import {
  createSquarePaymentLink,
  getSquareCurrency,
  SquareServerError,
} from "@/lib/square/server";
import { verifyBookingSessionToken } from "@/services/booking/bookingSession.server";
import {
  expireBookingLockSession,
  isStrictLockExpired,
} from "@/services/booking/booking-lock-lifecycle.service";
import { notifyAbandonedBookingsByIds } from "@/services/booking/booking-abandonment-email.service";
import {
  BookingOverlapError,
  lockSlotRowForUpdate,
  logBookingSafetyEvent,
  validateNoOverlappingActiveBooking,
} from "@/services/booking/booking-safety.service";
import { getRangeBookingApiIdentity } from "@/services/booking/range-booking-api-session";
import {
  beginRangePaymentAttempt,
  completeRangePaymentAttempt,
  RangePaymentError,
} from "@/services/booking/range-payment.service";

class ApiError extends Error {
  status: number;
  code: string;
  extra?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

function jsonError(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>
) {
  return bookingErrorResponse(status, code, message, extra);
}

function getBaseUrl(req: Request) {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

async function createRangeSquareCheckout(
  req: Request,
  booking: {
    id: string;
    bookingRef: string;
    lockVersion: number | null;
    totalAmount: number;
    advancePaid: number;
    paymentProvider: string | null;
    paymentOrderId: string | null;
    paymentCheckoutUrl: string | null;
  }
) {
  const identity = await getRangeBookingApiIdentity(booking.id);
  if (!identity || identity.lockVersion === null) {
    throw new ApiError(
      403,
      "SESSION_EXPIRED",
      "Your booking session expired or was replaced."
    );
  }
  const configuredAdvanceAmount = await getRequiredAdvancePaymentAmount(prisma);
  const amount =
    booking.advancePaid > 0 ? booking.advancePaid : configuredAdvanceAmount;
  const started = await beginRangePaymentAttempt({
    bookingId: booking.id,
    bookingLockVersion: identity.lockVersion,
    provider: "SQUARE",
    amount,
  });
  if (
    started.payment.status === "AWAITING_PAYMENT" &&
    booking.paymentProvider === "SQUARE" &&
    booking.paymentOrderId &&
    booking.paymentCheckoutUrl
  ) {
    return {
      checkoutUrl: booking.paymentCheckoutUrl,
      orderId: booking.paymentOrderId,
      amount: amount * 100,
      advancePayable: amount,
      totalAmount: booking.totalAmount,
      remainingPayable: Math.max(booking.totalAmount - amount, 0),
    };
  }

  const created = await createSquarePaymentLink({
    idempotencyKey: started.idempotencyKey,
    name: `Haven Retreat ${booking.bookingRef}`,
    amount: amount * 100,
    currency: getSquareCurrency(),
    redirectUrl:
      `${getBaseUrl(req)}/booking/payment/square/return?bookingId=` +
      encodeURIComponent(booking.id),
    bookingId: booking.id,
    bookingRef: booking.bookingRef,
  });
  await completeRangePaymentAttempt({
    paymentId: started.payment.id,
    providerOrderId: created.orderId,
    checkoutUrl: created.checkoutUrl,
    paymentLinkId: created.paymentLinkId,
    providerPayload: {
      source: "checkout_creation",
      orderId: created.orderId,
      paymentLinkId: created.paymentLinkId,
    },
  });
  return {
    checkoutUrl: created.checkoutUrl,
    orderId: created.orderId,
    amount: amount * 100,
    advancePayable: amount,
    totalAmount: booking.totalAmount,
    remainingPayable: Math.max(booking.totalAmount - amount, 0),
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { bookingId?: string } | null;
    const bookingId = body?.bookingId;

    if (!bookingId) {
      return jsonError(400, "INVALID_REQUEST", "bookingId is required.");
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { slot: true },
    });

    if (!booking) {
      return jsonError(404, "BOOKING_NOT_FOUND", "Booking not found.");
    }

    if (booking.slotId === null) {
      const checkout = await createRangeSquareCheckout(req, booking);
      return Response.json({ success: true, ...checkout });
    }

    const now = new Date();
    if (
      booking.slotId &&
      isStrictLockExpired({
        id: booking.id,
        bookingStatus: booking.bookingStatus,
        slotId: booking.slotId,
        slot: booking.slot,
      }, now)
    ) {
      const expireResult = await expireBookingLockSession(prisma, {
        bookingId: booking.id,
        slotId: booking.slotId,
        now,
        cancelledReason: "SESSION_EXPIRED",
      });
      if (expireResult.abandonedBookingIds.length > 0) {
        try {
          await notifyAbandonedBookingsByIds(expireResult.abandonedBookingIds);
        } catch (notifyError) {
          console.error("SQUARE_CHECKOUT_ABANDONMENT_NOTIFY_FAILED", notifyError);
        }
      }
      return jsonError(409, "SESSION_EXPIRED", RESERVATION_TIMED_OUT_MESSAGE);
    }

    if (booking.bookingStatus === "CONFIRMED") {
      return jsonError(409, "BOOKING_FINALIZED", "This booking is already confirmed.");
    }

    if (
      booking.bookingStatus !== "AWAITING_PAYMENT" &&
      booking.bookingStatus !== "PAYMENT_PROCESSING"
    ) {
      return jsonError(409, "BOOKING_INVALID_STATE", "Booking is not ready for payment.");
    }

    if (!booking.termsAcceptedAt) {
      return jsonError(409, "BOOKING_INVALID_STATE", "Please accept terms before payment.");
    }

    if (!booking.slot || booking.slot.status !== "LOCKED") {
      return jsonError(409, "SLOT_EXPIRED", "Selected slot has expired. Please choose a slot again.");
    }

    const cookieStore = await cookies();
    const bookingSessionToken = cookieStore.get("ds_booking_session")?.value ?? null;
    const bookingSession = bookingSessionToken
      ? verifyBookingSessionToken(bookingSessionToken)
      : null;

    if (!bookingSession || bookingSession.bookingId !== booking.id || !bookingSession.lockOwner) {
      return jsonError(
        403,
        "SESSION_EXPIRED",
        "Your booking session expired or was replaced by another booking."
      );
    }

    const effectiveLockOwner = bookingSession.lockOwner;
    if (booking.slot.lockedBy !== effectiveLockOwner) {
      return jsonError(403, "UNAUTHORIZED", "This booking session is no longer valid.");
    }

    const configuredAdvanceAmount = await getRequiredAdvancePaymentAmount(prisma);
    const advanceAmount =
      booking.advancePaid && booking.advancePaid > 0
        ? booking.advancePaid
        : configuredAdvanceAmount;

    const baseUrl = getBaseUrl(req);
    const checkout = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id
        FROM "Booking"
        WHERE id = ${booking.id}
        FOR UPDATE
      `);

      const fresh = await tx.booking.findUnique({
        where: { id: booking.id },
        include: { slot: true },
      });

      if (!fresh || !fresh.slotId || !fresh.slot) {
        throw new ApiError(409, "SLOT_EXPIRED", "Selected slot has expired. Please choose a slot again.");
      }

      await lockSlotRowForUpdate(tx, {
        slotId: fresh.slotId,
        context: "square-create-checkout",
      });

      const lockedSlot = await tx.slot.findUnique({
        where: { id: fresh.slotId },
      });

      if (!lockedSlot || lockedSlot.status !== "LOCKED") {
        throw new ApiError(409, "SLOT_EXPIRED", "Selected slot has expired. Please choose a slot again.");
      }

      if (lockedSlot.lockedBy !== effectiveLockOwner) {
        throw new ApiError(403, "UNAUTHORIZED", "This booking session is no longer valid.");
      }

      if (lockedSlot.lockExpiresAt && lockedSlot.lockExpiresAt.getTime() < Date.now()) {
        throw new ApiError(409, "SESSION_EXPIRED", RESERVATION_TIMED_OUT_MESSAGE);
      }

      await validateNoOverlappingActiveBooking(tx, {
        theatreId: fresh.theatreId ?? lockedSlot.theatreId,
        date: lockedSlot.date,
        startTime: lockedSlot.startTime,
        endTime: lockedSlot.endTime,
        excludeBookingId: fresh.id,
        allowLockOwner: effectiveLockOwner,
        context: "square-create-checkout",
      });

      const lockedAdvance =
        fresh.advancePaid && fresh.advancePaid > 0
          ? fresh.advancePaid
          : advanceAmount;

      if (
        fresh.paymentProvider === "SQUARE" &&
        fresh.paymentOrderId &&
        fresh.paymentCheckoutUrl
      ) {
        return {
          checkoutUrl: fresh.paymentCheckoutUrl,
          orderId: fresh.paymentOrderId,
          amount: lockedAdvance * 100,
          advancePayable: lockedAdvance,
          totalAmount: fresh.totalAmount,
          remainingPayable: Math.max(fresh.totalAmount - lockedAdvance, 0),
        };
      }

      const created = await createSquarePaymentLink({
        idempotencyKey: `booking-${fresh.id}-${lockedAdvance}`,
        name: `Haven Retreat ${fresh.bookingRef}`,
        amount: lockedAdvance * 100,
        currency: getSquareCurrency(),
        redirectUrl: `${baseUrl}/booking/payment/square/return?bookingId=${encodeURIComponent(fresh.id)}`,
        bookingId: fresh.id,
        bookingRef: fresh.bookingRef,
      });

      await tx.payment.updateMany({
        where: {
          bookingId: fresh.id,
          provider: "SQUARE",
          status: "INITIALIZED",
        },
        data: { status: "CANCELLED" },
      });

      await tx.payment.create({
        data: {
          bookingId: fresh.id,
          provider: "SQUARE",
          transactionId: created.orderId,
          method: `HOSTED_CHECKOUT:${created.paymentLinkId}`,
          amount: lockedAdvance,
          status: "INITIALIZED",
        },
      });

      await tx.booking.update({
        where: { id: fresh.id },
        data: {
          bookingStatus: "PAYMENT_PROCESSING",
          paymentStatus: "AWAITING_PAYMENT",
          paymentProvider: "SQUARE",
          paymentOrderId: created.orderId,
          paymentTransactionId: null,
          paymentSignature: null,
          paymentCheckoutUrl: created.checkoutUrl,
          advancePaid: lockedAdvance,
          remainingPayable: Math.max(fresh.totalAmount - lockedAdvance, 0),
        },
      });

      logBookingSafetyEvent("PAYMENT_ORDER_STARTED", {
        provider: "SQUARE",
        bookingId: fresh.id,
        slotId: fresh.slotId,
        orderId: created.orderId,
      });

      return {
        checkoutUrl: created.checkoutUrl,
        orderId: created.orderId,
        amount: lockedAdvance * 100,
        advancePayable: lockedAdvance,
        totalAmount: fresh.totalAmount,
        remainingPayable: Math.max(fresh.totalAmount - lockedAdvance, 0),
      };
    });

    return Response.json({
      success: true,
      checkoutUrl: checkout.checkoutUrl,
      orderId: checkout.orderId,
      amount: checkout.amount,
      advancePayable: checkout.advancePayable,
      totalAmount: checkout.totalAmount,
      remainingPayable: checkout.remainingPayable,
    });
  } catch (error) {
    console.error("SQUARE_CHECKOUT_ERROR", error);

    if (error instanceof ApiError) {
      return jsonError(error.status, error.code, error.message, error.extra);
    }

    if (error instanceof RangePaymentError) {
      const status =
        error.code === "RANGE_PAYMENT_DISABLED"
          ? 503
          : error.code === "BOOKING_NOT_FOUND"
            ? 404
            : error.code === "SESSION_EXPIRED"
              ? 409
              : 409;
      return jsonError(status, error.code, error.message);
    }

    if (error instanceof BookingOverlapError) {
      return jsonError(
        409,
        "RANGE_ALREADY_RESERVED",
        "This time range is currently reserved. Choose another time range."
      );
    }

    if (error instanceof AdvancePaymentConfigError) {
      return jsonError(500, "CONFIG_MISSING", error.message);
    }

    if (error instanceof SquareServerError) {
      return jsonError(
        error.status === 500 ? 500 : 502,
        error.status === 500
          ? "PAYMENT_GATEWAY_NOT_CONFIGURED"
          : "PAYMENT_ORDER_FAILED",
        error.message
      );
    }

    return jsonError(500, "PAYMENT_ORDER_FAILED", "Failed to create Square checkout.");
  }
}
