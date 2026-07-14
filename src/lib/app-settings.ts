
export type AppSettingItem = {
  key: string;
  value: string;
};

export type SettingMeta = {
  label: string;
  description: string;
  type: "text" | "number" | "select";
  placeholder?: string;
  defaultValue: string;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{
    label: string;
    value: string;
  }>;
};

export const ADVANCE_PAYMENT_AMOUNT_KEY = "ADVANCE_PAYMENT_AMOUNT";
export const ADVANCE_PAYMENT_MIN = 1;
export const ADVANCE_PAYMENT_MAX = 50000;
export const BOOKING_LOCK_MINUTES_KEY = "BOOKING_LOCK_MINUTES";
export const BOOKING_LOCK_MINUTES_MIN = 1;
export const BOOKING_LOCK_MINUTES_MAX = 60;
export const DEFAULT_BOOKING_LOCK_MINUTES = 10;
export const MINIMUM_BOOKING_DURATION_HOURS_KEY =
  "MINIMUM_BOOKING_DURATION_HOURS";
export const MINIMUM_BOOKING_DURATION_HOURS_MIN = 1;
export const MINIMUM_BOOKING_DURATION_HOURS_MAX = 23.5;
export const DEFAULT_MINIMUM_BOOKING_DURATION_HOURS = 4;
export const EXTRA_HOURLY_RATE_KEY = "EXTRA_HOURLY_RATE";
export const EXTRA_HOURLY_RATE_MIN = 0;
export const EXTRA_HOURLY_RATE_MAX = 50000;
export const DEFAULT_EXTRA_HOURLY_RATE = 120;

export const PRIORITY_SETTING_KEYS = [
  ADVANCE_PAYMENT_AMOUNT_KEY,
  BOOKING_LOCK_MINUTES_KEY,
  MINIMUM_BOOKING_DURATION_HOURS_KEY,
  EXTRA_HOURLY_RATE_KEY,
] as const;

export const APP_SETTING_META: Record<string, SettingMeta> = {
  [ADVANCE_PAYMENT_AMOUNT_KEY]: {
    label: "Default Advance Payment Amount",
    description:
      "The amount customers are asked to pay after their booking request has been approved.",
    type: "number",
    placeholder: "750",
    defaultValue: "750",
    max: ADVANCE_PAYMENT_MAX,
    step: 1,
  },
  [BOOKING_LOCK_MINUTES_KEY]: {
    label: "Booking Hold Duration (minutes)",
    description:
      "How long a booking request temporarily reserves the selected date and time before it becomes available again.",
    type: "number",
    placeholder: String(DEFAULT_BOOKING_LOCK_MINUTES),
    defaultValue: String(DEFAULT_BOOKING_LOCK_MINUTES),
    min: BOOKING_LOCK_MINUTES_MIN,
    max: BOOKING_LOCK_MINUTES_MAX,
    step: 1,
  },
  [MINIMUM_BOOKING_DURATION_HOURS_KEY]: {
    label: "Minimum Booking Duration (hours)",
    description: "The shortest event duration customers can book.",
    type: "number",
    placeholder: String(DEFAULT_MINIMUM_BOOKING_DURATION_HOURS),
    defaultValue: String(DEFAULT_MINIMUM_BOOKING_DURATION_HOURS),
    min: MINIMUM_BOOKING_DURATION_HOURS_MIN,
    max: MINIMUM_BOOKING_DURATION_HOURS_MAX,
    step: 0.5,
  },
  [EXTRA_HOURLY_RATE_KEY]: {
    label: "Default Extra Hourly Rate",
    description:
      "Hourly rate applied when a package doesn't have its own extra-hour pricing.",
    type: "number",
    placeholder: String(DEFAULT_EXTRA_HOURLY_RATE),
    defaultValue: String(DEFAULT_EXTRA_HOURLY_RATE),
    min: EXTRA_HOURLY_RATE_MIN,
    max: EXTRA_HOURLY_RATE_MAX,
    step: 1,
  },
};

export function normalizeAppSettingValue(key: string, value: string) {
  const trimmed = String(value ?? "").trim();

  if (key === ADVANCE_PAYMENT_AMOUNT_KEY) {
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return trimmed;
    return String(Math.trunc(parsed));
  }

  if (key === BOOKING_LOCK_MINUTES_KEY) {
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return trimmed;
    return String(Math.trunc(parsed));
  }

  if (key === MINIMUM_BOOKING_DURATION_HOURS_KEY) {
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return trimmed;
    return String(parsed);
  }

  if (key === EXTRA_HOURLY_RATE_KEY) {
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return trimmed;
    return String(Math.trunc(parsed));
  }

  return trimmed;
}

