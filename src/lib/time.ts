// src/lib/time.ts
/**
 * Time math & slot safety helpers
 * NO UI formatting here
 */

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function isOverlapping(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
  bufferMin: number
): boolean {
  const aS = timeToMinutes(aStart);
  const aE = timeToMinutes(aEnd);
  const bS = timeToMinutes(bStart) - bufferMin;
  const bE = timeToMinutes(bEnd) + bufferMin;

  return aS < bE && aE > bS;
}


export function addMinutesToTime(
  time: string,
  minutes: number
): string {
  const [h, m] = time.split(":").map(Number);

  if (Number.isNaN(h) || Number.isNaN(m)) {
    throw new Error(`Invalid time format: ${time}`);
  }

  const total = h * 60 + m + minutes;
  const normalized = ((total % 1440) + 1440) % 1440;

  const hh = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");

  const mm = (normalized % 60)
    .toString()
    .padStart(2, "0");

  return `${hh}:${mm}`;
}

