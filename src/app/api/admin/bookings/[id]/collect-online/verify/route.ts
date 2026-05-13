import crypto from "crypto";
import { BookingStatus, PaymentStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
import { sendAdminBookingConfirmationEmailByBookingId } from "@/services/booking/admin-booking-confirmation-email.service";

const ADMIN_SOFT_DELETE_REASON = "ADMIN_SOFT_DELETED";

type VerifyPayload = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

function timingSafeEqualString(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return bookingErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
    }

    const { id } = await context.params;
    if (!id) {
      return bookingErrorResponse(400, "INVALID_REQUEST", "Booking id is required.");
    }

    const body = (await req.json().catch(() => null)) as VerifyPayload | null;

    const razorpay_order_id = String(body?.razorpay_order_id ?? "").trim();
    const razorpay_payment_id = String(body?.razorpay_payment_id ?? "").trim();
    const razorpay_signature = String(body?.razorpay_signature ?? "").trim();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return bookingErrorResponse(400, "INVALID_REQUEST", "Missing payment details.");
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (!timingSafeEqualString(expectedSignature, razorpay_signature)) {
      return bookingErrorResponse(403, "UNAUTHORIZED", "Invalid payment signature.");
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id
        FROM "Booking"
        WHERE id = ${id}
        FOR UPDATE
      `);

      const booking = await tx.booking.findUnique({
        where: { id },
        select: {
          id: true,
          bookingRef: true,
          bookingStatus: true,
          paymentStatus: true,
          cancelledReason: true,
          totalAmount: true,
          advancePaid: true,
          remainingPayable: true,
          razorpayOrderId: true,
          razorpayPaymentId: true,
        },
      });

      if (!booking || booking.cancelledReason === ADMIN_SOFT_DELETE_REASON) {
        throw new Error("BOOKING_NOT_FOUND");
      }

      if (booking.razorpayPaymentId === razorpay_payment_id) {
        return {
          bookingId: id,
          bookingRef: booking.bookingRef,
          advancePaid: booking.advancePaid,
          remainingPayable: booking.remainingPayable,
          idempotent: true,
        };
      }

      if (booking.razorpayOrderId && booking.razorpayOrderId !== razorpay_order_id) {
        throw new Error("ORDER_MISMATCH");
      }

      const pendingPayment = await tx.payment.findFirst({
        where: {
          bookingId: id,
          provider: "RAZORPAY",
          status: PaymentStatus.INITIALIZED,
          transactionId: razorpay_order_id,
        },
        orderBy: { createdAt: "desc" },
      });

      if (!pendingPayment) {
        throw new Error("PAYMENT_NOT_INITIALIZED");
      }

      const amountToApply = Math.max(Number(pendingPayment.amount ?? 0), 0);
      if (amountToApply <= 0) {
        throw new Error("INVALID_PAYMENT_AMOUNT");
      }

      const nextAdvancePaid = Math.min(
        Math.max(Number(booking.advancePaid ?? 0), 0) + amountToApply,
        Math.max(Number(booking.totalAmount ?? 0), 0)
      );

      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          bookingStatus: BookingStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          advancePaid: nextAdvancePaid,
          remainingPayable: Math.max(booking.totalAmount - nextAdvancePaid, 0),
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
        },
        select: {
          bookingRef: true,
          advancePaid: true,
          remainingPayable: true,
        },
      });

      await tx.payment.update({
        where: { id: pendingPayment.id },
        data: {
          status: PaymentStatus.PAID,
          transactionId: razorpay_payment_id,
          method: "ONLINE",
          recordedByAdminId: pendingPayment.recordedByAdminId ?? adminId,
        },
      });

      await tx.payment.updateMany({
        where: {
          bookingId: id,
          provider: "RAZORPAY",
          status: PaymentStatus.INITIALIZED,
          id: {
            not: pendingPayment.id,
          },
        },
        data: {
          status: PaymentStatus.CANCELLED,
        },
      });

      return {
        bookingId: id,
        bookingRef: updatedBooking.bookingRef,
        advancePaid: updatedBooking.advancePaid,
        remainingPayable: updatedBooking.remainingPayable,
        idempotent: false,
      };
    });

    if (!result.idempotent) {
      try {
        await sendAdminBookingConfirmationEmailByBookingId(
          result.bookingId,
          "ADMIN_COLLECT_ONLINE_VERIFY"
        );
      } catch (adminEmailError) {
        console.error("ADMIN_COLLECT_ONLINE_CONFIRMATION_EMAIL_FAILED", adminEmailError);
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: result.idempotent
        ? "Payment was already verified."
        : "Payment verified successfully.",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "BOOKING_NOT_FOUND") {
        return bookingErrorResponse(404, "BOOKING_NOT_FOUND", "Booking not found.");
      }

      if (error.message === "ORDER_MISMATCH") {
        return bookingErrorResponse(409, "ORDER_MISMATCH", "Payment order mismatch.");
      }

      if (error.message === "PAYMENT_NOT_INITIALIZED") {
        return bookingErrorResponse(
          409,
          "PAYMENT_NOT_INITIALIZED",
          "Online payment session is not initialized for this booking."
        );
      }

      if (error.message === "INVALID_PAYMENT_AMOUNT") {
        return bookingErrorResponse(409, "INVALID_PAYMENT_AMOUNT", "Invalid payment amount.");
      }
    }

    console.error("ADMIN_COLLECT_ONLINE_VERIFY_ERROR", error);
    return bookingErrorResponse(500, "INTERNAL_ERROR", "Failed to verify payment.");
  }
}
