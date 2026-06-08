import { timeToMinutes } from "@/lib/booking-range";

type MinuteRange = {
  start: number;
  end: number;
};

export function rangesOverlap(left: MinuteRange, right: MinuteRange) {
  return left.start < right.end && left.end > right.start;
}

export function mergeMinuteRanges(ranges: MinuteRange[]) {
  const sorted = ranges
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: MinuteRange[] = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || range.start > previous.end) {
      merged.push({ ...range });
      continue;
    }
    previous.end = Math.max(previous.end, range.end);
  }
  return merged;
}

export function subtractMinuteRanges(
  businessRange: MinuteRange,
  occupiedRanges: MinuteRange[]
) {
  const occupied = mergeMinuteRanges(
    occupiedRanges.map((range) => ({
      start: Math.max(range.start, businessRange.start),
      end: Math.min(range.end, businessRange.end),
    }))
  );

  const available: MinuteRange[] = [];
  let cursor = businessRange.start;
  for (const range of occupied) {
    if (range.start > cursor) {
      available.push({ start: cursor, end: range.start });
    }
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < businessRange.end) {
    available.push({ start: cursor, end: businessRange.end });
  }
  return available;
}

export function toMinuteRange(startTime: string, endTime: string) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null || end <= start) return null;
  return { start, end };
}

export function minutesToTime(minutes: number) {
  const normalized = Math.max(0, Math.min(minutes, 24 * 60));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}
