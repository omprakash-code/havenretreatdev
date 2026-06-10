export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { startCouponSweepScheduler } = await import(
    "@/services/coupon/coupon-sweep.scheduler"
  );

  startCouponSweepScheduler();
}
