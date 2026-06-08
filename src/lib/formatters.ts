// src/lib/formatters.ts
/**
 * Format a single time from "HH:MM" 24H to "HH:MM AM/PM"
 */
export function formatISTTime(time: string) {
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
  return `${formatISTTime(start)} - ${formatISTTime(end)}`;
}

import { formatInTimeZone } from "date-fns-tz";

/**
 * Format date to IST timezone
 */
export function formatISTDate(input: Date | string) {
  const date = typeof input === "string" ? new Date(input) : input;
  return formatInTimeZone(date, "Asia/Kolkata", "dd MMM yyyy");
}

export function formatETDate(input: Date | string) {
  const date = typeof input === "string" ? new Date(input) : input;
  return formatInTimeZone(date, "America/New_York", "dd MMM yyyy");
}

/**
 * Format date and time to IST timezone
 */
export function formatISTDateTime(input: Date | string) {
  const date = typeof input === "string" ? new Date(input) : input;
  return formatInTimeZone(date, "Asia/Kolkata", "dd MMM yyyy, hh:mm a");
}

/**
 * Original formatIST function - now uses date-fns-tz
 */
export function formatIST(input: Date | string) {
  const date = typeof input === "string" ? new Date(input) : input;
  return formatInTimeZone(date, "Asia/Kolkata", "dd MMM yyyy, hh:mm a");
}

/**
 * Format date and time in Eastern Time (America/New_York) for Miami-based operations
 */
export function formatET(input: Date | string) {
  const date = typeof input === "string" ? new Date(input) : input;
  return formatInTimeZone(date, "America/New_York", "dd MMM yyyy, hh:mm a");
}

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


/**
 * Format date without year (UI helper)
 * Example: "04 Feb"
 */
export function formatISTDateShort(input: Date | string) {
  const date = typeof input === "string" ? new Date(input) : input;
  return formatInTimeZone(date, "Asia/Kolkata", "dd MMM");
}

/**
 * Format weekday short (Mon, Tue…)
 */
export function formatISTWeekday(input: Date | string) {
  const date = typeof input === "string" ? new Date(input) : input;
  return formatInTimeZone(date, "Asia/Kolkata", "EEE");
}