export function validateAppSetting(key: string, value: string) {
  const normalized = normalizeAppSettingValue(key, value);

  if (key === ADVANCE_PAYMENT_AMOUNT_KEY) {
    const amount = Number(normalized);
    if (!Number.isFinite(amount)) {
      return "Enter a valid number.";
    }
    if (!Number.isInteger(amount)) {
      return "Amount must be a whole number.";
    }
    if (amount < ADVANCE_PAYMENT_MIN) {
      return "Amount must be at least 1.";
    }
    if (amount > ADVANCE_PAYMENT_MAX) {
      return `Amount must be at most ${ADVANCE_PAYMENT_MAX}.`;
    }
    return null;
  }

  if (key === BOOKING_LOCK_MINUTES_KEY) {
    const minutes = Number(normalized);
    if (!Number.isFinite(minutes)) {
      return "Enter a valid number.";
    }
    if (!Number.isInteger(minutes)) {
      return "Duration must be a whole number.";
    }
    if (minutes < BOOKING_LOCK_MINUTES_MIN) {
      return `Duration must be at least ${BOOKING_LOCK_MINUTES_MIN} minute.`;
    }
    if (minutes > BOOKING_LOCK_MINUTES_MAX) {
      return `Duration must be at most ${BOOKING_LOCK_MINUTES_MAX} minutes.`;
    }
    return null;
  }

  if (key === MINIMUM_BOOKING_DURATION_HOURS_KEY) {
    const hours = Number(normalized);
    if (!Number.isFinite(hours)) {
      return "Enter a valid duration.";
    }
    if (hours < MINIMUM_BOOKING_DURATION_HOURS_MIN) {
      return `Duration must be at least ${MINIMUM_BOOKING_DURATION_HOURS_MIN} hour.`;
    }
    if (hours > MINIMUM_BOOKING_DURATION_HOURS_MAX) {
      return `Duration must be at most ${MINIMUM_BOOKING_DURATION_HOURS_MAX} hours.`;
    }
    if (!Number.isInteger(hours * 2)) {
      return "Duration must use 30-minute increments.";
    }
    return null;
  }

  if (key === EXTRA_HOURLY_RATE_KEY) {
    const amount = Number(normalized);
    if (!Number.isFinite(amount)) {
      return "Enter a valid amount.";
    }
    if (!Number.isInteger(amount)) {
      return "Amount must be a whole number.";
    }
    if (amount < EXTRA_HOURLY_RATE_MIN) {
      return `Amount must be at least ${EXTRA_HOURLY_RATE_MIN}.`;
    }
    if (amount > EXTRA_HOURLY_RATE_MAX) {
      return `Amount must be at most ${EXTRA_HOURLY_RATE_MAX}.`;
    }
    return null;
  }

  return null;
}

export function isKnownAppSettingKey(key: string) {
  return key in APP_SETTING_META;
}

export function parseAdvancePaymentAmount(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  if (!Number.isInteger(amount)) return null;
  if (amount < ADVANCE_PAYMENT_MIN || amount > ADVANCE_PAYMENT_MAX) {
    return null;
  }
  return Math.trunc(amount);
}

export function parseBookingLockMinutes(value: unknown) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return null;
  if (!Number.isInteger(minutes)) return null;
  if (minutes < BOOKING_LOCK_MINUTES_MIN || minutes > BOOKING_LOCK_MINUTES_MAX) {
    return null;
  }
  return Math.trunc(minutes);
}

export function parseMinimumBookingDurationHours(value: unknown) {
  const hours = Number(value);
  if (!Number.isFinite(hours)) return null;
  if (
    hours < MINIMUM_BOOKING_DURATION_HOURS_MIN ||
    hours > MINIMUM_BOOKING_DURATION_HOURS_MAX
  ) {
    return null;
  }
  if (!Number.isInteger(hours * 2)) return null;
  return hours;
}

export function parseExtraHourlyRate(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  if (!Number.isInteger(amount)) return null;
  if (amount < EXTRA_HOURLY_RATE_MIN || amount > EXTRA_HOURLY_RATE_MAX) {
    return null;
  }
  return Math.trunc(amount);
}

export function mergeWithKnownAppSettings(items: AppSettingItem[]) {
  const map = new Map(items.map((item) => [item.key, String(item.value ?? "")]));

  for (const key of PRIORITY_SETTING_KEYS) {
    if (!map.has(key)) {
      map.set(key, APP_SETTING_META[key].defaultValue);
    }
  }

  return Array.from(map.entries()).map(([key, value]) => ({
    key,
    value,
  }));
}

export function sortAppSettings(items: AppSettingItem[]) {
  const map = new Map(items.map((item) => [item.key, item]));
  const prioritized = PRIORITY_SETTING_KEYS.map((key) => map.get(key)).filter(
    (item): item is AppSettingItem => Boolean(item)
  );
  const rest = items
    .filter(
      (item) =>
        !PRIORITY_SETTING_KEYS.includes(
          item.key as (typeof PRIORITY_SETTING_KEYS)[number]
        )
    )
    .sort((a, b) => a.key.localeCompare(b.key));

  return [...prioritized, ...rest];
}
