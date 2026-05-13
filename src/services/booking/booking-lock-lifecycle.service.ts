import {
  BookingStatus,
  PaymentStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { PAYMENT_STEP_ABANDONED_REASON } from "@/lib/admin-booking-status";

type DbClient = Prisma.TransactionClient | PrismaClient;

export const ACTIVE_LOCK_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.INCOMPLETE,
  BookingStatus.AWAITING_PAYMENT,
  BookingStatus.PAYMENT_PROCESSING,
];
const ABANDONABLE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.INCOMPLETE,
  BookingStatus.AWAITING_PAYMENT,
  BookingStatus.PAYMENT_PROCESSING,
];

function resolveAbandonmentReason(
  bookingStatus: BookingStatus,
  cancelledReason: string
) {
  if (
    bookingStatus === BookingStatus.AWAITING_PAYMENT ||
    bookingStatus === BookingStatus.PAYMENT_PROCESSING
  ) {
    return PAYMENT_STEP_ABANDONED_REASON;
  }

  return cancelledReason;
}

export async function resolveTerminalAbandonedPaymentStatus(
  db: DbClient,
  bookingId: string
) {
  const latestPaymentAttempt = await db.payment.findFirst({
    where: { bookingId },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      method: true,
    },
  });

  if (
    latestPaymentAttempt?.status === PaymentStatus.CANCELLED &&
    latestPaymentAttempt.method?.startsWith("CHECKOUT_DISMISSED")
  ) {
    return PaymentStatus.CANCELLED;
  }

  return PaymentStatus.EXPIRED;
}

type BookingLockSnapshot = {
  id: string;
  bookingStatus: BookingStatus;
  slotId: string;
  slot: {
    status: string;
    lockExpiresAt: Date | null;
  } | null;
};

type ExpireLockInput = {
  bookingId: string;
  slotId: string;
  now?: Date;
  cancelledReason?: string;
};

type ReleaseSiblingLocksInput = {
  lockOwner: string;
  keepSlotId: string;
  now?: Date;
  cancelledReason?: string;
};

export function isStrictLockExpired(
  booking: BookingLockSnapshot,
  now = new Date()
) {
  if (!booking.slot) return false;
  if (!ACTIVE_LOCK_BOOKING_STATUSES.includes(booking.bookingStatus)) return false;
  if (booking.slot.status !== "LOCKED") return false;
  if (!booking.slot.lockExpiresAt) return false;
  return booking.slot.lockExpiresAt.getTime() <= now.getTime();
}

export async function expireBookingLockSession(
  db: DbClient,
  {
    bookingId,
    slotId,
    now = new Date(),
    cancelledReason = "SESSION_EXPIRED",
  }: ExpireLockInput
) {
  const bookingToRelease = await db.booking.findFirst({
    where: {
      id: bookingId,
      bookingStatus: { in: ACTIVE_LOCK_BOOKING_STATUSES },
      OR: [{ createdByRole: null }, { createdByRole: { not: "ADMIN" } }],
    },
    select: {
      id: true,
      bookingStatus: true,
    },
  });

  // Guard: never alter slot/coupon lifecycle for admin-created bookings
  // and non-active booking states.
  if (!bookingToRelease) {
    return { abandonedBookingIds: [] as string[] };
  }

  let abandonedBookingIds: string[] = [];
  if (ABANDONABLE_BOOKING_STATUSES.includes(bookingToRelease.bookingStatus)) {
    await db.booking.updateMany({
      where: {
        id: bookingToRelease.id,
      },
      data: {
        bookingStatus: BookingStatus.ABANDONED,
        cancelledAt: now,
        cancelledReason: resolveAbandonmentReason(
          bookingToRelease.bookingStatus,
          cancelledReason
        ),
        ...(bookingToRelease.bookingStatus === BookingStatus.INCOMPLETE
          ? {}
          : {
              paymentStatus: await resolveTerminalAbandonedPaymentStatus(
                db,
                bookingToRelease.id
              ),
            }),
      },
    });
    abandonedBookingIds = [bookingToRelease.id];
  }

  await db.slot.updateMany({
    where: {
      id: slotId,
      status: "LOCKED",
      lockExpiresAt: { lte: now },
    },
    data: {
      status: "AVAILABLE",
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
    },
  });

  await db.couponUsage.updateMany({
    where: {
      bookingId,
      status: "RESERVED",
    },
    data: {
      status: "RELEASED",
      discountAmount: 0,
      releasedAt: now,
      confirmedAt: null,
    },
  });

  return { abandonedBookingIds };
}

