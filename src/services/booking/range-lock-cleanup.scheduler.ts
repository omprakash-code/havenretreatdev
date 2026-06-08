import { expireRangeBookingLocks } from "@/services/booking/range-lock-lifecycle.service";

const CLEANUP_INTERVAL_MS = 60_000;

declare global {
  var __rangeLockCleanupTimer: NodeJS.Timeout | undefined;
}

export function startRangeLockCleanupScheduler() {
  if (
    process.env.RANGE_BOOKING_LOCKS_ENABLED !== "true" ||
    process.env.RANGE_LOCK_CLEANUP_ENABLED !== "true" ||
    globalThis.__rangeLockCleanupTimer
  ) {
    return;
  }

  const run = () => {
    void expireRangeBookingLocks().catch((error) => {
      console.error("RANGE_LOCK_CLEANUP_FAILED", error);
    });
  };
  run();
  globalThis.__rangeLockCleanupTimer = setInterval(run, CLEANUP_INTERVAL_MS);
  globalThis.__rangeLockCleanupTimer.unref();
}
