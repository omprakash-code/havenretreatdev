import { prisma } from "@/lib/db";

const COUPON_TTL_MINUTES = 15;

async function releaseExpiredCoupons() {
  const cutoff = new Date(
    Date.now() - COUPON_TTL_MINUTES * 60 * 1000
  );

  const released = await prisma.couponUsage.updateMany({
    where: {
      status: "RESERVED",
      reservedAt: { lt: cutoff },
      booking: {
        bookingStatus: "INCOMPLETE",
      },
    },
    data: {
      status: "RELEASED",
      releasedAt: new Date(),
    },
  });

  console.log(`[CRON] Released ${released.count} coupons`);
}

releaseExpiredCoupons()
  .catch(console.error)
  .finally(() => process.exit(0));
