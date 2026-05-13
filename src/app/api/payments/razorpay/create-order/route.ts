// api/payments/razorpay/create-order/route.ts

/*---------------------------------------
*Razorpay Verify API
 ├─ Validate signature
 ├─ Confirm booking + slot
 ├─ Fetch booking email data
 ├─ Send confirmation email (fire-and-forget)
 └─ Return bookingRef
----------------------------------------------*/

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import {
  AdvancePaymentConfigError,
  getRequiredAdvancePaymentAmount,
} from "@/lib/advance-payment";
import { verifyBookingSessionToken } from "@/services/booking/bookingSession.server";
import { createSuccessToken } from "@/services/booking/successToken.server";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import {
  expireBookingLockSession,
  isStrictLockExpired,
} from "@/services/booking/booking-lock-lifecycle.service";
import { RESERVATION_TIMED_OUT_MESSAGE } from "@/lib/booking-session-expiry";
import { notifyAbandonedBookingsByIds } from "@/services/booking/booking-abandonment-email.service";
import {
  createRazorpayOrder,
  RazorpayServerError,
} from "@/lib/razorpay/server";

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

function jsonError(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>
) {
  return bookingErrorResponse(status, code, message, extra);
}

export async function POST(req: Request) {
  try {
    let body: { bookingId?: string };
    try {
      body = (await req.json()) as { bookingId?: string };
    } catch {
      return jsonError(
        400,
        "INVALID_REQUEST",
        "Invalid request payload."
      );
    }

    const bookingId = body.bookingId;

    if (!bookingId) {
      return jsonError(
        400,
        "INVALID_REQUEST",
        "bookingId is required."
      );
    }

    /* ---------------------------------
       1. Fetch booking + slot
    ---------------------------------- */
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { slot: true },
    });

    if (!booking) {
      return jsonError(
        404,
        "BOOKING_NOT_FOUND",
        "Booking not found."
      );
    }

    const now = new Date();
    if (isStrictLockExpired(booking, now)) {
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
          console.error("CREATE_ORDER_ABANDONMENT_NOTIFY_FAILED", notifyError);
        }
      }
      return jsonError(
        409,
        "SESSION_EXPIRED",
        RESERVATION_TIMED_OUT_MESSAGE
      );
    }

    if (booking.bookingStatus === "CONFIRMED") {
      return jsonError(
        409,
        "BOOKING_FINALIZED",
        "This booking is already confirmed.",
        {
          bookingRef: booking.bookingRef,
          successToken: createSuccessToken(
            booking.id,
            booking.bookingRef
          ),
        }
      );
    }

    if (booking.bookingStatus === "PAID_EXPIRED") {
      return jsonError(
        409,
        "PAID_EXPIRED",
        "This reservation expired during payment processing. Please restart your booking.",
        {
          bookingRef: booking.bookingRef,
          bookingStatus: booking.bookingStatus,
          paymentCaptured: booking.paymentStatus === "PAID",
          cancelledReason: booking.cancelledReason ?? undefined,
        }
      );
    }

    if (
      booking.bookingStatus !== "AWAITING_PAYMENT" &&
      booking.bookingStatus !== "PAYMENT_PROCESSING"
    ) {
      return jsonError(
        409,
        "BOOKING_INVALID_STATE",
        "Booking is not ready for payment."
      );
    }

    if (!booking.termsAcceptedAt) {
      return jsonError(
        409,
        "BOOKING_INVALID_STATE",
        "Please accept terms before payment."
      );
    }

    if (!booking.slot || booking.slot.status !== "LOCKED") {
      return jsonError(
        409,
        "SLOT_EXPIRED",
        "Selected slot has expired. Please choose a slot again."
      );
    }

    // SECURITY: ensure slot is locked by this user
    const cookieStore = await cookies();
    const guestToken = cookieStore.get("ds_lock_owner")?.value ?? null;
    const bookingSessionToken =
      cookieStore.get("ds_booking_session")?.value ?? null;

    if (!bookingSessionToken) {
      return jsonError(
        403,
        "SESSION_EXPIRED",
        "Your booking session expired or was replaced by another booking."
      );
    }

    const bookingSession =
      verifyBookingSessionToken(bookingSessionToken);

    if (
      !bookingSession ||
      bookingSession.bookingId !== booking.id
    ) {
      return jsonError(
        403,
        "SESSION_EXPIRED",
        "Your booking session expired or was replaced by another booking."
      );
    }

    const effectiveLockOwner = bookingSession.lockOwner;
    if (!effectiveLockOwner) {
      return jsonError(
        403,
        "SESSION_EXPIRED",
        "Your booking session expired or was replaced by another booking."
      );
    }

    if (
      booking.slot.lockedBy !== effectiveLockOwner
    ) {
      return jsonError(
        403,
        "UNAUTHORIZED",
        "This booking session is no longer valid."
      );
    }

    // Self-heal guest lock-owner cookie when stale/missing.
    if (!guestToken || guestToken !== effectiveLockOwner) {
      cookieStore.set("ds_lock_owner", effectiveLockOwner, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 2,
      });
    }


    /* ---------------------------------
       2. Resolve advance amount (DB source)
    ---------------------------------- */
    const configuredAdvanceAmount = await getRequiredAdvancePaymentAmount(prisma);

    const advanceAmount =
      booking.advancePaid && booking.advancePaid > 0
        ? booking.advancePaid
        : configuredAdvanceAmount;

    /* ---------------------------------
       3. Lock advance snapshot (retry-safe)
    ---------------------------------- */
    if (!booking.advancePaid || booking.advancePaid === 0) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          advancePaid: advanceAmount,
          remainingPayable: Math.max(booking.totalAmount - advanceAmount, 0),
        },
      });
    }

    const order = await prisma.$transaction(async (tx) => {
      // Serialize order creation for a booking to avoid duplicate Razorpay orders
      // under concurrent retries/clicks.
      await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id
        FROM "Booking"
        WHERE id = ${booking.id}
        FOR UPDATE
      `);

      const fresh = await tx.booking.findUnique({
        where: { id: booking.id },
      });

      if (!fresh) {
        throw new ApiError(
          400,
          "BOOKING_NOT_FOUND",
          "Booking not found."
        );
      }

      const lockedAdvance =
        fresh.advancePaid && fresh.advancePaid > 0
          ? fresh.advancePaid
          : advanceAmount;

      let orderId = fresh.razorpayOrderId;
      let orderAmount = lockedAdvance * 100;

      if (!orderId) {
        const created = await createRazorpayOrder({
          amount: lockedAdvance * 100,
          currency: "INR",
          receipt: fresh.bookingRef,
          payment_capture: true,
        });
        orderId = created.id;
        orderAmount = Number(created.amount);
      }

      await tx.booking.update({
        where: { id: fresh.id },
        data: {
          bookingStatus: "PAYMENT_PROCESSING",
          paymentStatus: "AWAITING_PAYMENT",
          razorpayOrderId: orderId,
          advancePaid: lockedAdvance,
          remainingPayable: Math.max(fresh.totalAmount - lockedAdvance, 0),
        },
      });

      return {
        id: orderId,
        amount: orderAmount,
        advancePayable: lockedAdvance,
        totalAmount: fresh.totalAmount,
        remainingPayable: Math.max(fresh.totalAmount - lockedAdvance, 0),
      };
    });

    return Response.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      advancePayable: order.advancePayable,
      totalAmount: order.totalAmount,
      remainingPayable: order.remainingPayable,
    });
  } catch (error) {
    console.error("RAZORPAY_ORDER_ERROR", error);

    if (error instanceof ApiError) {
      return jsonError(
        error.status,
        error.code,
        error.message,
        error.extra
      );
    }

    if (error instanceof AdvancePaymentConfigError) {
      return jsonError(500, "CONFIG_MISSING", error.message);
    }

    if (error instanceof RazorpayServerError) {
      return jsonError(
        error.status === 500 ? 500 : 502,
        error.status === 500
          ? "PAYMENT_GATEWAY_NOT_CONFIGURED"
          : "PAYMENT_ORDER_FAILED",
        error.message
      );
    }

    return jsonError(
      500,
      "PAYMENT_ORDER_FAILED",
      "Failed to create payment order."
    );
  }
}
