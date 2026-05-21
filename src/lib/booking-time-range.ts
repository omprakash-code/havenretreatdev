export const DEFAULT_TIME_RANGE_INCREMENT_MINUTES = 30;

const DAY_MINUTES = 24 * 60;

export type TimeRangeValue = {
  startTime: string | null;
  endTime: string | null;
};

export function parseTimeValue(value: string | null | undefined) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;

  const [hours, minutes] = value.split(":").map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

export function toTimeValue(minutes: number) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= DAY_MINUTES) {
    return null;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(
    2,
    "0"
  )}`;
}

export function calculateDurationHours(
  startTime: string | null | undefined,
  endTime: string | null | undefined
) {
  const startMinutes = parseTimeValue(startTime);
  const endMinutes = parseTimeValue(endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return null;
  }

  return (endMinutes - startMinutes) / 60;
}

export function buildTimeValues(incrementMinutes = DEFAULT_TIME_RANGE_INCREMENT_MINUTES) {
  const safeIncrement =
    Number.isInteger(incrementMinutes) && incrementMinutes > 0
      ? incrementMinutes
      : DEFAULT_TIME_RANGE_INCREMENT_MINUTES;
  const values: string[] = [];

  for (let minute = 0; minute < DAY_MINUTES; minute += safeIncrement) {
    const value = toTimeValue(minute);
    if (value) values.push(value);
  }

  return values;
}
