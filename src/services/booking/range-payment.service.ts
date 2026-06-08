import { Prisma, type PaymentStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { createSuccessToken } from "@/services/booking/successToken.server";

export type RangePaymentProvider = "SQUARE" | "RAZORPAY";

export class RangePaymentError extends Error {
  constructor(
    public readonly code:
      | "RANGE_PAYMENT_DISABLED"
      | "BOOKING_NOT_FOUND"
      | "BOOKING_INVALID_STATE"
      | "LOCK_VERSION_MISMATCH"
      | "SESSION_EXPIRED"
      | "RANGE_UNAVAILABLE"
      | "PAYMENT_ATTEMPT_NOT_FOUND",
    message: string
  ) {
    super(message);
  }
}

export type RangePaymentFinalizeResult = {
  status: "CONFIRMED" | "ALREADY_CONFIRMED" | "MANUAL_REVIEW" | "IGNORED";
  bookingId?: string;
  bookingRef?: string;
  successToken?: string;
  reason?: string;
};

function enabled(name: string) {
  return String(process.env[name] ?? "false").toLowerCase() === "true";
}

export function isRangePaymentCreationEnabled(provider: RangePaymentProvider) {
  return (
    enabled("RANGE_PAYMENT_CREATION_ENABLED") &&
    enabled(`${provider}_RANGE_PAYMENTS_ENABLED`)
  );
}

export function isRangePaymentFinalizationEnabled() {
  return enabled("RANGE_PAYMENT_FINALIZATION_ENABLED");
}

async function acquireScheduleLock(
  tx: Prisma.TransactionClient,
  theatreId: string,
  eventDate: Date
) {
  const dateKey = eventDate.toISOString().slice(0, 10);
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${theatreId}),
      hashtext(${dateKey})
    )::text AS "lock"
  `;
}

async function getRangeConflicts(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    lockId: string;
    theatreId: string;
    eventDate: Date;
    startsAtUtc: Date;
    occupiedUntilUtc: Date;
    now: Date;
  }
) {
  const [booking, lock, block] = await Promise.all([
    tx.booking.findFirst({
      where: {
        id: { not: input.bookingId },
        theatreId: input.theatreId,
        bookingStatus: "CONFIRMED",
        startsAtUtc: { lt: input.occupiedUntilUtc },
        occupiedUntilUtc: { gt: input.startsAtUtc },
      },
      select: { id: true },
    }),
    tx.bookingLock.findFirst({
      where: {
        id: { not: input.lockId },
        theatreId: input.theatreId,
        status: "ACTIVE",
        expiresAt: { gt: input.now },
        startsAtUtc: { lt: input.occupiedUntilUtc },
        occupiedUntilUtc: { gt: input.startsAtUtc },
      },
      select: { id: true },
    }),
    tx.availabilityBlock.findFirst({
      where: {
        theatreId: input.theatreId,
        eventDate: input.eventDate,
        isActive: true,
        startsAtUtc: { lt: input.occupiedUntilUtc },
        endsAtUtc: { gt: input.startsAtUtc },
      },
      select: { id: true },
    }),
  ]);
  return { booking, lock, block };
}

function scheduleMatches(
  booking: {
    startsAtUtc: Date | null;
    endsAtUtc: Date | null;
    occupiedUntilUtc: Date | null;
  },
  lock: {
    startsAtUtc: Date;
    endsAtUtc: Date;
    occupiedUntilUtc: Date;
  }
) {
  return (
    booking.startsAtUtc?.getTime() === lock.startsAtUtc.getTime() &&
    booking.endsAtUtc?.getTime() === lock.endsAtUtc.getTime() &&
    booking.occupiedUntilUtc?.getTime() === lock.occupiedUntilUtc.getTime()
  );
}

export async function beginRangePaymentAttempt(input: {
  bookingId: string;
  bookingLockVersion: number;
  provider: RangePaymentProvider;
  amount: number;
  now?: Date;
}) {
  if (!isRangePaymentCreationEnabled(input.provider)) {
    throw new RangePaymentError(
      "RANGE_PAYMENT_DISABLED",
      "Range payment creation is disabled."
    );
  }
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM "Booking" WHERE id = ${input.bookingId} FOR UPDATE
    `;
    const booking = await tx.booking.findUnique({
      where: { id: input.bookingId },
    });
    if (!booking || booking.slotId !== null || !booking.theatreId || !booking.eventDate) {
      throw new RangePaymentError("BOOKING_NOT_FOUND", "Range booking not found.");
    }
    if (
      booking.lockVersion !== input.bookingLockVersion ||
      booking.lockVersion === null
    ) {
      throw new RangePaymentError(
        "LOCK_VERSION_MISMATCH",
        "The payment request uses a stale booking lock."
      );
    }
    if (
      booking.bookingStatus !== "AWAITING_PAYMENT" &&
      booking.bookingStatus !== "PAYMENT_PROCESSING"
    ) {
      throw new RangePaymentError(
        "BOOKING_INVALID_STATE",
        "Booking is not ready for payment."
      );
    }
    if (!booking.termsAcceptedAt || booking.totalAmount <= 0) {
      throw new RangePaymentError(
        "BOOKING_INVALID_STATE",
        "Booking agreement or amount is incomplete."
      );
    }

    await acquireScheduleLock(tx, booking.theatreId, booking.eventDate);
    const lock = await tx.bookingLock.findUnique({
      where: {
        bookingId_version: {
          bookingId: booking.id,
          version: input.bookingLockVersion,
        },
      },
    });
    if (!lock || !scheduleMatches(booking, lock)) {
      throw new RangePaymentError(
        "LOCK_VERSION_MISMATCH",
        "Booking schedule does not match its payment lock."
      );
    }
    if (lock.status !== "ACTIVE" || lock.expiresAt <= now) {
      await tx.bookingLock.updateMany({
        where: { id: lock.id, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      });
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          bookingStatus: "ABANDONED",
          paymentStatus: "EXPIRED",
          cancelledReason: "PAYMENT_LOCK_EXPIRED",
          cancelledAt: now,
        },
      });
      throw new RangePaymentError("SESSION_EXPIRED", "Booking lock has expired.");
    }

    const conflicts = await getRangeConflicts(tx, {
      bookingId: booking.id,
      lockId: lock.id,
      theatreId: lock.theatreId,
      eventDate: lock.eventDate,
      startsAtUtc: lock.startsAtUtc,
      occupiedUntilUtc: lock.occupiedUntilUtc,
      now,
    });
    if (conflicts.booking || conflicts.lock || conflicts.block) {
      throw new RangePaymentError(
        "RANGE_UNAVAILABLE",
        "The selected range is no longer available."
      );
    }

    const baseIdempotencyKey =
      `range:${input.provider}:${booking.id}:v${input.bookingLockVersion}`;
    const existing = await tx.payment.findFirst({
      where: {
        bookingId: booking.id,
        provider: input.provider,
        bookingLockVersion: input.bookingLockVersion,
        status: { in: ["INITIALIZED", "AWAITING_PAYMENT"] },
      },
      orderBy: { createdAt: "desc" },
    });
    const attemptCount = existing
      ? 0
      : await tx.payment.count({
          where: {
            bookingId: booking.id,
            provider: input.provider,
            bookingLockVersion: input.bookingLockVersion,
          },
        });
    const idempotencyKey =
      attemptCount === 0
        ? baseIdempotencyKey
        : `${baseIdempotencyKey}:attempt${attemptCount + 1}`;
    const payment =
      existing ??
      (await tx.payment.create({
        data: {
          bookingId: booking.id,
          provider: input.provider,
          bookingLockVersion: input.bookingLockVersion,
          idempotencyKey,
          amount: input.amount,
          status: "INITIALIZED",
          method: "ONLINE",
        },
      }));
    if (payment.bookingLockVersion !== booking.lockVersion) {
      throw new RangePaymentError(
        "LOCK_VERSION_MISMATCH",
        "Existing payment attempt belongs to a stale lock."
      );
    }
    return { booking, lock, payment, idempotencyKey };
  });
}

