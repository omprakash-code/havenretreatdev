import { z } from "zod";

import {
  isBookingIntervalAligned,
  isDateKey,
  localBookingTimeToUtc,
  timeToMinutes,
  toBookingDate,
} from "@/lib/booking-range";
import {
  ACTIVE_RANGE_HOLD_STATUSES,
  BOOKING_BUFFER_MINUTES,
  BOOKING_BUSINESS_CLOSE_TIME,
  BOOKING_BUSINESS_OPEN_TIME,
  BOOKING_TIME_ZONE,
  getBookingHoldExpiry,
  resolveBookingHoldMinutes,
} from "@/lib/booking-policy";
import { prisma } from "@/lib/db";
import {
  buildInitialPricingSnapshot,
  buildPackageSnapshot,
} from "@/services/booking/booking-snapshot.service";
import { allocateBookingRef } from "@/services/booking/bookingId.service";

export const venueBookingSessionInputSchema = z.object({
  packageId: z.string().trim().min(1),
  eventDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
});

export type VenueBookingSessionInput = z.infer<
  typeof venueBookingSessionInputSchema
>;

export type VenueBookingSessionResult = {
  bookingId: string;
  lockVersion: number;
  replaced: boolean;
};

export type VenueBookingSessionErrorCode =
  | "INVALID_RANGE"
  | "OUTSIDE_BUSINESS_HOURS"
  | "MINIMUM_DURATION"
  | "PACKAGE_NOT_FOUND"
  | "BOOKING_CONFLICT"
  | "PAYMENT_IN_PROGRESS"
  | "SESSION_STALE";

