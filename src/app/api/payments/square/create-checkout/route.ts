import { prisma } from "@/lib/db";
import {
  AdvancePaymentConfigError,
  getRequiredAdvancePaymentAmount,
} from "@/lib/advance-payment";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import {
  createSquarePaymentLink,
  getSquareCurrency,
  SquareServerError,
} from "@/lib/square/server";
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
    });

    if (!booking) {
      return jsonError(404, "BOOKING_NOT_FOUND", "Booking not found.");
    }

    const checkout = await createRangeSquareCheckout(req, booking);
    return Response.json({ success: true, ...checkout });
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
