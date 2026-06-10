import type { Prisma } from "@prisma/client";

import {
  isBookingIntervalAligned,
  isDateKey,
  localBookingTimeToUtc,
  timeToMinutes,
  toBookingDate,
} from "@/lib/booking-range";

export type AdminRangeBookingErrorCode =
  | "ADMIN_RANGE_BOOKING_DISABLED"
  | "INVALID_RANGE"
  | "OUTSIDE_BUSINESS_HOURS"
  | "MINIMUM_DURATION"
  | "CAPACITY_EXCEEDED"
  | "BOOKING_CONFLICT";

export class AdminRangeBookingError extends Error {
  constructor(
    public readonly code: AdminRangeBookingErrorCode,
    message: string
  ) {
    super(message);
  }
}

export type AdminRange = {
  eventDate: Date;
  startsAtUtc: Date;
  endsAtUtc: Date;
  occupiedUntilUtc: Date;
  durationMinutes: number;
};

type AdminRangeSettings = {
  businessOpenTime: string;
  businessCloseTime: string;
  minimumDurationMinutes: number;
  bufferMinutes: number;
  maximumGuests: number;
};

export type AdminRangeValidationResult = {
  range: AdminRange;
};

export function isAdminRangeBookingEnabled() {
  return String(process.env.ADMIN_RANGE_BOOKING_ENABLED ?? "").toLowerCase() === "true";
}

export async function acquireAdminRangeTransactionLock(
  tx: Prisma.TransactionClient,
  lockId: string,
  dateKey: string
) {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${lockId}),
      hashtext(${dateKey})
    )::text AS "lock"
  `;
}

export function normalizeAdminRange(input: {
  date: string;
  startTime: string;
  endTime: string;
  settings: Pick<
    AdminRangeSettings,
    "businessOpenTime" | "businessCloseTime" | "minimumDurationMinutes" | "bufferMinutes"
  >;
  timezone: string;
}): AdminRange {
  if (
    !isDateKey(input.date) ||
    !isBookingIntervalAligned(input.startTime) ||
    !isBookingIntervalAligned(input.endTime)
  ) {
    throw new AdminRangeBookingError(
      "INVALID_RANGE",
      "Date and times must be valid and use 30-minute increments."
    );
  }

  const start = timeToMinutes(input.startTime);
  const end = timeToMinutes(input.endTime);
  const open = timeToMinutes(input.settings.businessOpenTime);
  const close = timeToMinutes(input.settings.businessCloseTime);
  if (
    start === null ||
    end === null ||
    open === null ||
    close === null ||
    end <= start
  ) {
    throw new AdminRangeBookingError("INVALID_RANGE", "End time must be after start time.");
  }
  if (start < open || end + input.settings.bufferMinutes > close) {
    throw new AdminRangeBookingError(
      "OUTSIDE_BUSINESS_HOURS",
      "The booking and its buffer must fit within business hours."
    );
  }
  if (end - start < input.settings.minimumDurationMinutes) {
    throw new AdminRangeBookingError(
      "MINIMUM_DURATION",
      `Booking must be at least ${input.settings.minimumDurationMinutes} minutes.`
    );
  }

  const startsAtUtc = localBookingTimeToUtc(input.date, input.startTime, input.timezone);
  const endsAtUtc = localBookingTimeToUtc(input.date, input.endTime, input.timezone);

  return {
    eventDate: toBookingDate(input.date, input.timezone),
    startsAtUtc,
    endsAtUtc,
    occupiedUntilUtc: new Date(
      endsAtUtc.getTime() + input.settings.bufferMinutes * 60_000
    ),
    durationMinutes: end - start,
  };
}

export async function validateAdminRangeBooking(
  tx: Prisma.TransactionClient,
  input: {
    venueId?: string;
    date: string;
    startTime: string;
    endTime: string;
    guestCount: number;
    settings: AdminRangeSettings;
    timezone: string;
    excludeBookingId?: string | null;
  }
): Promise<AdminRangeValidationResult> {
  const lockId = input.venueId ?? input.date;
  await acquireAdminRangeTransactionLock(tx, lockId, input.date);

  if (input.guestCount > input.settings.maximumGuests) {
    throw new AdminRangeBookingError(
      "CAPACITY_EXCEEDED",
      `Guest count cannot exceed venue capacity (${input.settings.maximumGuests}).`
    );
  }

  const range = normalizeAdminRange({
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    settings: input.settings,
    timezone: input.timezone,
  });

  const bookingConflict = await tx.booking.findFirst({
    where: {
      bookingStatus: "CONFIRMED",
      startsAtUtc: { lt: range.occupiedUntilUtc },
      occupiedUntilUtc: { gt: range.startsAtUtc },
      ...(input.excludeBookingId ? { id: { not: input.excludeBookingId } } : {}),
    },
    select: { id: true },
  });

  if (bookingConflict) {
    throw new AdminRangeBookingError("BOOKING_CONFLICT", "Time overlaps a confirmed booking.");
  }

  return { range };
}
