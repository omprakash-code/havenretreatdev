import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createSuccessToken } from "@/services/booking/successToken.server";
import {
  logBookingSafetyEvent,
} from "@/services/booking/booking-safety.service";
import {
  finalizeRangePayment,
} from "@/services/booking/range-payment.service";
import { sendAdminBookingConfirmationEmailByBookingId } from "@/services/booking/admin-booking-confirmation-email.service";

export type SquareFinalizeResult = {
  status:
    | "CONFIRMED"
    | "ALREADY_CONFIRMED"
    | "TOPUP_COLLECTED"
    | "MANUAL_REVIEW"
    | "PAID_EXPIRED"
    | "IGNORED";
  bookingId?: string;
  bookingRef?: string;
  successToken?: string;
  reason?: string;
};

const PAYMENT_LINK_METHOD_PREFIX = "PAYMENT_LINK:";

function isPayableBookingStatus(status: string) {
  return status === "AWAITING_PAYMENT" || status === "PAYMENT_PROCESSING";
}

async function markSquarePaymentAttemptPaid(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    orderId: string;
    paymentId: string;
    amount: number;
  }
) {
  const pending = await tx.payment.findFirst({
    where: {
      bookingId: input.bookingId,
      provider: "SQUARE",
      transactionId: input.orderId,
      status: { in: ["INITIALIZED", "AWAITING_PAYMENT"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (pending) {
    await tx.payment.update({
      where: { id: pending.id },
      data: {
        status: "PAID",
        transactionId: input.paymentId,
      },
    });
    return;
  }

  await tx.payment.create({
    data: {
      bookingId: input.bookingId,
      provider: "SQUARE",
      transactionId: input.paymentId,
      method: "HOSTED_CHECKOUT",
      amount: input.amount,
      status: "PAID",
    },
  });
}

async function markPaidExpired(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    reason: string;
    orderId: string;
    paymentId: string;
    amount: number;
  }
) {
  const booking = await tx.booking.update({
    where: { id: input.bookingId },
    data: {
      bookingStatus: "PAID_EXPIRED",
      paymentStatus: "PAID",
      cancelledReason: input.reason,
      cancelledAt: new Date(),
      advancePaid: input.amount,
      paymentProvider: "SQUARE",
      paymentOrderId: input.orderId,
      paymentTransactionId: input.paymentId,
      paymentSignature: null,
      paymentCheckoutUrl: null,
    },
  });

  await markSquarePaymentAttemptPaid(tx, {
    bookingId: input.bookingId,
    orderId: input.orderId,
    paymentId: input.paymentId,
    amount: input.amount,
  });

  return booking;
}

// Applies an admin-generated "balance" payment link to an already-confirmed
// booking. Unlike the primary checkout, this increments the amount already
// paid instead of flipping the booking from AWAITING_PAYMENT to CONFIRMED.
async function finalizeSquareTopUpPayment(
  input: {
    orderId: string;
    paymentId: string;
    amount: number;
    providerPayload?: Prisma.InputJsonValue;
  },
  paymentId: string
): Promise<SquareFinalizeResult> {
  const outcome = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return { status: "IGNORED" as const, applied: false };

    await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM "Booking" WHERE id = ${payment.bookingId} FOR UPDATE
    `);
    const booking = await tx.booking.findUnique({
      where: { id: payment.bookingId },
    });
    if (!booking) return { status: "IGNORED" as const, applied: false };

    // Idempotent replay: this link was already settled.
    if (payment.status === "PAID") {
      return {
        status: "TOPUP_COLLECTED" as const,
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        applied: false,
      };
    }

    const applied = input.amount > 0 ? input.amount : payment.amount;
    const nextAdvancePaid = Math.min(
      Math.max(Number(booking.advancePaid ?? 0), 0) + Math.max(applied, 0),
      Math.max(Number(booking.totalAmount ?? 0), 0)
    );

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        advancePaid: nextAdvancePaid,
        remainingPayable: Math.max(booking.totalAmount - nextAdvancePaid, 0),
      },
    });

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        method: "ONLINE",
        providerPaymentId: input.paymentId,
        transactionId: input.paymentId,
        providerPayload: input.providerPayload,
      },
    });

    logBookingSafetyEvent("PAYMENT_CONFIRMED_BOOKING", {
      provider: "SQUARE",
      bookingId: booking.id,
      paymentId: input.paymentId,
      orderId: input.orderId,
      topUp: true,
    });

    return {
      status: "TOPUP_COLLECTED" as const,
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      applied: true,
    };
  });

  if (outcome.applied && outcome.bookingId) {
    try {
      await sendAdminBookingConfirmationEmailByBookingId(
        outcome.bookingId,
        "ADMIN_COLLECT_ONLINE_VERIFY"
      );
    } catch (adminEmailError) {
      console.error(
        "ADMIN_TOPUP_PAYMENT_CONFIRMATION_EMAIL_FAILED",
        adminEmailError
      );
    }
  }

  const { applied: _applied, ...result } = outcome;
  void _applied;
  return result;
}

export async function finalizeSquarePayment(input: {
  orderId: string;
  paymentId: string;
  amount: number;
  providerPayload?: Prisma.InputJsonValue;
}) {
  const rangeAttempt = await prisma.payment.findFirst({
    where: {
      provider: "SQUARE",
      providerOrderId: input.orderId,
      bookingLockVersion: { not: null },
    },
    select: { id: true },
  });
  if (rangeAttempt) {
    return finalizeRangePayment({
      provider: "SQUARE",
      providerOrderId: input.orderId,
      providerPaymentId: input.paymentId,
      amount: input.amount,
      providerPayload: input.providerPayload ?? {
        source: "square_webhook",
        orderId: input.orderId,
        paymentId: input.paymentId,
      },
    });
  }

  const topUpAttempt = await prisma.payment.findFirst({
    where: {
      provider: "SQUARE",
      providerOrderId: input.orderId,
      bookingLockVersion: null,
    },
    select: { id: true, method: true },
  });
  if (
    topUpAttempt &&
    (topUpAttempt.method ?? "").startsWith(PAYMENT_LINK_METHOD_PREFIX)
  ) {
    return finalizeSquareTopUpPayment(input, topUpAttempt.id);
  }

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id
      FROM "Booking"
      WHERE "paymentProvider" = 'SQUARE'
        AND "paymentOrderId" = ${input.orderId}
      FOR UPDATE
    `);

    const bookingId = rows[0]?.id;
    if (!bookingId) {
      console.warn("SQUARE_PAYMENT_BOOKING_NOT_FOUND", {
        orderId: input.orderId,
        paymentId: input.paymentId,
      });
      return { status: "IGNORED" } satisfies SquareFinalizeResult;
    }

    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return { status: "IGNORED" } satisfies SquareFinalizeResult;
    }

    if (
      booking.bookingStatus === "CONFIRMED" &&
      booking.paymentStatus === "PAID"
    ) {
      if (!booking.paymentTransactionId) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { paymentTransactionId: input.paymentId },
        });
      }
      await markSquarePaymentAttemptPaid(tx, {
        bookingId: booking.id,
        orderId: input.orderId,
        paymentId: input.paymentId,
        amount: input.amount,
      });
      return {
        status: "ALREADY_CONFIRMED",
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        successToken: createSuccessToken(booking.id, booking.bookingRef),
      } satisfies SquareFinalizeResult;
    }

    if (!isPayableBookingStatus(booking.bookingStatus)) {
      return { status: "IGNORED", bookingId: booking.id } satisfies SquareFinalizeResult;
    }

    const bookingItems = await tx.bookingItem.findMany({
      where: { bookingId: booking.id },
      select: {
        variantId: true,
        quantity: true,
        productName: true,
      },
    });

    for (const item of bookingItems) {
      const variant = await tx.productVariant.findUnique({
        where: { id: item.variantId },
        select: { stock: true },
      });

      // stock === null means unlimited / untracked → never decrement, always available.
      if (variant && variant.stock === null) {
        continue;
      }

      const updated = await tx.productVariant.updateMany({
        where: {
          id: item.variantId,
          stock: { gte: item.quantity },
        },
        data: {
          stock: { decrement: item.quantity },
        },
      });

      if (updated.count === 0) {
        const expired = await markPaidExpired(tx, {
          bookingId: booking.id,
          reason: "PAYMENT_CAPTURED_PRODUCT_UNAVAILABLE",
          orderId: input.orderId,
          paymentId: input.paymentId,
          amount: input.amount,
        });
        return {
          status: "PAID_EXPIRED",
          bookingId: expired.id,
          bookingRef: expired.bookingRef,
        } satisfies SquareFinalizeResult;
      }
    }

    const updatedBooking = await tx.booking.update({
      where: { id: booking.id },
      data: {
        paymentStatus: "PAID",
        bookingStatus: "CONFIRMED",
        paymentProvider: "SQUARE",
        paymentOrderId: input.orderId,
        paymentTransactionId: input.paymentId,
        paymentSignature: null,
        paymentCheckoutUrl: null,
        remainingPayable: Math.max(booking.totalAmount - booking.advancePaid, 0),
      },
    });

    await tx.couponUsage.updateMany({
      where: {
        bookingId: booking.id,
        status: "RESERVED",
      },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });

    await markSquarePaymentAttemptPaid(tx, {
      bookingId: booking.id,
      orderId: input.orderId,
      paymentId: input.paymentId,
      amount: input.amount,
    });

    logBookingSafetyEvent("PAYMENT_CONFIRMED_BOOKING", {
      provider: "SQUARE",
      bookingId: updatedBooking.id,
      paymentId: input.paymentId,
      orderId: input.orderId,
    });

    return {
      status: "CONFIRMED",
      bookingId: updatedBooking.id,
      bookingRef: updatedBooking.bookingRef,
      successToken: createSuccessToken(updatedBooking.id, updatedBooking.bookingRef),
    } satisfies SquareFinalizeResult;
  });
}
