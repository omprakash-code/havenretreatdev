import type { Prisma } from "@prisma/client";
import {
  BOOKING_LOCK_MINUTES_KEY,
  parseBookingLockMinutes,
} from "@/lib/app-settings";

export const BOOKING_TIME_ZONE = "America/New_York";
export const BOOKING_INTERVAL_MINUTES = 30;
export const BOOKING_BUSINESS_OPEN_TIME = "09:00";
export const BOOKING_BUSINESS_CLOSE_TIME = "23:00";
export const BOOKING_BUFFER_MINUTES = 30;
export const BOOKING_HOLD_MINUTES = 20;
export const DEFAULT_MINIMUM_BOOKING_MINUTES = 4 * 60;

/**
 * Draft statuses whose range is only reserved while `holdExpiresAt` is in the future.
 */
export const ACTIVE_RANGE_HOLD_STATUSES = [
  "INCOMPLETE",
  "AWAITING_PAYMENT",
  "PAYMENT_PROCESSING",
] as const;

/**
 * Statuses whose range is reserved until an admin decision, independent of
 * `holdExpiresAt`. A submitted request holds its date the same way an approved
 * booking does; the hold is released by rejection or cancellation.
 * CONFIRMED is the legacy equivalent of APPROVED.
 */
export const RESERVED_RANGE_STATUSES = [
  "PENDING_REVIEW",
  "APPROVED",
  "CONFIRMED",
] as const;

export function isReservedRangeStatus(status: string | null | undefined) {
  return RESERVED_RANGE_STATUSES.includes(
    status as (typeof RESERVED_RANGE_STATUSES)[number]
  );
}

/** Marks a booking an admin deleted. The row is kept; the booking is not. */
export const ADMIN_SOFT_DELETE_REASON = "ADMIN_SOFT_DELETED";

/**
 * A deleted booking holds nothing. Deletion keeps `bookingStatus` as it was, so
 * every conflict branch has to say this itself — otherwise a deleted request
 * would sit on its date forever. `not` alone skips NULL rows in Prisma, hence
 * the explicit null branch.
 */
const NOT_SOFT_DELETED: Prisma.BookingWhereInput = {
  OR: [
    { cancelledReason: null },
    { cancelledReason: { not: ADMIN_SOFT_DELETE_REASON } },
  ],
};

/**
 * The `OR` clause every range-conflict query must use: a range is taken when it
 * is reserved for review/approval, or held by another live draft session.
 *
 * `holdScope` narrows only the draft-hold branch (e.g. excluding the caller's
 * own booking), never the reserved branch.
 */
export function buildRangeConflictFilter(
  now: Date,
  holdScope: Prisma.BookingWhereInput = {}
): Prisma.BookingWhereInput[] {
  return [
    {
      bookingStatus: { in: [...RESERVED_RANGE_STATUSES] },
      AND: [NOT_SOFT_DELETED],
    },
    {
      bookingStatus: { in: [...ACTIVE_RANGE_HOLD_STATUSES] },
      holdExpiresAt: { gt: now },
      AND: [NOT_SOFT_DELETED],
      ...holdScope,
    },
  ];
}

export function getBookingHoldExpiry(
  now = new Date(),
  holdMinutes = BOOKING_HOLD_MINUTES
) {
  return new Date(now.getTime() + holdMinutes * 60_000);
}

type BookingHoldSettingsReader = {
  appSetting: {
    findMany: (args: {
      where: { key: { in: string[] } };
      select: { key: true; value: true };
    }) => Promise<Array<{ key: string; value: string }>>;
  };
};

/**
 * Reads the admin-configured slot lock duration (BOOKING_LOCK_MINUTES).
 * Falls back to BOOKING_HOLD_MINUTES when the setting is missing or invalid.
 */
export async function resolveBookingHoldMinutes(
  reader: BookingHoldSettingsReader
): Promise<number> {
  const rows = await reader.appSetting.findMany({
    where: { key: { in: [BOOKING_LOCK_MINUTES_KEY] } },
    select: { key: true, value: true },
  });
  const value = rows.find((row) => row.key === BOOKING_LOCK_MINUTES_KEY)?.value;
  return parseBookingLockMinutes(value) ?? BOOKING_HOLD_MINUTES;
}
