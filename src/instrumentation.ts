export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const [
    { startCouponSweepScheduler },
    { startRangeLockCleanupScheduler },
    { startSlotSyncScheduler },
  ] = await Promise.all([
    import("@/services/coupon/coupon-sweep.scheduler"),
    import("@/services/booking/range-lock-cleanup.scheduler"),
    import("@/services/slot/slot-sync.scheduler"),
  ]);

  startCouponSweepScheduler();
  startRangeLockCleanupScheduler();
  startSlotSyncScheduler();
}
