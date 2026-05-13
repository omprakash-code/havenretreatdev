import { prisma } from "@/lib/db";
import { resolveBookingLockMinutes } from "@/services/booking/lockBooking.service";

const ACTIVE_COUPON_STATUSES = ["RESERVED", "CONFIRMED"] as const;

export async function releaseStaleReservedCoupons(): Promise<{
  releasedCount: number;
  affectedBookings: string[];
}> {
  const now = new Date();
  const lockWindowMinutes = await resolveBookingLockMinutes();
  const staleBefore = new Date(
    now.getTime() - lockWindowMinutes * 60 * 1000
  );

  return prisma.$transaction(async (tx) => {
    const staleReservedUsages = await tx.couponUsage.findMany({
      where: {
        status: "RESERVED",
        reservedAt: {
          lt: staleBefore,
        },
        booking: {
          bookingStatus: {
            not: "CONFIRMED",
          },
          OR: [
            {
              bookingStatus: {
                in: ["INCOMPLETE", "ABANDONED", "PAID_EXPIRED"],
              },
            },
            {
              paymentStatus: "EXPIRED",
            },
            {
              updatedAt: {
                lt: staleBefore,
              },
            },
          ],
        },
      },
      select: {
        id: true,
        bookingId: true,
      },
    });

    if (staleReservedUsages.length === 0) {
      return {
        releasedCount: 0,
        affectedBookings: [],
      };
    }

    const usageIds = staleReservedUsages.map((usage) => usage.id);
    const affectedBookingIds = Array.from(
      new Set(
        staleReservedUsages
          .map((usage) => usage.bookingId)
          .filter((bookingId): bookingId is string => Boolean(bookingId))
      )
    );

    const releaseResult = await tx.couponUsage.updateMany({
      where: {
        id: {
          in: usageIds,
        },
        status: "RESERVED",
      },
      data: {
        status: "RELEASED",
        releasedAt: now,
        confirmedAt: null,
      },
    });

    if (affectedBookingIds.length > 0) {
      const activeDiscountByBooking = await tx.couponUsage.groupBy({
        by: ["bookingId"],
        where: {
          bookingId: {
            in: affectedBookingIds,
          },
          status: {
            in: [...ACTIVE_COUPON_STATUSES],
          },
        },
        _sum: {
          discountAmount: true,
        },
      });

      const discountByBooking = new Map(
        activeDiscountByBooking
          .filter((row) => Boolean(row.bookingId))
          .map((row) => [
            row.bookingId as string,
            Number(row._sum.discountAmount ?? 0),
          ])
      );

      for (const bookingId of affectedBookingIds) {
        await tx.booking.updateMany({
          where: {
            id: bookingId,
          },
          data: {
            discountAmount: discountByBooking.get(bookingId) ?? 0,
          },
        });
      }
    }

    return {
      releasedCount: releaseResult.count,
      affectedBookings: affectedBookingIds,
    };
  });
}
