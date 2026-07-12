import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { ACTIVE_RANGE_HOLD_STATUSES } from "@/lib/booking-policy";
import { isReviewWorkflowBookingStatus } from "@/lib/booking-status";

type DbClient = Prisma.TransactionClient | typeof prisma;

export type RangeBookingSessionIdentity = {
  bookingId: string;
  lockOwner: string;
  lockVersion: number | null;
};

export class RangeBookingSessionError extends Error {
  constructor(
    public readonly code:
      | "SESSION_EXPIRED"
      | "BOOKING_SUBMITTED"
      | "LOCK_VERSION_MISMATCH"
      | "BOOKING_NOT_FOUND",
    message: string
  ) {
    super(message);
  }
}

export async function requireActiveRangeBookingSession(
  identity: RangeBookingSessionIdentity,
  now = new Date(),
  db: DbClient = prisma
) {
  const booking = await db.booking.findUnique({
    where: { id: identity.bookingId },
    include: {
      eventPackage: { include: { location: true } },
      items: {
        include: {
          product: { select: { image: true, slug: true } },
        },
      },
      couponUsages: {
        where: { status: { in: ["RESERVED", "CONFIRMED"] } },
        include: { coupon: true },
        orderBy: { reservedAt: "asc" },
      },
    },
  });
  if (!booking) {
    throw new RangeBookingSessionError(
      "BOOKING_NOT_FOUND",
      "Booking not found."
    );
  }
  if (booking.bookingStatus === "CONFIRMED") {
    return { booking };
  }
  // A submitted or decided booking is finished, not expired. Callers must be
  // able to tell the difference: an expired hold warrants a "session expired"
  // notice, whereas a submitted booking should simply start a new session.
  if (isReviewWorkflowBookingStatus(booking.bookingStatus)) {
    throw new RangeBookingSessionError(
      "BOOKING_SUBMITTED",
      "This booking has already been submitted for review."
    );
  }
  if (
    !ACTIVE_RANGE_HOLD_STATUSES.includes(
      booking.bookingStatus as (typeof ACTIVE_RANGE_HOLD_STATUSES)[number]
    ) ||
    !booking.holdExpiresAt ||
    booking.holdExpiresAt.getTime() <= now.getTime()
  ) {
    throw new RangeBookingSessionError(
      "SESSION_EXPIRED",
      "The booking hold has expired."
    );
  }
  if (
    identity.lockVersion === null ||
    booking.lockVersion === null ||
    booking.lockVersion !== identity.lockVersion
  ) {
    throw new RangeBookingSessionError(
      "LOCK_VERSION_MISMATCH",
      "The booking lock version is stale."
    );
  }

  return { booking };
}
