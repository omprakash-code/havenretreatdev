import { formatInTimeZone } from "date-fns-tz";

import { BOOKING_TIME_ZONE } from "@/lib/booking-policy";
import { formatSlotTime } from "@/lib/formatters";
import { timeToMinutes } from "@/lib/time";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type DateLike = Date | string | null | undefined;

export type BookingSchedulePresenterInput = {
  eventDate?: DateLike;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  startsAtUtc?: DateLike;
  endsAtUtc?: DateLike;
  timezone?: string | null;
};

export type PresentedBookingSchedule = {
  source: "BOOKING";
  timezone: string;
  dateKey: string;
  startTime: string;
  endTime: string;
  timeSlot: string;
  date: string;
  dateTime: string;
  durationHours: number | null;
  endsAtUtc: Date | null;
  successTokenExpiresAt: Date | null;
};

function toDate(value: DateLike) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateKeyFromDateOnly(value: DateLike) {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    return match?.[0] ?? null;
  }
  return value.toISOString().slice(0, 10);
}

function renderDateKey(dateKey: string, pattern: string) {
  return formatInTimeZone(new Date(`${dateKey}T12:00:00Z`), "UTC", pattern);
}

function durationHoursFromTimes(startTime: string, endTime: string) {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (end <= start) end += 24 * 60;
  return (end - start) / 60;
}

export function resolvePresentedBookingSchedule(
  input: BookingSchedulePresenterInput,
  datePattern = "EEE, dd MMM yyyy"
): PresentedBookingSchedule | null {
  const bookingStart = input.eventStartTime?.trim();
  const bookingEnd = input.eventEndTime?.trim();
  if (input.eventDate && bookingStart && bookingEnd) {
    const timezone = input.timezone?.trim() || BOOKING_TIME_ZONE;
    const startsAtUtc = toDate(input.startsAtUtc);
    const dateKey =
      startsAtUtc != null
        ? formatInTimeZone(startsAtUtc, timezone, "yyyy-MM-dd")
        : dateKeyFromDateOnly(input.eventDate);

    if (!dateKey) return null;

    const endsAtUtc = toDate(input.endsAtUtc);
    const durationHours =
      startsAtUtc && endsAtUtc
        ? (endsAtUtc.getTime() - startsAtUtc.getTime()) / 36e5
        : durationHoursFromTimes(bookingStart, bookingEnd);
    const date = startsAtUtc
      ? formatInTimeZone(startsAtUtc, timezone, datePattern)
      : renderDateKey(dateKey, datePattern);
    const timeSlot = formatSlotTime(bookingStart, bookingEnd);

    return {
      source: "BOOKING",
      timezone,
      dateKey,
      startTime: bookingStart,
      endTime: bookingEnd,
      timeSlot,
      date,
      dateTime: `${date}, ${timeSlot}`,
      durationHours: Number.isFinite(durationHours) ? durationHours : null,
      endsAtUtc,
      successTokenExpiresAt: endsAtUtc
        ? new Date(endsAtUtc.getTime() + ONE_DAY_MS)
        : null,
    };
  }

  return null;
}
