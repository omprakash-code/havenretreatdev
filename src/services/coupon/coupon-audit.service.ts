import { BookingStatus, PaymentStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { resolveBookingLockMinutes } from "@/services/booking/lockBooking.service";

const ACTIVE_COUPON_STATUSES = ["RESERVED", "CONFIRMED"] as const;

export type CouponDiscountMismatch = {
  bookingId: string;
  bookingRef: string;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus | null;
  bookingDiscountAmount: number;
  activeUsageDiscountSum: number;
  activeUsageCount: number;
  usageStatuses: Array<(typeof ACTIVE_COUPON_STATUSES)[number]>;
  createdAt: Date;
  updatedAt: Date;
  totalAmount: number;
  advancePaid: number;
  remainingPayable: number;
  isFullyPaid: boolean;
};

export type CouponAuditSummary = {
  activeReservedCount: number;
  activeConfirmedCount: number;
  activeUsageCount: number;
  staleReservedCount: number;
  staleReservedBookingCount: number;
  mismatchCount: number;
};

export type CouponAuditReport = {
  summary: CouponAuditSummary;
  mismatches: CouponDiscountMismatch[];
  generatedAt: Date;
  lockWindowMinutes: number;
};

function getStaleThreshold(now: Date, lockWindowMinutes: number) {
  return new Date(now.getTime() - lockWindowMinutes * 60 * 1000);
}

function getStaleReservedWhere(staleBefore: Date): Prisma.CouponUsageWhereInput {
  const staleBookingStatuses: BookingStatus[] = [
    BookingStatus.INCOMPLETE,
    BookingStatus.ABANDONED,
    BookingStatus.PAID_EXPIRED,
  ];

  return {
    status: "RESERVED",
    reservedAt: {
      lt: staleBefore,
    },
    booking: {
      bookingStatus: {
        not: BookingStatus.CONFIRMED,
      },
      OR: [
        {
          bookingStatus: {
            in: staleBookingStatuses,
          },
        },
        {
          paymentStatus: PaymentStatus.EXPIRED,
        },
        {
          updatedAt: {
            lt: staleBefore,
          },
        },
      ],
    },
  };
}

export async function getCouponAuditReport(input?: {
  mismatchLimit?: number;
}): Promise<CouponAuditReport> {
  const mismatchLimit = Math.max(Number(input?.mismatchLimit ?? 50), 0);
  const now = new Date();
  const lockWindowMinutes = await resolveBookingLockMinutes();
  const staleBefore = getStaleThreshold(now, lockWindowMinutes);

  const [activeCounts, staleReservedCount, staleReservedBookings, activeDiscountByBooking] =
    await Promise.all([
      prisma.couponUsage.groupBy({
        by: ["status"],
        where: {
          status: {
            in: [...ACTIVE_COUPON_STATUSES],
          },
        },
        _count: {
          _all: true,
        },
      }),
      prisma.couponUsage.count({
        where: getStaleReservedWhere(staleBefore),
      }),
      prisma.couponUsage.findMany({
        where: getStaleReservedWhere(staleBefore),
        distinct: ["bookingId"],
        select: {
          bookingId: true,
        },
      }),
      prisma.couponUsage.groupBy({
        by: ["bookingId"],
        where: {
          bookingId: {
            not: null,
          },
          status: {
            in: [...ACTIVE_COUPON_STATUSES],
          },
        },
        _sum: {
          discountAmount: true,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

  const activeReservedCount =
    activeCounts.find((row) => row.status === "RESERVED")?._count._all ?? 0;
  const activeConfirmedCount =
    activeCounts.find((row) => row.status === "CONFIRMED")?._count._all ?? 0;

  const bookingIds = activeDiscountByBooking
    .map((row) => row.bookingId)
    .filter((id): id is string => Boolean(id));

  if (bookingIds.length === 0) {
    return {
      summary: {
        activeReservedCount,
        activeConfirmedCount,
        activeUsageCount: activeReservedCount + activeConfirmedCount,
        staleReservedCount,
        staleReservedBookingCount: staleReservedBookings.filter((row) => row.bookingId).length,
        mismatchCount: 0,
      },
      mismatches: [],
      generatedAt: now,
      lockWindowMinutes,
    };
  }

  const bookings = await prisma.booking.findMany({
    where: {
      id: {
        in: bookingIds,
      },
    },
    select: {
      id: true,
      bookingRef: true,
      bookingStatus: true,
      paymentStatus: true,
      discountAmount: true,
      createdAt: true,
      updatedAt: true,
      totalAmount: true,
      advancePaid: true,
      remainingPayable: true,
    },
  });

  const usageAggregateByBookingId = new Map(
    activeDiscountByBooking
      .filter((row) => Boolean(row.bookingId))
      .map((row) => [
        row.bookingId as string,
        {
          sum: Number(row._sum.discountAmount ?? 0),
          count: row._count._all,
        },
      ])
  );

  const mismatchBase = bookings
    .map((booking) => {
      const usage = usageAggregateByBookingId.get(booking.id) ?? {
        sum: 0,
        count: 0,
      };

      return {
        booking,
        usage,
      };
    })
    .filter(({ booking, usage }) => booking.discountAmount !== usage.sum);

  const mismatchIds = mismatchBase.map(({ booking }) => booking.id);

  const mismatchUsageStatuses =
    mismatchIds.length > 0
      ? await prisma.couponUsage.findMany({
          where: {
            bookingId: {
              in: mismatchIds,
            },
            status: {
              in: [...ACTIVE_COUPON_STATUSES],
            },
          },
          select: {
            bookingId: true,
            status: true,
          },
        })
      : [];

  const statusesByBookingId = new Map<string, Set<(typeof ACTIVE_COUPON_STATUSES)[number]>>();
  mismatchUsageStatuses.forEach((usage) => {
    if (!usage.bookingId) return;
    const set = statusesByBookingId.get(usage.bookingId) ?? new Set();
    if (usage.status === "RESERVED" || usage.status === "CONFIRMED") {
      set.add(usage.status);
    }
    statusesByBookingId.set(usage.bookingId, set);
  });

  const mismatches: CouponDiscountMismatch[] = mismatchBase
    .slice(0, mismatchLimit)
    .map(({ booking, usage }) => ({
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
      bookingDiscountAmount: booking.discountAmount,
      activeUsageDiscountSum: usage.sum,
      activeUsageCount: usage.count,
      usageStatuses: Array.from(statusesByBookingId.get(booking.id) ?? []),
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      totalAmount: booking.totalAmount,
      advancePaid: booking.advancePaid,
      remainingPayable: booking.remainingPayable,
      isFullyPaid: booking.remainingPayable <= 0,
    }));

  return {
    summary: {
      activeReservedCount,
      activeConfirmedCount,
      activeUsageCount: activeReservedCount + activeConfirmedCount,
      staleReservedCount,
      staleReservedBookingCount: staleReservedBookings.filter((row) => row.bookingId).length,
      mismatchCount: mismatchBase.length,
    },
    mismatches,
    generatedAt: now,
    lockWindowMinutes,
  };
}
