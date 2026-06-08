import { toDate } from "date-fns-tz";

export const BOOKING_TIME_ZONE = "America/New_York";
export const BOOKING_INTERVAL_MINUTES = 30;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isDateKey(value: string) {
  return DATE_KEY_PATTERN.test(value);
}

export function timeToMinutes(value: string) {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isBookingIntervalAligned(value: string) {
  const minutes = timeToMinutes(value);
  return minutes !== null && minutes % BOOKING_INTERVAL_MINUTES === 0;
}

export function localBookingTimeToUtc(
  dateKey: string,
  time: string,
  timeZone = BOOKING_TIME_ZONE
) {
  return toDate(`${dateKey}T${time}:00`, { timeZone });
}

export function toBookingDate(
  dateKey: string,
  timeZone = BOOKING_TIME_ZONE
) {
  return toDate(`${dateKey}T00:00:00`, { timeZone });
}
