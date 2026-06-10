import crypto from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getRequiredAdvancePaymentAmount } from "@/lib/advance-payment";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import { timingSafeEqualString } from "@/lib/security/timingSafeEqual";
import {
  finalizeRangePayment,
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

type VerifyPayload = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  bookingId?: string;
  providerPayload?: Prisma.InputJsonValue;
};

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
      select: {
        id: true,
        bookingRef: true,
        slotId: true,
        advancePaid: true,
        bookingStatus: true,
        paymentStatus: true,
        razorpayPaymentId: true,
        razorpayOrderId: true,
      },
    });

    if (!bookingSnapshot) {
      return bookingErrorResponse(
        404,
        "BOOKING_NOT_FOUND",
        "Booking not found."
      );
    }

    if (bookingSnapshot.slotId === null) {
      const result = await finalizeRangePayment({
        provider: "RAZORPAY",
        bookingId: bookingSnapshot.id,
        providerOrderId: razorpay_order_id,
        providerPaymentId: razorpay_payment_id,
        amount:
          bookingSnapshot.advancePaid > 0
            ? bookingSnapshot.advancePaid
            : await getRequiredAdvancePaymentAmount(prisma),
        providerPayload: payload?.providerPayload ?? {
          source: "checkout_verification",
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
        },
      });
      if (result.status === "CONFIRMED" || result.status === "ALREADY_CONFIRMED") {
        const response = NextResponse.json({
          success: true,
          bookingRef: result.bookingRef,
          successToken: result.successToken,
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
      }
      if (result.status === "MANUAL_REVIEW") {
        return bookingErrorResponse(
          409,
          "PAYMENT_MANUAL_REVIEW",
          "Payment was received, but the reservation requires manual review.",
          {
            paymentCaptured: true,
            bookingRef: result.bookingRef,
            cancelledReason: result.reason,
          }
        );
      }
      return bookingErrorResponse(
        409,
        "PAYMENT_ATTEMPT_NOT_FOUND",
        "Payment attempt could not be matched to this booking."
      );
    }

    // Slot-based bookings are no longer supported.
    return bookingErrorResponse(
      409,
      "BOOKING_INVALID_STATE",
      "This booking type is no longer supported for direct slot-based payment verification."
    );
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
