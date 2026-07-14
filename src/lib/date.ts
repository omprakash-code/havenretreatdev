import { BOOKING_TIME_ZONE } from "@/lib/booking-policy";
/**
 * // src/lib/date.ts
 * SINGLE SOURCE OF TRUTH for date comparison.
 * Rule:
 * - All YYYY-MM-DD strings = LOCAL date
 * - All comparisons use LOCAL midnight timestamps
 * 
 * CRITICAL:
 * Any date/time logic must go through this file.
 * Do NOT use toISOString(), Date.now() comparisons directly.
 * All booking, availability, and expiry logic depends on this.
 */

export function startOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

export function addDays(date: Date, days: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days
  );
}

export function getDateKeyInTimeZone(
  date: Date = new Date(),
  timezone: string = BOOKING_TIME_ZONE
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function dateFromDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  return toDateKeyString(addDays(dateFromDateKey(dateKey), days));
}

/**
 * DO NOT USE toISOString() — it breaks dates
 */
export function toDateKeyString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Used everywhere for comparison
 */
export function toDateKey(input: Date | string): number {
  if (typeof input === "string") {
    const [y, m, d] = input.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  }

  return new Date(
    input.getFullYear(),
    input.getMonth(),
    input.getDate()
  ).getTime();
}
