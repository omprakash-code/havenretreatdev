import type { BookingLock, Prisma } from "@prisma/client";
import { z } from "zod";

import { hashBookingLockOwner } from "@/lib/booking-lock-owner";
import {
  isBookingIntervalAligned,
  isDateKey,
  localBookingTimeToUtc,
  timeToMinutes,
  toBookingDate,
} from "@/lib/booking-range";
import { prisma } from "@/lib/db";
import {
  buildInitialPricingSnapshot,
  buildPackageSnapshot,
} from "@/services/booking/booking-snapshot.service";
import { getOrCreateBookingSettings } from "@/services/booking/booking-settings.service";
import { allocateBookingRef } from "@/services/booking/bookingId.service";

export const rangeBookingLockInputSchema = z.object({
  theatreId: z.string().trim().min(1),
  packageId: z.string().trim().min(1),
  eventDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
});

export type RangeBookingLockInput = z.infer<
  typeof rangeBookingLockInputSchema
>;

export type RangeBookingLockSession = {
  bookingId: string;
  lockVersion: number | null;
} | null;

export type RangeBookingLockErrorCode =
  | "INVALID_RANGE"
  | "OUTSIDE_BUSINESS_HOURS"
  | "MINIMUM_DURATION"
  | "CAPACITY_EXCEEDED"
  | "THEATRE_NOT_FOUND"
  | "PACKAGE_NOT_FOUND"
  | "BOOKING_CONFLICT"
  | "LOCK_CONFLICT"
  | "BLOCK_CONFLICT"
  | "PAYMENT_IN_PROGRESS"
  | "LOCK_SESSION_STALE";

export class RangeBookingLockError extends Error {
  constructor(
    public readonly code: RangeBookingLockErrorCode,
    message: string
  ) {
    super(message);
  }
}

type NormalizedRange = {
  eventDate: Date;
  startsAtUtc: Date;
  endsAtUtc: Date;
  occupiedUntilUtc: Date;
  durationMinutes: number;
};

function normalizeRange(
  input: Pick<RangeBookingLockInput, "eventDate" | "startTime" | "endTime">,
  settings: {
    businessOpenTime: string;
    businessCloseTime: string;
    minimumDurationMinutes: number;
    bufferMinutes: number;
  },
  timeZone: string
): NormalizedRange {
  if (
    !isDateKey(input.eventDate) ||
    !isBookingIntervalAligned(input.startTime) ||
    !isBookingIntervalAligned(input.endTime)
  ) {
    throw new RangeBookingLockError(
      "INVALID_RANGE",
      "Date and times must be valid and use 30-minute increments."
    );
  }

  const start = timeToMinutes(input.startTime);
  const end = timeToMinutes(input.endTime);
  const open = timeToMinutes(settings.businessOpenTime);
  const close = timeToMinutes(settings.businessCloseTime);
  if (
    start === null ||
    end === null ||
    open === null ||
    close === null ||
    end <= start
  ) {
    throw new RangeBookingLockError(
      "INVALID_RANGE",
      "End time must be after start time."
    );
  }
  if (start < open || end + settings.bufferMinutes > close) {
    throw new RangeBookingLockError(
      "OUTSIDE_BUSINESS_HOURS",
      "The booking and its buffer must fit within business hours."
    );
  }
  if (end - start < settings.minimumDurationMinutes) {
    throw new RangeBookingLockError(
      "MINIMUM_DURATION",
      `Booking must be at least ${settings.minimumDurationMinutes} minutes.`
    );
  }

  const startsAtUtc = localBookingTimeToUtc(
    input.eventDate,
    input.startTime,
    timeZone
  );
  const endsAtUtc = localBookingTimeToUtc(
    input.eventDate,
    input.endTime,
    timeZone
  );
  return {
    eventDate: toBookingDate(input.eventDate, timeZone),
    startsAtUtc,
    endsAtUtc,
    occupiedUntilUtc: new Date(
      endsAtUtc.getTime() + settings.bufferMinutes * 60_000
    ),
    durationMinutes: end - start,
  };
}

async function acquireTransactionLocks(
  tx: Prisma.TransactionClient,
  theatreId: string,
  dateKey: string,
  ownerHash: string
) {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtext('range-lock-owner'),
      hashtext(${ownerHash})
    )::text AS "lock"
  `;
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${theatreId}),
      hashtext(${dateKey})
    )::text AS "lock"
  `;
}

function isSameRange(lock: BookingLock, range: NormalizedRange) {
  return (
    lock.startsAtUtc.getTime() === range.startsAtUtc.getTime() &&
    lock.endsAtUtc.getTime() === range.endsAtUtc.getTime() &&
    lock.occupiedUntilUtc.getTime() === range.occupiedUntilUtc.getTime()
  );
}

