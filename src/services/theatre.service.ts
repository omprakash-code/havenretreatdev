//src/services/theatre.service.ts
import {
  findAllTheatres,
  findTheatreAvailabilityCountsByLocationAndDate,
  findTheatresWithSlotsByLocationAndDate,
  unlockExpiredSlots,
} from "@/repos/theatre.repo";

const DEFAULT_UNLOCK_THROTTLE_MS = 60_000;
const configuredUnlockThrottleMs = Number(
  process.env.SLOT_UNLOCK_THROTTLE_MS ?? DEFAULT_UNLOCK_THROTTLE_MS
);
const unlockThrottleMs =
  Number.isFinite(configuredUnlockThrottleMs) &&
  configuredUnlockThrottleMs > 0
    ? configuredUnlockThrottleMs
    : DEFAULT_UNLOCK_THROTTLE_MS;

let lastUnlockRunAt = 0;
let pendingUnlockRun: Promise<void> | null = null;

/* Existing function – keep */
export async function listTheatres() {
  return findAllTheatres();
}

async function ensureExpiredSlotsUnlocked() {
  const now = Date.now();
  if (now - lastUnlockRunAt < unlockThrottleMs) {
    return;
  }

  if (pendingUnlockRun) {
    await pendingUnlockRun;
    return;
  }

  pendingUnlockRun = (async () => {
    try {
      await unlockExpiredSlots();
    } catch (error) {
      console.error("SLOT_UNLOCK_SWEEP_ERROR", error);
    } finally {
      lastUnlockRunAt = Date.now();
      pendingUnlockRun = null;
    }
  })();

  await pendingUnlockRun;
}

/* NEW: Used by /api/theatres */
export async function getTheatresWithSlots(
  locationId: string,
  date: string,
  guestToken: string | null
) {
  await ensureExpiredSlotsUnlocked();

  return findTheatresWithSlotsByLocationAndDate(locationId, date, guestToken);
}

export async function getTheatreAvailabilityCounts(
  locationId: string,
  date: string,
  guestToken: string | null
) {
  await ensureExpiredSlotsUnlocked();

  return findTheatreAvailabilityCountsByLocationAndDate(
    locationId,
    date,
    guestToken
  );
}