export class VenueBookingSessionError extends Error {
  constructor(
    public readonly code: VenueBookingSessionErrorCode,
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
  input: Pick<VenueBookingSessionInput, "eventDate" | "startTime" | "endTime">,
  minimumDurationMinutes: number,
  timeZone: string
): NormalizedRange {
  if (
    !isDateKey(input.eventDate) ||
    !isBookingIntervalAligned(input.startTime) ||
    !isBookingIntervalAligned(input.endTime)
  ) {
    throw new VenueBookingSessionError(
      "INVALID_RANGE",
      "Date and times must be valid and use 30-minute increments."
    );
  }

  const start = timeToMinutes(input.startTime);
  const end = timeToMinutes(input.endTime);
  const open = timeToMinutes(BOOKING_BUSINESS_OPEN_TIME);
  const close = timeToMinutes(BOOKING_BUSINESS_CLOSE_TIME);

  if (
    start === null ||
    end === null ||
    open === null ||
    close === null ||
    end <= start
  ) {
    throw new VenueBookingSessionError(
      "INVALID_RANGE",
      "End time must be after start time."
    );
  }

  if (start < open || end + BOOKING_BUFFER_MINUTES > close) {
    throw new VenueBookingSessionError(
      "OUTSIDE_BUSINESS_HOURS",
      `Bookings and cleanup time must fit between ${BOOKING_BUSINESS_OPEN_TIME} and ${BOOKING_BUSINESS_CLOSE_TIME}.`
    );
  }

  const durationMinutes = end - start;
  if (durationMinutes < minimumDurationMinutes) {
    const hours = minimumDurationMinutes / 60;
    throw new VenueBookingSessionError(
      "MINIMUM_DURATION",
      `Minimum booking duration is ${hours} hours.`
    );
  }

  const eventDate = toBookingDate(input.eventDate, timeZone);
  const startsAtUtc = localBookingTimeToUtc(input.eventDate, input.startTime, timeZone);
  const endsAtUtc = localBookingTimeToUtc(input.eventDate, input.endTime, timeZone);
  const bufferMs = BOOKING_BUFFER_MINUTES * 60_000;
  const occupiedUntilUtc = new Date(endsAtUtc.getTime() + bufferMs);

  return { eventDate, startsAtUtc, endsAtUtc, occupiedUntilUtc, durationMinutes };
}

export async function createOrReplaceVenueBookingSession(
  input: VenueBookingSessionInput,
  _lockOwner: string,
  session: { bookingId: string; lockVersion: number | null } | null,
  now = new Date()
): Promise<VenueBookingSessionResult> {
  return prisma.$transaction(async (tx) => {
    const eventPackage = await tx.eventPackage.findFirst({
      where: {
        id: input.packageId,
        isActive: true,
        venue: { isActive: true },
      },
      include: {
        venue: true,
        features: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!eventPackage) {
      throw new VenueBookingSessionError(
        "PACKAGE_NOT_FOUND",
        "The selected package is unavailable."
      );
    }

    const minimumDurationMinutes = eventPackage.eventDurationHours * 60;
    const timeZone = BOOKING_TIME_ZONE;

    const range = normalizeRange(input, minimumDurationMinutes, timeZone);

    if (range.startsAtUtc <= now) {
      throw new VenueBookingSessionError(
        "INVALID_RANGE",
        "Booking start time must be in the future."
      );
    }

    let currentBookingId = session?.bookingId ?? null;

    if (currentBookingId) {
      const existing = await tx.booking.findUnique({
        where: { id: currentBookingId },
        select: {
          id: true,
          bookingStatus: true,
          lockVersion: true,
          holdExpiresAt: true,
          payment: {
            where: { status: { in: ["INITIALIZED", "AWAITING_PAYMENT"] } },
            select: { id: true },
            take: 1,
          },
        },
      });

      if (!existing) {
        currentBookingId = null;
      } else {
        const isActiveStatus = ACTIVE_RANGE_HOLD_STATUSES.includes(
          existing.bookingStatus as (typeof ACTIVE_RANGE_HOLD_STATUSES)[number]
        );
        const isExpired = !existing.holdExpiresAt || existing.holdExpiresAt <= now;

        if (!isActiveStatus) {
          currentBookingId = null;
        } else if (
          existing.bookingStatus === "PAYMENT_PROCESSING" ||
          existing.payment.length > 0
        ) {
          throw new VenueBookingSessionError(
            "PAYMENT_IN_PROGRESS",
            "The schedule cannot change after payment has started."
          );
        } else if (isExpired) {
          await tx.booking.update({
            where: { id: existing.id },
            data: {
              bookingStatus: "ABANDONED",
              cancelledAt: now,
              cancelledReason: "SESSION_EXPIRED",
              holdExpiresAt: null,
            },
          });
          await tx.couponUsage.updateMany({
            where: {
              bookingId: existing.id,
              status: "RESERVED",
            },
            data: {
              status: "RELEASED",
              discountAmount: 0,
              releasedAt: now,
              confirmedAt: null,
            },
          });
          currentBookingId = null;
        } else {
          if (existing.lockVersion !== session?.lockVersion) {
            throw new VenueBookingSessionError(
              "SESSION_STALE",
              "The active booking session was replaced in another tab."
            );
          }
        }
      }
    }

    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(
        hashtext(${eventPackage.venueId}),
        hashtext(${input.eventDate})
      )::text AS "lock"
    `;

    const expiredBookings = await tx.booking.findMany({
      where: {
        venueId: eventPackage.venueId,
        bookingStatus: { in: [...ACTIVE_RANGE_HOLD_STATUSES] },
        holdExpiresAt: { lte: now },
        id: currentBookingId ? { not: currentBookingId } : undefined,
      },
      select: { id: true },
    });
    const expiredBookingIds = expiredBookings.map((booking) => booking.id);
    await tx.booking.updateMany({
      where: { id: { in: expiredBookingIds } },
      data: {
        bookingStatus: "ABANDONED",
        cancelledAt: now,
        cancelledReason: "SESSION_EXPIRED",
      },
    });
    if (expiredBookingIds.length > 0) {
      await tx.couponUsage.updateMany({
        where: {
          bookingId: { in: expiredBookingIds },
          status: "RESERVED",
        },
        data: {
          status: "RELEASED",
          discountAmount: 0,
          releasedAt: now,
          confirmedAt: null,
        },
      });
    }

    const bookingConflict = await tx.booking.findFirst({
      where: {
        venueId: eventPackage.venueId,
        id: currentBookingId ? { not: currentBookingId } : undefined,
        OR: [
          { bookingStatus: "CONFIRMED" },
          {
            bookingStatus: { in: [...ACTIVE_RANGE_HOLD_STATUSES] },
            holdExpiresAt: { gt: now },
          },
        ],
        startsAtUtc: { lt: range.occupiedUntilUtc },
        occupiedUntilUtc: { gt: range.startsAtUtc },
      },
      select: { id: true },
    });

    if (bookingConflict) {
      throw new VenueBookingSessionError(
        "BOOKING_CONFLICT",
        "This time overlaps an existing confirmed booking."
      );
    }

    const packageSnapshot = buildPackageSnapshot(eventPackage);
    const pricingSnapshot = await buildInitialPricingSnapshot(
      eventPackage,
      range.durationMinutes,
      tx
    );
    const baseAmount =
      pricingSnapshot.packageAmount + pricingSnapshot.extraDurationAmount;
    const decorationRequired = eventPackage.decorationDefault;
    // Decoration choice is free; decoration packages are sold as product add-ons.
    const decorationAmount = 0;
    const totalAmount = pricingSnapshot.totalAmount;
    const remainingPayable = pricingSnapshot.remainingPayable;

    const holdMinutes = await resolveBookingHoldMinutes(tx);

    let bookingId: string;
    let newVersion: number;

    if (currentBookingId) {
      const current = await tx.booking.findUnique({
        where: { id: currentBookingId },
        select: { lockVersion: true },
      });
      newVersion = (current?.lockVersion ?? 0) + 1;
      await tx.booking.update({
        where: { id: currentBookingId },
        data: {
          packageId: eventPackage.id,
          venueId: eventPackage.venueId,
          eventDate: range.eventDate,
          eventStartTime: input.startTime,
          eventEndTime: input.endTime,
          startsAtUtc: range.startsAtUtc,
          endsAtUtc: range.endsAtUtc,
          occupiedUntilUtc: range.occupiedUntilUtc,
          bufferMinutes: BOOKING_BUFFER_MINUTES,
          timezone: timeZone,
          guestCount: eventPackage.guestLimit,
          packageSnapshot,
          pricingSnapshot,
          baseAmount,
          extrasAmount: 0,
          productsAmount: 0,
          decorationRequired,
          decorationAmount,
          discountAmount: 0,
          totalAmount,
          advancePaid: 0,
          remainingPayable,
          lockVersion: newVersion,
          holdExpiresAt: getBookingHoldExpiry(now, holdMinutes),
          bookingStatus: "INCOMPLETE",
          paymentStatus: null,
        },
      });
      bookingId = currentBookingId;
    } else {
      newVersion = 1;
      const bookingRef = await allocateBookingRef(tx);
      const booking = await tx.booking.create({
        data: {
          bookingRef,
          venueId: eventPackage.venueId,
          packageId: eventPackage.id,
          eventDate: range.eventDate,
          eventStartTime: input.startTime,
          eventEndTime: input.endTime,
          startsAtUtc: range.startsAtUtc,
          endsAtUtc: range.endsAtUtc,
          occupiedUntilUtc: range.occupiedUntilUtc,
          bufferMinutes: BOOKING_BUFFER_MINUTES,
          timezone: timeZone,
          guestCount: eventPackage.guestLimit,
          packageSnapshot,
          pricingSnapshot,
          baseAmount,
          extrasAmount: 0,
          productsAmount: 0,
          decorationRequired,
          decorationAmount,
          discountAmount: 0,
          totalAmount,
          advancePaid: 0,
          remainingPayable,
          bookingStatus: "INCOMPLETE",
          lockVersion: newVersion,
          holdExpiresAt: getBookingHoldExpiry(now, holdMinutes),
        },
      });
      bookingId = booking.id;
    }

    return {
      bookingId,
      lockVersion: newVersion,
      replaced: Boolean(currentBookingId),
    };
  });
}
