import { BookingStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

const ACTIVE_COUPON_STATUSES = ["RESERVED", "CONFIRMED"] as const;

export type CouponReconcileMismatch = {
  bookingId: string;
  bookingRef: string;
  bookingStatus: BookingStatus;
  currentDiscountAmount: number;
  expectedDiscountAmount: number;
};

export type CouponReconcileResult = {
  dryRun: boolean;
  scannedCount: number;
  mismatchCount: number;
  updatedCount: number;
  mismatches: CouponReconcileMismatch[];
  updatedBookingIds: string[];
};

type ReconcileOptions = {
  dryRun?: boolean;
  includeConfirmed?: boolean;
  bookingIds?: string[];
  limit?: number;
};

function normalizeBookingIds(input?: string[]) {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(input.map((id) => String(id ?? "").trim()).filter(Boolean))
  );
}

export async function reconcileCouponDiscountMismatches(
  options?: ReconcileOptions
): Promise<CouponReconcileResult> {
  const dryRun = options?.dryRun ?? true;
  const includeConfirmed = options?.includeConfirmed ?? false;
  const limit = Math.min(Math.max(Math.trunc(Number(options?.limit ?? 200)), 1), 1000);
  const targetBookingIds = normalizeBookingIds(options?.bookingIds);

  return prisma.$transaction(async (tx) => {
    const usageWhere: Prisma.CouponUsageWhereInput = {
      bookingId: targetBookingIds.length > 0 ? { in: targetBookingIds } : { not: null },
      status: {
        in: [...ACTIVE_COUPON_STATUSES],
      },
    };

    const usageByBooking = await tx.couponUsage.groupBy({
      by: ["bookingId"],
      where: usageWhere,
      _sum: {
        discountAmount: true,
      },
    });

    const bookingIds = usageByBooking
      .map((row) => row.bookingId)
      .filter((id): id is string => Boolean(id));

    if (bookingIds.length === 0) {
      return {
        dryRun,
        scannedCount: 0,
        mismatchCount: 0,
        updatedCount: 0,
        mismatches: [],
        updatedBookingIds: [],
      };
    }

    const bookingWhere: Prisma.BookingWhereInput = {
      id: { in: bookingIds },
      ...(includeConfirmed ? {} : { bookingStatus: { not: BookingStatus.CONFIRMED } }),
    };

    const bookings = await tx.booking.findMany({
      where: bookingWhere,
      select: {
        id: true,
        bookingRef: true,
        bookingStatus: true,
        discountAmount: true,
      },
    });

    const expectedDiscountByBookingId = new Map(
      usageByBooking
        .filter((row) => Boolean(row.bookingId))
        .map((row) => [row.bookingId as string, Number(row._sum.discountAmount ?? 0)])
    );

    const mismatches = bookings
      .map((booking) => {
        const expectedDiscountAmount = expectedDiscountByBookingId.get(booking.id) ?? 0;
        return {
          bookingId: booking.id,
          bookingRef: booking.bookingRef,
          bookingStatus: booking.bookingStatus,
          currentDiscountAmount: booking.discountAmount,
          expectedDiscountAmount,
        };
      })
      .filter((row) => row.currentDiscountAmount !== row.expectedDiscountAmount)
      .slice(0, limit);

    if (mismatches.length === 0 || dryRun) {
      return {
        dryRun,
        scannedCount: bookings.length,
        mismatchCount: mismatches.length,
        updatedCount: 0,
        mismatches,
        updatedBookingIds: [],
      };
    }

    for (const mismatch of mismatches) {
      await tx.booking.update({
        where: { id: mismatch.bookingId },
        data: {
          discountAmount: mismatch.expectedDiscountAmount,
        },
      });
    }

    return {
      dryRun,
      scannedCount: bookings.length,
      mismatchCount: mismatches.length,
      updatedCount: mismatches.length,
      mismatches,
      updatedBookingIds: mismatches.map((row) => row.bookingId),
    };
  });
}
