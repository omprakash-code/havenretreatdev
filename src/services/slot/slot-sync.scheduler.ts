import { syncFutureSlots } from "@/services/slot/slot-sync.service";

const DEFAULT_SLOT_SYNC_INTERVAL_MINUTES = 60;
const DEFAULT_SLOT_SYNC_DAYS_AHEAD = 90;

type SlotSyncSchedulerState = {
  initialized: boolean;
  running: boolean;
  timer: NodeJS.Timeout | null;
};

declare global {
  var __slotSyncSchedulerState__: SlotSyncSchedulerState | undefined;
}

function getState(): SlotSyncSchedulerState {
  if (!globalThis.__slotSyncSchedulerState__) {
    globalThis.__slotSyncSchedulerState__ = {
      initialized: false,
      running: false,
      timer: null,
    };
  }

  return globalThis.__slotSyncSchedulerState__;
}

function isSlotSyncEnabled() {
  return String(process.env.SLOT_SYNC_ENABLED ?? "").toLowerCase() === "true";
}

function resolveSlotSyncIntervalMinutes() {
  const parsed = Number(process.env.SLOT_SYNC_INTERVAL_MINUTES ?? DEFAULT_SLOT_SYNC_INTERVAL_MINUTES);
  if (!Number.isFinite(parsed) || parsed < 5) return DEFAULT_SLOT_SYNC_INTERVAL_MINUTES;
  return Math.trunc(parsed);
}

function resolveSlotSyncDaysAhead() {
  const parsed = Number(process.env.SLOT_SYNC_DAYS_AHEAD ?? DEFAULT_SLOT_SYNC_DAYS_AHEAD);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_SLOT_SYNC_DAYS_AHEAD;
  return Math.trunc(parsed);
}

async function runSlotSync(trigger: "startup" | "interval") {
  const state = getState();
  if (state.running) {
    console.info("SLOT_SYNC_SKIP", { trigger, reason: "already_running" });
    return;
  }

  state.running = true;
  const startedAt = Date.now();
  const daysAhead = resolveSlotSyncDaysAhead();

  try {
    const result = await syncFutureSlots({ daysAhead });
    console.info("SLOT_SYNC_DONE", {
      trigger,
      created: result.createdCount,
      skipped: result.skippedExistingCount,
      durationMs: Date.now() - startedAt,
      ...(result.lockAcquired ? {} : { lock: "not_acquired" }),
      ...(result.toCreateCount > 0 ? { planned: result.toCreateCount } : {}),
      ...(result.reason ? { reason: result.reason } : {}),
    });
  } catch (error) {
    console.error("SLOT_SYNC_ERROR", {
      trigger,
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Unknown slot sync error",
    });
  } finally {
    state.running = false;
  }
}

export function startSlotSyncScheduler() {
  const state = getState();
  if (state.initialized) return;

  if (!isSlotSyncEnabled()) {
    console.info("SLOT_SYNC_DISABLED", { env: process.env.NODE_ENV ?? "unknown" });
    return;
  }

  state.initialized = true;
  const intervalMinutes = resolveSlotSyncIntervalMinutes();

  console.info("SLOT_SYNC_ENABLED", {
    intervalMin: intervalMinutes,
    daysAhead: resolveSlotSyncDaysAhead(),
  });

  void runSlotSync("startup");

  state.timer = setInterval(() => {
    void runSlotSync("interval");
  }, intervalMinutes * 60 * 1000);

  state.timer.unref?.();
}

export function stopSlotSyncSchedulerForTests() {
  const state = getState();
  if (state.timer) {
    clearInterval(state.timer);
  }
  state.timer = null;
  state.initialized = false;
  state.running = false;
}