export async function completeRangePaymentAttempt(input: {
  paymentId: string;
  providerOrderId: string;
  providerPaymentId?: string;
  providerPayload?: Prisma.InputJsonValue;
  checkoutUrl?: string;
  paymentLinkId?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.payment.findUnique({
      where: { id: input.paymentId },
    });
    if (!attempt || attempt.bookingLockVersion === null) {
      throw new RangePaymentError(
        "PAYMENT_ATTEMPT_NOT_FOUND",
        "Range payment attempt not found."
      );
    }
    await tx.$queryRaw`
      SELECT id FROM "Booking" WHERE id = ${attempt.bookingId} FOR UPDATE
    `;
    const booking = await tx.booking.findUnique({
      where: { id: attempt.bookingId },
    });
    if (
      !booking ||
      !booking.theatreId ||
      !booking.eventDate ||
      booking.lockVersion !== attempt.bookingLockVersion
    ) {
      await tx.payment.update({
        where: { id: attempt.id },
        data: { status: "CANCELLED", providerPayload: input.providerPayload },
      });
      throw new RangePaymentError(
        "LOCK_VERSION_MISMATCH",
        "Payment attempt belongs to a stale lock."
      );
    }
    await acquireScheduleLock(tx, booking.theatreId, booking.eventDate);
    const lock = await tx.bookingLock.findUnique({
      where: {
        bookingId_version: {
          bookingId: booking.id,
          version: attempt.bookingLockVersion,
        },
      },
    });
    if (!lock || lock.status !== "ACTIVE" || lock.expiresAt <= now) {
      if (lock) {
        await tx.bookingLock.updateMany({
          where: { id: lock.id, status: "ACTIVE" },
          data: { status: "EXPIRED" },
        });
      }
      await tx.payment.update({
        where: { id: attempt.id },
        data: {
          status: "EXPIRED",
          providerOrderId: input.providerOrderId,
          transactionId: input.providerOrderId,
          providerPayload: input.providerPayload,
        },
      });
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          bookingStatus: "ABANDONED",
          paymentStatus: "EXPIRED",
          cancelledReason: "PAYMENT_LOCK_EXPIRED",
          cancelledAt: now,
        },
      });
      throw new RangePaymentError("SESSION_EXPIRED", "Booking lock has expired.");
    }

    const payment = await tx.payment.update({
      where: { id: attempt.id },
      data: {
        status: "AWAITING_PAYMENT",
        providerOrderId: input.providerOrderId,
        providerPaymentId: input.providerPaymentId,
        transactionId: input.providerOrderId,
        providerPayload: input.providerPayload,
        method: input.paymentLinkId
          ? `HOSTED_CHECKOUT:${input.paymentLinkId}`
          : "ONLINE",
      },
    });
    const providerData =
      attempt.provider === "SQUARE"
        ? {
            paymentProvider: "SQUARE",
            paymentOrderId: input.providerOrderId,
            paymentCheckoutUrl: input.checkoutUrl ?? null,
          }
        : {
            paymentProvider: "RAZORPAY",
            paymentOrderId: input.providerOrderId,
            razorpayOrderId: input.providerOrderId,
          };
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        ...providerData,
        bookingStatus: "PAYMENT_PROCESSING",
        paymentStatus: "AWAITING_PAYMENT",
        advancePaid: attempt.amount,
        remainingPayable: Math.max(booking.totalAmount - attempt.amount, 0),
      },
    });
    return payment;
  });
}

