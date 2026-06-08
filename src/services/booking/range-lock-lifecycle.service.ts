import type { Prisma } from "@prisma/client";

import { hashBookingLockOwner } from "@/lib/booking-lock-owner";
import { prisma } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function getCurrentRangeBookingLock(
  bookingId: string,
  lockOwner: string,
  lockVersion: number | null,
  now = new Date(),
  db: DbClient = prisma
) {
  const lock = await db.bookingLock.findFirst({
    where: {
      bookingId,
      lockOwnerHash: hashBookingLockOwner(lockOwner),
      version: lockVersion ?? undefined,
      status: "ACTIVE",
    },
    include: { booking: true },
    orderBy: { version: "desc" },
  });
  if (!lock) return null;
  if (lock.booking.lockVersion !== lock.version) return null;

  if (lock.expiresAt <= now) {
    await expireRangeBookingLocks(now, 100, prisma);
    return null;
  }
  return lock;
}

export async function releaseCurrentRangeBookingLock(
  bookingId: string,
  lockOwner: string,
  lockVersion: number | null
) {
  const ownerHash = hashBookingLockOwner(lockOwner);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(
        hashtext('range-lock-owner'),
        hashtext(${ownerHash})
      )::text AS "lock"
    `;
    const result = await tx.bookingLock.updateMany({
      where: {
        bookingId,
        lockOwnerHash: ownerHash,
        version: lockVersion ?? undefined,
        status: "ACTIVE",
      },
      data: { status: "RELEASED" },
    });
    if (result.count > 0) {
      await tx.booking.updateMany({
        where: {
          id: bookingId,
          bookingStatus: { in: ["INCOMPLETE", "AWAITING_PAYMENT"] },
        },
        data: { bookingStatus: "ABANDONED" },
      });
    }
    return result.count > 0;
  });
}

export async function expireRangeBookingLocks(
  now = new Date(),
  limit = 100,
  db: typeof prisma = prisma
) {
  return db.$transaction(async (tx) => {
    const [schedulerLock] = await tx.$queryRaw<Array<{ acquired: boolean }>>`
      SELECT pg_try_advisory_xact_lock(
        hashtext('range-lock-cleanup')
      ) AS "acquired"
    `;
    if (!schedulerLock?.acquired) {
      return { expiredLocks: 0, abandonedBookings: 0 };
    }

    const expired = await tx.bookingLock.findMany({
      where: { status: "ACTIVE", expiresAt: { lte: now } },
      select: { id: true, bookingId: true },
      orderBy: { expiresAt: "asc" },
      take: limit,
    });
    if (expired.length === 0) return { expiredLocks: 0, abandonedBookings: 0 };

    const updated = await tx.bookingLock.updateMany({
      where: { id: { in: expired.map((lock) => lock.id) }, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });
    const bookingIds = [...new Set(expired.map((lock) => lock.bookingId))];
    const abandoned = await tx.booking.updateMany({
      where: {
        id: { in: bookingIds },
        bookingStatus: {
          in: ["INCOMPLETE", "AWAITING_PAYMENT", "PAYMENT_PROCESSING"],
        },
        bookingLocks: { none: { status: "ACTIVE", expiresAt: { gt: now } } },
      },
      data: {
        bookingStatus: "ABANDONED",
        paymentStatus: "EXPIRED",
        cancelledReason: "PAYMENT_LOCK_EXPIRED",
        cancelledAt: now,
      },
    });
    await tx.payment.updateMany({
      where: {
        bookingId: { in: bookingIds },
        bookingLockVersion: { not: null },
        status: { in: ["INITIALIZED", "AWAITING_PAYMENT"] },
      },
      data: { status: "EXPIRED" },
    });
    return {
      expiredLocks: updated.count,
      abandonedBookings: abandoned.count,
    };
  });
}
