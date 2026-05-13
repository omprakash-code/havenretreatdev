import { startCouponSweepScheduler } from "@/services/coupon/coupon-sweep.scheduler";
import { startSlotSyncScheduler } from "@/services/slot/slot-sync.scheduler";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  startCouponSweepScheduler();
  startSlotSyncScheduler();
}
