import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createSuccessToken } from "@/services/booking/successToken.server";
import {
  isStrictLockExpired,
  releaseSiblingSessionLocks,
} from "@/services/booking/booking-lock-lifecycle.service";
import {
  BookingOverlapError,
  lockSlotRowForUpdate,
  logBookingSafetyEvent,
  validateNoOverlappingActiveBooking,
} from "@/services/booking/booking-safety.service";

export type SquareFinalizeResult = {
  status: "CONFIRMED" | "ALREADY_CONFIRMED" | "PAID_EXPIRED" | "IGNORED";
  bookingId?: string;
  bookingRef?: string;
  successToken?: string;
};

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
    slotId: string | null;
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

  if (input.slotId) {
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

  await markSquarePaymentAttemptPaid(tx, {
    bookingId: input.bookingId,
    orderId: input.orderId,
    paymentId: input.paymentId,
    amount: input.amount,
  });

  return booking;
}

export async function finalizeSquarePayment(input: {
  orderId: string;
  paymentId: string;
  amount: number;
}) {
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
      include: {
        slot: true,
        theatre: true,
      },
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

    if (!booking.slotId || !booking.slot) {
      const expired = await markPaidExpired(tx, {
        bookingId: booking.id,
        slotId: booking.slotId,
        reason: "PAYMENT_CAPTURED_SLOT_UNAVAILABLE",
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

    await lockSlotRowForUpdate(tx, {
      slotId: booking.slotId,
      context: "square-finalize-payment",
    });

    const lockedSlot = await tx.slot.findUnique({
      where: { id: booking.slotId },
    });

    if (
      !lockedSlot ||
      lockedSlot.status !== "LOCKED" ||
      isStrictLockExpired({
        id: booking.id,
        bookingStatus: booking.bookingStatus,
        slotId: booking.slotId,
        slot: booking.slot,
      }, new Date())
    ) {
      const expired = await markPaidExpired(tx, {
        bookingId: booking.id,
        slotId: booking.slotId,
        reason: "PAYMENT_CAPTURED_SESSION_EXPIRED",
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

    if (!isPayableBookingStatus(booking.bookingStatus)) {
      return { status: "IGNORED", bookingId: booking.id } satisfies SquareFinalizeResult;
    }

    try {
      await validateNoOverlappingActiveBooking(tx, {
        theatreId: booking.theatreId ?? lockedSlot.theatreId,
        date: lockedSlot.date,
        startTime: lockedSlot.startTime,
        endTime: lockedSlot.endTime,
        excludeBookingId: booking.id,
        context: "square-finalize-payment",
      });
    } catch (error) {
      if (!(error instanceof BookingOverlapError)) throw error;

      const expired = await markPaidExpired(tx, {
        bookingId: booking.id,
        slotId: booking.slotId,
        reason: "PAYMENT_CAPTURED_SLOT_UNAVAILABLE",
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

    const bookingItems = await tx.bookingItem.findMany({
      where: { bookingId: booking.id },
      select: {
        variantId: true,
        quantity: true,
        productName: true,
      },
    });

    for (const item of bookingItems) {
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
          slotId: booking.slotId,
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

    await tx.slot.update({
      where: { id: booking.slotId },
      data: {
        status: "BOOKED",
        lockedAt: null,
        lockExpiresAt: null,
        lockedBy: null,
      },
    });

    if (lockedSlot.lockedBy) {
      await releaseSiblingSessionLocks(tx, {
        lockOwner: lockedSlot.lockedBy,
        keepSlotId: booking.slotId,
        now: new Date(),
        cancelledReason: "AUTO_RELEASED_AFTER_CONFIRMATION",
      });
    }

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
      slotId: booking.slotId,
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
