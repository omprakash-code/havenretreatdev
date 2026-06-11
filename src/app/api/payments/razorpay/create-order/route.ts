// api/payments/razorpay/create-order/route.ts

/*---------------------------------------
*Razorpay Verify API
 ├─ Validate signature
 ├─ Confirm booking + slot
 ├─ Fetch booking email data
 ├─ Send confirmation email (fire-and-forget)
 └─ Return bookingRef
----------------------------------------------*/

import { prisma } from "@/lib/db";
import {
  AdvancePaymentConfigError,
  getRequiredAdvancePaymentAmount,
} from "@/lib/advance-payment";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import {
  createRazorpayOrder,
  RazorpayServerError,
} from "@/lib/razorpay/server";
import {
  BookingOverlapError,
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

async function createRangeRazorpayOrder(booking: {
  id: string;
  bookingRef: string;
  lockVersion: number | null;
  totalAmount: number;
  advancePaid: number;
  razorpayOrderId: string | null;
}) {
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
    provider: "RAZORPAY",
    amount,
  });
  if (started.payment.status === "AWAITING_PAYMENT" && booking.razorpayOrderId) {
    return {
      id: booking.razorpayOrderId,
      amount: amount * 100,
      advancePayable: amount,
      totalAmount: booking.totalAmount,
      remainingPayable: Math.max(booking.totalAmount - amount, 0),
    };
  }

  const created = await createRazorpayOrder({
    amount: amount * 100,
    currency: "INR",
    receipt: `${booking.bookingRef}-v${identity.lockVersion}`,
    payment_capture: true,
  });
  await completeRangePaymentAttempt({
    paymentId: started.payment.id,
    providerOrderId: created.id,
    providerPayload: {
      source: "order_creation",
      orderId: created.id,
      amount: created.amount,
      currency: created.currency,
      status: created.status ?? null,
    },
  });
  return {
    id: created.id,
    amount: created.amount,
    advancePayable: amount,
    totalAmount: booking.totalAmount,
    remainingPayable: Math.max(booking.totalAmount - amount, 0),
  };
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
       1. Fetch booking
    ---------------------------------- */
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return jsonError(
        404,
        "BOOKING_NOT_FOUND",
        "Booking not found."
      );
    }

    const order = await createRangeRazorpayOrder(booking);
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

    if (error instanceof RangePaymentError) {
      const status =
        error.code === "RANGE_PAYMENT_DISABLED"
          ? 503
          : error.code === "BOOKING_NOT_FOUND"
            ? 404
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