async function markManualReview(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    paymentId: string;
    provider: RangePaymentProvider;
    providerOrderId: string;
    providerPaymentId: string;
    providerPayload: Prisma.InputJsonValue;
    reason: string;
    now: Date;
    lockId?: string;
    lockExpired?: boolean;
  }
) {
  if (input.lockId) {
    await tx.bookingLock.updateMany({
      where: { id: input.lockId, status: "ACTIVE" },
      data: { status: input.lockExpired ? "EXPIRED" : "RELEASED" },
    });
  }
  await tx.bookingLock.updateMany({
    where: {
      bookingId: input.bookingId,
      status: "ACTIVE",
      ...(input.lockId ? { id: { not: input.lockId } } : {}),
    },
    data: { status: "RELEASED" },
  });
  const booking = await tx.booking.update({
    where: { id: input.bookingId },
    data: {
      bookingStatus: "ABANDONED",
      paymentStatus: "MANUAL_REVIEW",
      cancelledReason: input.reason,
      cancelledAt: input.now,
      paymentProvider: input.provider,
      paymentOrderId: input.providerOrderId,
      paymentTransactionId: input.providerPaymentId,
      paymentCheckoutUrl: null,
      ...(input.provider === "RAZORPAY"
        ? {
            razorpayOrderId: input.providerOrderId,
            razorpayPaymentId: input.providerPaymentId,
          }
        : {}),
    },
  });
  await tx.payment.update({
    where: { id: input.paymentId },
    data: {
      status: "MANUAL_REVIEW",
      providerOrderId: input.providerOrderId,
      providerPaymentId: input.providerPaymentId,
      transactionId: input.providerPaymentId,
      providerPayload: input.providerPayload,
    },
  });
  return booking;
}

