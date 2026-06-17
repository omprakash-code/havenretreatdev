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

export const ACTIVE_RANGE_HOLD_STATUSES = [
  "INCOMPLETE",
  "AWAITING_PAYMENT",
  "PAYMENT_PROCESSING",
] as const;

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