export async function releaseSiblingSessionLocks(
  db: DbClient,
  {
    lockOwner,
    keepSlotId,
    now = new Date(),
    cancelledReason = "SESSION_SLOT_SWITCHED",
  }: ReleaseSiblingLocksInput
) {
  const siblingLockedSlots = await db.slot.findMany({
    where: {
      status: "LOCKED",
      lockedBy: lockOwner,
      id: { not: keepSlotId },
    },
    select: { id: true },
  });

  if (siblingLockedSlots.length === 0) {
    return { releasedSlotIds: [] as string[], releasedBookingIds: [] as string[] };
  }

  const siblingSlotIds = siblingLockedSlots.map((slot) => slot.id);
  const siblingBookingsToRelease = await db.booking.findMany({
    where: {
      slotId: { in: siblingSlotIds },
      bookingStatus: { in: ACTIVE_LOCK_BOOKING_STATUSES },
      OR: [{ createdByRole: null }, { createdByRole: { not: "ADMIN" } }],
    },
    select: { id: true, slotId: true, bookingStatus: true },
  });
  const siblingBookingIds = siblingBookingsToRelease.map((booking) => booking.id);
  const abandonedSiblingBookingIds = siblingBookingsToRelease
    .filter((booking) => ABANDONABLE_BOOKING_STATUSES.includes(booking.bookingStatus))
    .map((booking) => booking.id);
  const paymentStageSiblingBookingIds = siblingBookingsToRelease
    .filter(
      (booking) =>
        booking.bookingStatus === BookingStatus.AWAITING_PAYMENT ||
        booking.bookingStatus === BookingStatus.PAYMENT_PROCESSING
    )
    .map((booking) => booking.id);
  const standardSiblingBookingIds = siblingBookingsToRelease
    .filter((booking) => booking.bookingStatus === BookingStatus.INCOMPLETE)
    .map((booking) => booking.id);
  const releasableSlotIds = Array.from(
    new Set(siblingBookingsToRelease.map((booking) => booking.slotId))
  );

  if (releasableSlotIds.length === 0) {
    return { releasedSlotIds: [] as string[], releasedBookingIds: [] as string[] };
  }

  await db.slot.updateMany({
    where: {
      id: { in: releasableSlotIds },
      status: "LOCKED",
      lockedBy: lockOwner,
    },
    data: {
      status: "AVAILABLE",
      lockedAt: null,
      lockExpiresAt: null,
      lockedBy: null,
    },
  });

  if (standardSiblingBookingIds.length > 0) {
    await db.booking.updateMany({
      where: {
        id: { in: standardSiblingBookingIds },
      },
      data: {
        bookingStatus: BookingStatus.ABANDONED,
        cancelledAt: now,
        cancelledReason,
      },
    });

  }

  if (paymentStageSiblingBookingIds.length > 0) {
    for (const booking of siblingBookingsToRelease) {
      if (!paymentStageSiblingBookingIds.includes(booking.id)) continue;
      await db.booking.updateMany({
        where: {
          id: booking.id,
        },
        data: {
          bookingStatus: BookingStatus.ABANDONED,
          cancelledAt: now,
          cancelledReason: PAYMENT_STEP_ABANDONED_REASON,
          paymentStatus: await resolveTerminalAbandonedPaymentStatus(
            db,
            booking.id
          ),
        },
      });
    }

  }

  await db.couponUsage.updateMany({
    where: {
      bookingId: { in: siblingBookingIds },
      status: "RESERVED",
    },
    data: {
      status: "RELEASED",
      discountAmount: 0,
      releasedAt: now,
      confirmedAt: null,
    },
  });

  return {
    releasedSlotIds: releasableSlotIds,
    releasedBookingIds: abandonedSiblingBookingIds,
  };
}