export async function createOrReplaceRangeBookingLock(
  input: RangeBookingLockInput,
  lockOwner: string,
  session: RangeBookingLockSession,
  now = new Date()
) {
  const ownerHash = hashBookingLockOwner(lockOwner);

  return prisma.$transaction(async (tx) => {
    await acquireTransactionLocks(
      tx,
      input.theatreId,
      input.eventDate,
      ownerHash
    );

    const [settings, theatre, eventPackage] = await Promise.all([
      getOrCreateBookingSettings(input.theatreId, tx),
      tx.theatre.findFirst({
        where: { id: input.theatreId, isActive: true },
        select: { id: true, timezone: true },
      }),
      tx.eventPackage.findFirst({
        where: {
          id: input.packageId,
          isActive: true,
          venue: { isActive: true },
        },
        include: {
          venue: true,
          features: { orderBy: { sortOrder: "asc" } },
        },
      }),
    ]);
    if (!theatre) {
      throw new RangeBookingLockError(
        "THEATRE_NOT_FOUND",
        "The reservable venue is unavailable."
      );
    }
    if (!eventPackage) {
      throw new RangeBookingLockError(
        "PACKAGE_NOT_FOUND",
        "The selected package is unavailable."
      );
    }
    if (eventPackage.guestLimit > settings.maximumGuests) {
      throw new RangeBookingLockError(
        "CAPACITY_EXCEEDED",
        `Package guest count cannot exceed ${settings.maximumGuests}.`
      );
    }

    const range = normalizeRange(input, settings, theatre.timezone);
    if (range.startsAtUtc <= now) {
      throw new RangeBookingLockError(
        "INVALID_RANGE",
        "Booking start time must be in the future."
      );
    }

    await tx.bookingLock.updateMany({
      where: { status: "ACTIVE", expiresAt: { lte: now } },
      data: { status: "EXPIRED" },
    });

    const activeOwnerLock = await tx.bookingLock.findFirst({
      where: {
        lockOwnerHash: ownerHash,
        status: "ACTIVE",
        expiresAt: { gt: now },
      },
      orderBy: { version: "desc" },
    });

    if (
      activeOwnerLock &&
      (!session ||
        activeOwnerLock.bookingId !== session.bookingId ||
        (session.lockVersion !== null &&
          activeOwnerLock.version !== session.lockVersion))
    ) {
      throw new RangeBookingLockError(
        "LOCK_SESSION_STALE",
        "The booking session does not own the active lock."
      );
    }

    const activeBooking = activeOwnerLock
      ? await tx.booking.findUnique({
          where: { id: activeOwnerLock.bookingId },
          select: {
            id: true,
            packageId: true,
            guestCount: true,
            bookingStatus: true,
            payment: {
              where: {
                bookingLockVersion: activeOwnerLock.version,
                status: { in: ["INITIALIZED", "AWAITING_PAYMENT"] },
              },
              select: { id: true },
              take: 1,
            },
          },
        })
      : null;
    if (
      activeOwnerLock &&
      activeBooking?.packageId === eventPackage.id &&
      activeBooking.guestCount === eventPackage.guestLimit &&
      isSameRange(activeOwnerLock, range)
    ) {
      return {
        booking: await tx.booking.findUniqueOrThrow({
          where: { id: activeOwnerLock.bookingId },
        }),
        lock: activeOwnerLock,
        replaced: false,
      };
    }
    if (
      activeOwnerLock &&
      (activeBooking?.bookingStatus === "PAYMENT_PROCESSING" ||
        Boolean(activeBooking?.payment.length))
    ) {
      throw new RangeBookingLockError(
        "PAYMENT_IN_PROGRESS",
        "The schedule cannot change after payment has started."
      );
    }

    const currentBookingId =
      activeOwnerLock?.bookingId ?? session?.bookingId ?? null;
    if (currentBookingId && !activeOwnerLock) {
      throw new RangeBookingLockError(
        "LOCK_SESSION_STALE",
        "The previous lock is no longer active."
      );
    }

    const [bookingConflict, lockConflict, blockConflict] = await Promise.all([
      tx.booking.findFirst({
        where: {
          theatreId: input.theatreId,
          bookingStatus: "CONFIRMED",
          id: currentBookingId ? { not: currentBookingId } : undefined,
          startsAtUtc: { lt: range.occupiedUntilUtc },
          occupiedUntilUtc: { gt: range.startsAtUtc },
        },
        select: { id: true },
      }),
      tx.bookingLock.findFirst({
        where: {
          theatreId: input.theatreId,
          status: "ACTIVE",
          expiresAt: { gt: now },
          bookingId: currentBookingId ? { not: currentBookingId } : undefined,
          startsAtUtc: { lt: range.occupiedUntilUtc },
          occupiedUntilUtc: { gt: range.startsAtUtc },
        },
        select: { id: true },
      }),
      tx.availabilityBlock.findFirst({
        where: {
          theatreId: input.theatreId,
          eventDate: range.eventDate,
          isActive: true,
          startsAtUtc: { lt: range.occupiedUntilUtc },
          endsAtUtc: { gt: range.startsAtUtc },
        },
        select: { id: true },
      }),
    ]);

    if (bookingConflict) {
      throw new RangeBookingLockError(
        "BOOKING_CONFLICT",
        "Time overlaps a confirmed booking."
      );
    }
    if (lockConflict) {
      throw new RangeBookingLockError(
        "LOCK_CONFLICT",
        "Time is held by another customer."
      );
    }
    if (blockConflict) {
      throw new RangeBookingLockError(
        "BLOCK_CONFLICT",
        "Time is blocked by an administrator."
      );
    }

    const expiresAt = new Date(
      now.getTime() + settings.lockDurationMinutes * 60_000
    );
    const packageSnapshot = buildPackageSnapshot(eventPackage);
    const pricingSnapshot = await buildInitialPricingSnapshot(
      eventPackage,
      range.durationMinutes,
      tx
    );
    const baseAmount =
      pricingSnapshot.packageAmount + pricingSnapshot.extraDurationAmount;
    let bookingId = currentBookingId;

    if (bookingId) {
      await tx.bookingLock.updateMany({
        where: {
          status: "ACTIVE",
          OR: [{ bookingId }, { lockOwnerHash: ownerHash }],
        },
        data: { status: "RELEASED" },
      });
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          theatreId: input.theatreId,
          slotId: null,
          venueId: eventPackage.venueId,
          packageId: eventPackage.id,
          eventDate: range.eventDate,
          eventStartTime: input.startTime,
          eventEndTime: input.endTime,
          startsAtUtc: range.startsAtUtc,
          endsAtUtc: range.endsAtUtc,
          occupiedUntilUtc: range.occupiedUntilUtc,
          bufferMinutes: settings.bufferMinutes,
          timezone: theatre.timezone,
          guestCount: eventPackage.guestLimit,
          packageSnapshot,
          pricingSnapshot,
          baseAmount,
          extrasAmount: 0,
          productsAmount: 0,
          decorationAmount: 0,
          discountAmount: 0,
          totalAmount: pricingSnapshot.totalAmount,
          advancePaid: 0,
          remainingPayable: pricingSnapshot.remainingPayable,
          bookingStatus: "INCOMPLETE",
          paymentStatus: null,
        },
      });
    } else {
      const bookingRef = await allocateBookingRef(tx);
      const booking = await tx.booking.create({
        data: {
          bookingRef,
          theatreId: input.theatreId,
          venueId: eventPackage.venueId,
          packageId: eventPackage.id,
          eventDate: range.eventDate,
          eventStartTime: input.startTime,
          eventEndTime: input.endTime,
          startsAtUtc: range.startsAtUtc,
          endsAtUtc: range.endsAtUtc,
          occupiedUntilUtc: range.occupiedUntilUtc,
          bufferMinutes: settings.bufferMinutes,
          timezone: theatre.timezone,
          guestCount: eventPackage.guestLimit,
          packageSnapshot,
          pricingSnapshot,
          baseAmount,
          extrasAmount: 0,
          discountAmount: 0,
          totalAmount: pricingSnapshot.totalAmount,
          advancePaid: 0,
          remainingPayable: pricingSnapshot.remainingPayable,
          bookingStatus: "INCOMPLETE",
        },
      });
      bookingId = booking.id;
    }

    const latest = await tx.bookingLock.aggregate({
      where: { bookingId },
      _max: { version: true },
    });
    const lock = await tx.bookingLock.create({
      data: {
        bookingId,
        theatreId: input.theatreId,
        lockOwnerHash: ownerHash,
        version: (latest._max.version ?? 0) + 1,
        eventDate: range.eventDate,
        startTime: input.startTime,
        endTime: input.endTime,
        startsAtUtc: range.startsAtUtc,
        endsAtUtc: range.endsAtUtc,
        occupiedUntilUtc: range.occupiedUntilUtc,
        expiresAt,
        status: "ACTIVE",
      },
    });
    const booking = await tx.booking.update({
      where: { id: bookingId },
      data: { lockVersion: lock.version },
    });

    return {
      booking,
      lock,
      replaced: Boolean(currentBookingId),
    };
  });
}
