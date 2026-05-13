import {
  DEFAULT_SLOT_EXPIRY_GRACE_MINUTES,
  DEFAULT_SLOT_EXPIRY_MODE,
  SLOT_EXPIRY_GRACE_MINUTES_KEY,
  SLOT_EXPIRY_GRACE_MINUTES_MAX,
  SLOT_EXPIRY_GRACE_MINUTES_MIN,
  SLOT_EXPIRY_MODE_KEY,
  type SlotExpiryMode,
} from "@/lib/slot-time";

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

const SPECIAL_SLOT_TEXT_MIN_LENGTH = 2;
const SPECIAL_SLOT_TEXT_MAX_LENGTH = 40;
export const ADVANCE_PAYMENT_AMOUNT_KEY = "ADVANCE_PAYMENT_AMOUNT";
export const ADVANCE_PAYMENT_MIN = 1;
export const ADVANCE_PAYMENT_MAX = 50000;
export const BOOKING_LOCK_MINUTES_KEY = "BOOKING_LOCK_MINUTES";
export const BOOKING_LOCK_MINUTES_MIN = 1;
export const BOOKING_LOCK_MINUTES_MAX = 60;
export const DEFAULT_BOOKING_LOCK_MINUTES = 10;

export const PRIORITY_SETTING_KEYS = [
  "SPECIAL_SLOT_TEXT",
  ADVANCE_PAYMENT_AMOUNT_KEY,
  BOOKING_LOCK_MINUTES_KEY,
  SLOT_EXPIRY_MODE_KEY,
  SLOT_EXPIRY_GRACE_MINUTES_KEY,
] as const;

export const APP_SETTING_META: Record<string, SettingMeta> = {
  SPECIAL_SLOT_TEXT: {
    label: "Special Slot Badge Text",
    description:
      "Text displayed on highlighted or promotional slots. Example: Special Price, Limited Offer, Prime Slot.",
    type: "text",
    placeholder: "Special Price",
    defaultValue: "Special Price",
  },
  [ADVANCE_PAYMENT_AMOUNT_KEY]: {
    label: "Advance Payment Amount",
    description:
      "Amount collected at the time of booking confirmation. This is the minimum payment required to secure a slot. Example: ₹750.",
    type: "number",
    placeholder: "750",
    defaultValue: "750",
    max: ADVANCE_PAYMENT_MAX,
    step: 1,
  },
  [BOOKING_LOCK_MINUTES_KEY]: {
    label: "Slot Lock Duration (minutes)",
    description:
      "How long a customer slot reservation stays active before auto-expiry. After this duration, the slot becomes available to other customers. Example: 10 minutes.",
    type: "number",
    placeholder: String(DEFAULT_BOOKING_LOCK_MINUTES),
    defaultValue: String(DEFAULT_BOOKING_LOCK_MINUTES),
    min: BOOKING_LOCK_MINUTES_MIN,
    max: BOOKING_LOCK_MINUTES_MAX,
    step: 1,
  },
  [SLOT_EXPIRY_MODE_KEY]: {
    label: "Slot Expiry Mode",
    description:
      "Defines when a slot becomes unavailable for new bookings. Options: At start time, After start time + grace period, At end time.",
    type: "select",
    placeholder: DEFAULT_SLOT_EXPIRY_MODE,
    defaultValue: DEFAULT_SLOT_EXPIRY_MODE,
    options: [
      {
        value: "START_TIME",
        label: "At start time",
      },
      {
        value: "START_TIME_WITH_GRACE",
        label: "After start time + grace period",
      },
      {
        value: "END_TIME",
        label: "At end time",
      },
    ],
  },
  [SLOT_EXPIRY_GRACE_MINUTES_KEY]: {
    label: "Slot Expiry Grace (minutes)",
    description:
      "Additional time allowed after the slot start time before it is considered expired. Used only when expiry mode is set to After start time + grace period. Example: 30 minutes.",
    type: "number",
    placeholder: String(DEFAULT_SLOT_EXPIRY_GRACE_MINUTES),
    defaultValue: String(DEFAULT_SLOT_EXPIRY_GRACE_MINUTES),
    min: SLOT_EXPIRY_GRACE_MINUTES_MIN,
    max: SLOT_EXPIRY_GRACE_MINUTES_MAX,
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

  if (key === SLOT_EXPIRY_MODE_KEY) {
    const normalized = trimmed.toUpperCase() as SlotExpiryMode;
    if (
      normalized === "START_TIME" ||
      normalized === "START_TIME_WITH_GRACE" ||
      normalized === "END_TIME"
    ) {
      return normalized;
    }
    return trimmed.toUpperCase();
  }

  if (key === SLOT_EXPIRY_GRACE_MINUTES_KEY) {
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return trimmed;
    return String(Math.trunc(parsed));
  }

  return trimmed;
}

export function validateAppSetting(key: string, value: string) {
  const normalized = normalizeAppSettingValue(key, value);

  if (key === "SPECIAL_SLOT_TEXT") {
    if (normalized.length < SPECIAL_SLOT_TEXT_MIN_LENGTH) {
      return `Use at least ${SPECIAL_SLOT_TEXT_MIN_LENGTH} characters.`;
    }
    if (normalized.length > SPECIAL_SLOT_TEXT_MAX_LENGTH) {
      return `Use at most ${SPECIAL_SLOT_TEXT_MAX_LENGTH} characters.`;
    }
    return null;
  }

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

  if (key === SLOT_EXPIRY_MODE_KEY) {
    if (
      normalized !== "START_TIME" &&
      normalized !== "START_TIME_WITH_GRACE" &&
      normalized !== "END_TIME"
    ) {
      return "Choose a valid slot expiry mode.";
    }
    return null;
  }

  if (key === SLOT_EXPIRY_GRACE_MINUTES_KEY) {
    const minutes = Number(normalized);
    if (!Number.isFinite(minutes)) {
      return "Enter a valid number.";
    }
    if (!Number.isInteger(minutes)) {
      return "Grace must be a whole number.";
    }
    if (minutes < SLOT_EXPIRY_GRACE_MINUTES_MIN) {
      return `Grace must be at least ${SLOT_EXPIRY_GRACE_MINUTES_MIN} minutes.`;
    }
    if (minutes > SLOT_EXPIRY_GRACE_MINUTES_MAX) {
      return `Grace must be at most ${SLOT_EXPIRY_GRACE_MINUTES_MAX} minutes.`;
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
