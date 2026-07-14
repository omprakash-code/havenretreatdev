import type { BookingConfirmationEmailProps } from "@/emails/BookingConfirmationEmail";
import { BOOKING_TIME_ZONE } from "@/lib/booking-policy";

const ICS_CONTENT_TYPE = "text/calendar; charset=utf-8; method=REQUEST";

type ParsedDate = {
  year: number;
  month: number;
  day: number;
};

type ParsedTime = {
  hour: number;
  minute: number;
};

type CalendarDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export type CalendarAttachment = {
  filename: string;
  content: string;
  contentType: typeof ICS_CONTENT_TYPE;
};

function parseDisplayDate(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  const abbToMonth: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };

  const shortWeekdayPattern =
    /^\s*[A-Za-z]{3},\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*$/;
  const longWeekdayPattern =
    /^\s*(?:[A-Za-z]{3}),?\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*$/;

  const match =
    shortWeekdayPattern.exec(normalized) ?? longWeekdayPattern.exec(normalized);
  if (match) {
    const monthName = match[2].trim().toLowerCase();
    const month = abbToMonth[monthName];
    if (!month) return null;

    const day = Number(match[1]);
    const year = Number(match[3]);
    if (!Number.isInteger(day) || !Number.isInteger(year)) return null;

    return { year, month, day } as ParsedDate;
  }

  const parsedDate = new Date(normalized);
  if (Number.isNaN(parsedDate.getTime())) return null;

  return {
    year: parsedDate.getUTCFullYear(),
    month: parsedDate.getUTCMonth() + 1,
    day: parsedDate.getUTCDate(),
  } as ParsedDate;
}

function parseSlotTime(value: string): ParsedTime | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const twentyFourHour = /^(\d{1,2}):(\d{2})$/;
  const twelveHour = /^(\d{1,2}):(\d{2})\s*([ap]m)$/i;

  const twelveHourMatch = twelveHour.exec(raw);
  if (twelveHourMatch) {
    const hour = Number(twelveHourMatch[1]);
    const minute = Number(twelveHourMatch[2]);
    const meridian = twelveHourMatch[3].toLowerCase();

    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
    if (minute < 0 || minute > 59 || hour < 1 || hour > 12) return null;

    let normalizedHour = hour % 12;
    if (meridian === "pm") normalizedHour += 12;

    return { hour: normalizedHour, minute } as ParsedTime;
  }

  const twentyFourHourMatch = twentyFourHour.exec(raw);
  if (!twentyFourHourMatch) return null;

  const hour = Number(twentyFourHourMatch[1]);
  const minute = Number(twentyFourHourMatch[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return { hour, minute } as ParsedTime;
}

function parseSlotRange(timeSlot: string) {
  const match = String(timeSlot || "").match(/^(.+?)\s*-\s*(.+)$/);
  if (!match) return null;

  const start = parseSlotTime(match[1]);
  const end = parseSlotTime(match[2]);
  if (!start || !end) return null;

  return { start, end };
}

function zeroPad(value: number) {
  return String(value).padStart(2, "0");
}

function formatIcsDateTime(date: CalendarDateTime) {
  return `${zeroPad(date.year)}${zeroPad(date.month)}${zeroPad(date.day)}T${zeroPad(
    date.hour
  )}${zeroPad(date.minute)}00`;
}

function formatUtcIcsDateTime(date: Date) {
  return `${date.getUTCFullYear()}${zeroPad(
    date.getUTCMonth() + 1
  )}${zeroPad(date.getUTCDate())}T${zeroPad(date.getUTCHours())}${zeroPad(
    date.getUTCMinutes()
  )}${zeroPad(date.getUTCSeconds())}Z`;
}

function escapeIcsText(value: string) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function buildCalendarDateRange(
  bookingDate: ParsedDate,
  parsedRange: ReturnType<typeof parseSlotRange>
) {
  if (!parsedRange) return null;

  const startMinutes = parsedRange.start.hour * 60 + parsedRange.start.minute;
  const endMinutes = parsedRange.end.hour * 60 + parsedRange.end.minute;

  const startDate: CalendarDateTime = {
    year: bookingDate.year,
    month: bookingDate.month,
    day: bookingDate.day,
    hour: parsedRange.start.hour,
    minute: parsedRange.start.minute,
  };

  let endDate: CalendarDateTime = {
    year: bookingDate.year,
    month: bookingDate.month,
    day: bookingDate.day,
    hour: parsedRange.end.hour,
    minute: parsedRange.end.minute,
  };

  if (endMinutes <= startMinutes) {
    const cursor = new Date(
      Date.UTC(bookingDate.year, bookingDate.month - 1, bookingDate.day)
    );
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    endDate = {
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1,
      day: cursor.getUTCDate(),
      hour: parsedRange.end.hour,
      minute: parsedRange.end.minute,
    };
  }

  return { startDate, endDate };
}

export function buildBookingConfirmationCalendarAttachment(
  emailData: BookingConfirmationEmailProps,
  bookingRef: string
): CalendarAttachment | undefined {
  const bookingDate = parseDisplayDate(emailData.date);
  if (!bookingDate) return undefined;

  const parsedRange = parseSlotRange(emailData.timeSlot);
  const range = buildCalendarDateRange(bookingDate, parsedRange);
  if (!range) return undefined;

  const now = new Date();
  const venue = [emailData.theatreName, emailData.locationName]
    .filter(Boolean)
    .join(" - ");

  const descriptionLines = [
    `Booking Ref: ${bookingRef}`,
    emailData.customerName ? `Customer: ${emailData.customerName}` : undefined,
    `Guests: ${emailData.guestCount}`,
    emailData.customerPhone ? `Phone: ${emailData.customerPhone}` : undefined,
    emailData.customerEmail ? `Email: ${emailData.customerEmail}` : undefined,
    `Venue: ${venue || "Haven Retreat"}`,
    `Booking link: ${emailData.successUrl}`,
  ].filter(Boolean);

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Haven Retreat//Booking Confirmation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(`${bookingRef}@havenretreat.booking`)}`,
    `DTSTAMP:${formatUtcIcsDateTime(now)}`,
    `DTSTART;TZID=${BOOKING_TIME_ZONE}:${formatIcsDateTime(range.startDate)}`,
    `DTEND;TZID=${BOOKING_TIME_ZONE}:${formatIcsDateTime(range.endDate)}`,
    `SUMMARY:${escapeIcsText(`Booking confirmed: ${bookingRef}`)}`,
    `DESCRIPTION:${escapeIcsText(descriptionLines.join("\\n"))}`,
    `LOCATION:${escapeIcsText(venue || "Haven Retreat")}`,
    `URL:${escapeIcsText(emailData.successUrl)}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    "DESCRIPTION:Booking reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const icsContent = `${icsLines.join("\r\n")}\r\n`;

  return {
    filename: `${bookingRef}.ics`,
    content: icsContent,
    contentType: ICS_CONTENT_TYPE,
  };
}
