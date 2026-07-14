// src/lib/formatters.ts
//
// The single implementation of date/time display formatting.
//
// Storage is always UTC. Display of business timestamps is always the venue
// timezone (BOOKING_TIME_ZONE). Pick the helper by what the value IS:
//
//   - UTC instant (signedAt, createdAt, paidAt, ...):
//       formatVenueDateTime / formatVenueDate / formatVenueTime / formatVenueDateKey
//   - Calendar date (a "yyyy-MM-dd" string, or a Date pinned to UTC/venue
//     midnight such as eventDate, preferredDate, coupon rule dates):
//       formatCalendarDate / formatCalendarDateShort — NEVER the venue
//       helpers, which can shift a UTC-midnight date to the previous day.
//   - Wall-clock "HH:MM" string (eventStartTime/eventEndTime):
//       formatTimeLabel / formatSlotTime — timezone-agnostic by design.
//   - Browser-constructed local-midnight Date in pickers (already derived
//     from a venue date key): formatWallDate.

import { formatInTimeZone } from "date-fns-tz";
import { BOOKING_TIME_ZONE } from "@/lib/booking-policy";

function toDate(input: Date | string) {
  return typeof input === "string" ? new Date(input) : input;
}

/* -----------------------------------------------------------------
   Wall-clock time strings ("HH:MM" 24h) — timezone-agnostic
------------------------------------------------------------------ */

/**
 * Format a single time from "HH:MM" 24H to "HH:MM AM/PM".
 * Pure string formatting: the value is already venue wall-clock time.
 */
export function formatTimeLabel(time: string) {
  const [h, m] = time.split(":").map(Number);
  const hour = h % 12 || 12;
  const ampm = h >= 12 ? "PM" : "AM";

  return `${hour.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")} ${ampm}`;
}

/**
 * Format slot time from "HH:MM" 24H to "HH:MM AM/PM - HH:MM AM/PM"
 */
export function formatSlotTime(start: string, end: string) {
  return `${formatTimeLabel(start)} - ${formatTimeLabel(end)}`;
}

/* -----------------------------------------------------------------
   Venue-time formatters — for UTC instants
------------------------------------------------------------------ */

/**
 * Date of a UTC instant in venue time, e.g. "14 Jul 2026".
 */
export function formatVenueDate(input: Date | string, pattern = "dd MMM yyyy") {
  return formatInTimeZone(toDate(input), BOOKING_TIME_ZONE, pattern);
}

/**
 * Date and time of a UTC instant in venue time with the seasonal timezone
 * abbreviation, e.g. "14 Jul 2026, 05:27 PM EDT".
 */
export function formatVenueDateTime(
  input: Date | string,
  pattern = "dd MMM yyyy, hh:mm a zzz"
) {
  return formatInTimeZone(toDate(input), BOOKING_TIME_ZONE, pattern);
}

/**
 * Time of a UTC instant in venue time, e.g. "05:27 PM".
 */
export function formatVenueTime(input: Date | string) {
  return formatInTimeZone(toDate(input), BOOKING_TIME_ZONE, "hh:mm a");
}

/**
 * Venue business-day key ("yyyy-MM-dd") of a UTC instant. Use for grouping,
 * filtering, reference ids — anywhere "which day did this happen" means the
 * venue's day, not the server's or the viewer's.
 */
export function formatVenueDateKey(input: Date | string) {
  return formatInTimeZone(toDate(input), BOOKING_TIME_ZONE, "yyyy-MM-dd");
}

/* -----------------------------------------------------------------
   Calendar-date formatters — for date-only values
   ("yyyy-MM-dd" strings, or Dates pinned to UTC/venue midnight)
------------------------------------------------------------------ */

/**
 * Format a date-only value without any timezone shift, e.g. "14 Jul 2026".
 * Formats in UTC: both UTC-midnight ("2026-07-14" parsed) and venue-midnight
 * (eventDate) instants stay on their calendar date, whereas venue-time
 * formatting would move a UTC-midnight value to the previous evening.
 */
export function formatCalendarDate(
  input: Date | string,
  pattern = "dd MMM yyyy"
) {
  return formatInTimeZone(toDate(input), "UTC", pattern);
}

/**
 * Short calendar date without year, e.g. "14 Jul".
 */
export function formatCalendarDateShort(input: Date | string) {
  return formatCalendarDate(input, "dd MMM");
}

/**
 * "yyyy-MM-dd" key of a date-only value (see formatCalendarDate). Use for
 * comparing calendar dates (e.g. an eventDate against a coupon window);
 * era-proof for both UTC-midnight and venue-midnight pinned dates.
 */
export function formatCalendarDateKey(input: Date | string) {
  return formatCalendarDate(input, "yyyy-MM-dd");
}

/* -----------------------------------------------------------------
   Local wall-clock dates — picker/UI Dates built at local midnight
   from a venue date key; printing their own fields cannot shift.
------------------------------------------------------------------ */

export function formatWallDate(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  locale = "en-US"
) {
  return date.toLocaleDateString(locale, options);
}

/* -----------------------------------------------------------------
   Misc
------------------------------------------------------------------ */

export function maskPhone(phone?: string | null) {
  if (!phone) return "XXXXXXXX";
  return phone;
}

/**
 * Format duration minutes into human readable hours
 * Examples:
 * 180 -> "3 hours"
 * 90  -> "1.5 hours"
 * 60  -> "1 hour"
 */
export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;

  const hours = min / 60;

  if (Number.isInteger(hours)) {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }

  return `${hours.toFixed(1)} hours`;
}
