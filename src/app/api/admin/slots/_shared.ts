import { formatInTimeZone } from "date-fns-tz";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { timeToMinutes } from "@/lib/time";

export const IST_TIMEZONE = "Asia/Kolkata";
export const ADMIN_SOFT_DELETE_REASON = "ADMIN_SOFT_DELETED";
export const DEFAULT_SLOT_BUFFER_MINUTES = 30;
export const MANUAL_SLOT_REASON_MARKER = "MANUAL_SLOT_CREATED";

type SlotTimingConflict = {
  conflictingSlot: {
    date: string;
    startTime: string;
    endTime: string;
    bufferMin: number;
  };
  reason: string;
};

function getISTDateKey(date: Date) {
  return formatInTimeZone(date, IST_TIMEZONE, "yyyy-MM-dd");
}

function toAbsoluteMinutes(date: Date, time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const base = new Date(`${getISTDateKey(date)}T00:00:00+05:30`);
  return base.getTime() / 60000 + hour * 60 + minute;
}

function shiftISTDate(date: Date, dayOffset: number) {
  const base = new Date(`${getISTDateKey(date)}T00:00:00+05:30`);
  return new Date(base.getTime() + dayOffset * 24 * 60 * 60 * 1000);
}

export function isValidTimeInput(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function parseISTDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00+05:30`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function calculateDuration(startTime: string, endTime: string) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return end > start ? end - start : end + 1440 - start;
}

export function isManualSlotReason(reason: string | null | undefined) {
  const value = String(reason ?? "").trim();
  return value.startsWith(MANUAL_SLOT_REASON_MARKER);
}

export async function findSlotTimingConflict(input: {
  theatreId: string;
  slotDate: Date;
  startTime: string;
  endTime: string;
  excludeSlotId?: string;
  dbClient?: Prisma.TransactionClient | typeof prisma;
}): Promise<SlotTimingConflict | null> {
  const {
    theatreId,
    slotDate,
    startTime,
    endTime,
    excludeSlotId,
    dbClient = prisma,
  } = input;

  const crossesMidnight = timeToMinutes(endTime) <= timeToMinutes(startTime);
  const prevDate = shiftISTDate(slotDate, -1);
  const nextDate = shiftISTDate(slotDate, 1);

  const otherSlots = await dbClient.slot.findMany({
    where: {
      theatreId,
      ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
      status: { not: "DISABLED" },
      OR: [
        { date: slotDate },
        { date: prevDate },
        ...(crossesMidnight ? [{ date: nextDate }] : []),
      ],
    },
    select: {
      date: true,
      startTime: true,
      endTime: true,
      template: { select: { bufferMin: true } },
    },
  });

  const thisStart = toAbsoluteMinutes(slotDate, startTime);
  let thisEnd = toAbsoluteMinutes(slotDate, endTime);
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    thisEnd += 1440;
  }

  for (const other of otherSlots) {
    const otherStart = toAbsoluteMinutes(other.date, other.startTime);
    let otherEnd = toAbsoluteMinutes(other.date, other.endTime);

    if (timeToMinutes(other.endTime) <= timeToMinutes(other.startTime)) {
      otherEnd += 1440;
    }

    const buffer = other.template?.bufferMin ?? DEFAULT_SLOT_BUFFER_MINUTES;
    const isOtherOvernight = timeToMinutes(other.endTime) <= timeToMinutes(other.startTime);
    const directOverlap = thisStart < otherEnd && thisEnd > otherStart;
    const overlaps = thisStart < otherEnd + buffer && thisEnd > otherStart - buffer;

    if (!overlaps) continue;

    return {
      conflictingSlot: {
        date: getISTDateKey(other.date),
        startTime: other.startTime,
        endTime: other.endTime,
        bufferMin: buffer,
      },
      reason: directOverlap
        ? isOtherOvernight
          ? "Direct time overlap with an overnight slot"
          : "Direct time overlap"
        : `Buffer gap violation (${buffer} min required between slots)`,
    };
  }

  return null;
}
