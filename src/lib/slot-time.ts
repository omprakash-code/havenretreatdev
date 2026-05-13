import { timeToMinutes } from "@/lib/time";
import { formatInTimeZone } from "date-fns-tz";

const IST_TIMEZONE = "Asia/Kolkata";

export const SLOT_EXPIRY_MODE_KEY = "SLOT_EXPIRY_MODE";
export const SLOT_EXPIRY_GRACE_MINUTES_KEY = "SLOT_EXPIRY_GRACE_MINUTES";
export const DEFAULT_SLOT_EXPIRY_MODE = "START_TIME";
export const DEFAULT_SLOT_EXPIRY_GRACE_MINUTES = 30;
export const SLOT_EXPIRY_GRACE_MINUTES_MIN = 0;
export const SLOT_EXPIRY_GRACE_MINUTES_MAX = 180;

type SlotLike = {
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
};

export type SlotExpiryMode = "END_TIME" | "START_TIME" | "START_TIME_WITH_GRACE";

export type SlotExpiryConfig = {
  mode: SlotExpiryMode;
  graceMinutes?: number; // only for START_TIME_WITH_GRACE
};

const SLOT_EXPIRY_MODES: SlotExpiryMode[] = [
  "END_TIME",
  "START_TIME",
  "START_TIME_WITH_GRACE",
];

function normalizeSlotExpiryMode(value: unknown): SlotExpiryMode {
  const normalized = String(value ?? "").trim().toUpperCase() as SlotExpiryMode;
  if (SLOT_EXPIRY_MODES.includes(normalized)) return normalized;
  return DEFAULT_SLOT_EXPIRY_MODE;
}

function normalizeSlotExpiryGraceMinutes(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_SLOT_EXPIRY_GRACE_MINUTES;
  const normalized = Math.trunc(parsed);
  if (normalized < SLOT_EXPIRY_GRACE_MINUTES_MIN) return SLOT_EXPIRY_GRACE_MINUTES_MIN;
  if (normalized > SLOT_EXPIRY_GRACE_MINUTES_MAX) return SLOT_EXPIRY_GRACE_MINUTES_MAX;
  return normalized;
}

export function resolveSlotExpiryConfigFromSettingsMap(
  map?: Record<string, unknown> | null
): SlotExpiryConfig {
  const mode = normalizeSlotExpiryMode(map?.[SLOT_EXPIRY_MODE_KEY]);
  const graceMinutes = normalizeSlotExpiryGraceMinutes(
    map?.[SLOT_EXPIRY_GRACE_MINUTES_KEY]
  );
  return { mode, graceMinutes };
}

/**
 * Determines if a slot is expired in IST
 * Supports:
 * 1. END_TIME               → expires after slot ends
 * 2. START_TIME             → expires immediately when slot starts
 * 3. START_TIME_WITH_GRACE  → expires X minutes after start
 */
export function isSlotExpiredInIST(
  slot: SlotLike,
  bookingDate: Date,
  config: SlotExpiryConfig = { mode: "END_TIME" }
): boolean {
  const dateKey = formatInTimeZone(bookingDate, IST_TIMEZONE, "yyyy-MM-dd");

  // Build base start time (IST)
  const slotStartTimeIST = new Date(
    `${dateKey}T${slot.startTime}:00+05:30`
  );

  // Build base end time (IST)
  let slotEndTimeIST = new Date(
    `${dateKey}T${slot.endTime}:00+05:30`
  );

  const isOvernight =
    timeToMinutes(slot.endTime) <= timeToMinutes(slot.startTime);

  // Overnight slot → end moves to next day
  if (isOvernight) {
    slotEndTimeIST = new Date(
      slotEndTimeIST.getTime() + 24 * 60 * 60 * 1000
    );
  }

  // Compare with absolute current time (UTC timestamp safe)
  const nowMs = Date.now();

  switch (config.mode) {
    case "START_TIME":
      return nowMs >= slotStartTimeIST.getTime();

    case "START_TIME_WITH_GRACE": {
      const grace = config.graceMinutes ?? 0;
      const graceExpiry = new Date(
        slotStartTimeIST.getTime() + grace * 60 * 1000
      );
      return nowMs >= graceExpiry.getTime();
    }

    case "END_TIME":
    default:
      return nowMs >= slotEndTimeIST.getTime();
  }
}