export async function finalizeRangePayment(input: {
  provider: RangePaymentProvider;
  bookingId?: string;
  providerOrderId: string;
  providerPaymentId: string;
  providerPayload: Prisma.InputJsonValue;
  amount: number;
  now?: Date;
}): Promise<RangePaymentFinalizeResult> {
  if (!isRangePaymentFinalizationEnabled()) {
    throw new RangePaymentError(
      "RANGE_PAYMENT_DISABLED",
      "Range payment finalization is disabled."
    );
  }
  const now = input.now ?? new Date();
  const existingPaymentByTransaction = await prisma.payment.findFirst({
    where: {
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
    },
  });
  const existingPayment =
    existingPaymentByTransaction ??
    (await prisma.payment.findFirst({
    where: {
      provider: input.provider,
      providerOrderId: input.providerOrderId,
    },
  }));
  if (!existingPayment || existingPayment.bookingLockVersion === null) {
    return { status: "IGNORED" };
  }
  if (input.bookingId && existingPayment.bookingId !== input.bookingId) {
    return { status: "IGNORED" };
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM "Booking"
      WHERE id = ${existingPayment.bookingId}
      FOR UPDATE
    `;
    const booking = await tx.booking.findUnique({
      where: { id: existingPayment.bookingId },
    });
    const payment = await tx.payment.findUnique({
      where: { id: existingPayment.id },
    });
    if (!booking || !payment) return { status: "IGNORED" };

    if (
      payment.providerPaymentId === input.providerPaymentId &&
      payment.status === "PAID" &&
      booking.bookingStatus === "CONFIRMED"
    ) {
      return {
        status: "ALREADY_CONFIRMED",
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        successToken: createSuccessToken(booking.id, booking.bookingRef),
      };
    }
    if (
      booking.bookingStatus === "CONFIRMED" &&
      booking.paymentStatus === "PAID" &&
      payment.providerPaymentId !== input.providerPaymentId
    ) {
      const duplicate = await tx.payment.create({
        data: {
          bookingId: booking.id,
          provider: input.provider,
          providerPaymentId: input.providerPaymentId,
          bookingLockVersion: payment.bookingLockVersion,
          providerPayload: input.providerPayload,
          transactionId: input.providerPaymentId,
          method: "DUPLICATE_CAPTURE",
          amount: input.amount,
          status: "MANUAL_REVIEW",
        },
      });
      return {
        status: "MANUAL_REVIEW",
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        reason: `DUPLICATE_CAPTURE:${duplicate.id}`,
      };
    }
    if (
      payment.providerPaymentId === input.providerPaymentId &&
      payment.status === "MANUAL_REVIEW"
    ) {
      return {
        status: "MANUAL_REVIEW",
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
        reason: booking.cancelledReason ?? "PAYMENT_REQUIRES_MANUAL_REVIEW",
      };
    }

    let lock = null;
    if (booking.lockVersion !== null) {
      lock = await tx.bookingLock.findUnique({
        where: {
          bookingId_version: {
            bookingId: booking.id,
            version: payment.bookingLockVersion!,
          },
        },
      });
    }
    const versionMatches =
      booking.lockVersion !== null &&
      payment.bookingLockVersion === booking.lockVersion;
    if (
      !booking.theatreId ||
      !booking.eventDate ||
      !lock ||
      !versionMatches ||
      !scheduleMatches(booking, lock)
    ) {
      const reviewed = await markManualReview(tx, {
        bookingId: booking.id,
        paymentId: payment.id,
        provider: input.provider,
        providerOrderId: input.providerOrderId,
        providerPaymentId: input.providerPaymentId,
        providerPayload: input.providerPayload,
        reason: "PAYMENT_LOCK_VERSION_MISMATCH",
        now,
        lockId: lock?.id,
      });
      return {
        status: "MANUAL_REVIEW",
        bookingId: reviewed.id,
        bookingRef: reviewed.bookingRef,
        reason: "PAYMENT_LOCK_VERSION_MISMATCH",
      };
    }

    await acquireScheduleLock(tx, booking.theatreId, booking.eventDate);
    if (lock.status !== "ACTIVE" || lock.expiresAt <= now) {
      const reviewed = await markManualReview(tx, {
        bookingId: booking.id,
        paymentId: payment.id,
        provider: input.provider,
        providerOrderId: input.providerOrderId,
        providerPaymentId: input.providerPaymentId,
        providerPayload: input.providerPayload,
        reason: "PAYMENT_CAPTURED_LOCK_EXPIRED",
        now,
        lockId: lock.id,
        lockExpired: true,
      });
      return {
        status: "MANUAL_REVIEW",
        bookingId: reviewed.id,
        bookingRef: reviewed.bookingRef,
        reason: "PAYMENT_CAPTURED_LOCK_EXPIRED",
      };
    }

    const conflicts = await getRangeConflicts(tx, {
      bookingId: booking.id,
      lockId: lock.id,
      theatreId: lock.theatreId,
      eventDate: lock.eventDate,
      startsAtUtc: lock.startsAtUtc,
      occupiedUntilUtc: lock.occupiedUntilUtc,
      now,
    });
    if (conflicts.booking || conflicts.lock || conflicts.block) {
      const reviewed = await markManualReview(tx, {
        bookingId: booking.id,
        paymentId: payment.id,
        provider: input.provider,
        providerOrderId: input.providerOrderId,
        providerPaymentId: input.providerPaymentId,
        providerPayload: input.providerPayload,
        reason: "PAYMENT_CAPTURED_RANGE_UNAVAILABLE",
        now,
        lockId: lock.id,
      });
      return {
        status: "MANUAL_REVIEW",
        bookingId: reviewed.id,
        bookingRef: reviewed.bookingRef,
        reason: "PAYMENT_CAPTURED_RANGE_UNAVAILABLE",
      };
    }

    const bookingItems = await tx.bookingItem.findMany({
      where: { bookingId: booking.id },
      select: { variantId: true, quantity: true },
    });
    for (const item of bookingItems) {
      const variant = await tx.productVariant.findUnique({
        where: { id: item.variantId },
        select: { stock: true },
      });
      if (!variant || variant.stock < item.quantity) {
        const reviewed = await markManualReview(tx, {
          bookingId: booking.id,
          paymentId: payment.id,
          provider: input.provider,
          providerOrderId: input.providerOrderId,
          providerPaymentId: input.providerPaymentId,
          providerPayload: input.providerPayload,
          reason: "PAYMENT_CAPTURED_PRODUCT_UNAVAILABLE",
          now,
          lockId: lock.id,
        });
        return {
          status: "MANUAL_REVIEW",
          bookingId: reviewed.id,
          bookingRef: reviewed.bookingRef,
          reason: "PAYMENT_CAPTURED_PRODUCT_UNAVAILABLE",
        };
      }
    }
    for (const item of bookingItems) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        bookingStatus: "CONFIRMED",
        paymentStatus: "PAID",
        paymentProvider: input.provider,
        paymentOrderId: input.providerOrderId,
        paymentTransactionId: input.providerPaymentId,
        paymentCheckoutUrl: null,
        advancePaid: input.amount > 0 ? input.amount : payment.amount,
        remainingPayable: Math.max(
          booking.totalAmount - (input.amount > 0 ? input.amount : payment.amount),
          0
        ),
        ...(input.provider === "RAZORPAY"
          ? {
              razorpayOrderId: input.providerOrderId,
              razorpayPaymentId: input.providerPaymentId,
            }
          : {}),
      },
    });
    await tx.bookingLock.update({
      where: { id: lock.id },
      data: { status: "CONSUMED" },
    });
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        providerOrderId: input.providerOrderId,
        providerPaymentId: input.providerPaymentId,
        transactionId: input.providerPaymentId,
        providerPayload: input.providerPayload,
      },
    });
    await tx.couponUsage.updateMany({
      where: { bookingId: booking.id, status: "RESERVED" },
      data: { status: "CONFIRMED", confirmedAt: now },
    });
    return {
      status: "CONFIRMED",
      bookingId: updated.id,
      bookingRef: updated.bookingRef,
      successToken: createSuccessToken(updated.id, updated.bookingRef),
    };
  });
}

export function paymentStatusForRangeFailure(
  lockIsActive: boolean
): PaymentStatus {
  return lockIsActive ? "FAILED" : "EXPIRED";
}
