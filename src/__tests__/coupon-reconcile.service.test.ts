import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db";
import { reconcileCouponDiscountMismatches } from "@/services/coupon/coupon-reconcile.service";

type TxMock = {
  couponUsage: {
    groupBy: ReturnType<typeof vi.fn>;
  };
  booking: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

function createTxMock(): TxMock {
  return {
    couponUsage: {
      groupBy: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

function mockTransaction(tx: TxMock) {
  (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    async (cb: (innerTx: TxMock) => Promise<unknown>) => cb(tx)
  );
}

describe("reconcileCouponDiscountMismatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns dry-run mismatches without updates", async () => {
    const tx = createTxMock();
    mockTransaction(tx);

    tx.couponUsage.groupBy.mockResolvedValue([
      {
        bookingId: "booking-1",
        _sum: { discountAmount: 400 },
      },
    ]);

    tx.booking.findMany.mockResolvedValue([
      {
        id: "booking-1",
        bookingRef: "DS_TEST_1",
        bookingStatus: "INCOMPLETE",
        discountAmount: 600,
      },
    ]);

    const result = await reconcileCouponDiscountMismatches({
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.scannedCount).toBe(1);
    expect(result.mismatchCount).toBe(1);
    expect(result.updatedCount).toBe(0);
    expect(result.mismatches[0]).toMatchObject({
      bookingId: "booking-1",
      currentDiscountAmount: 600,
      expectedDiscountAmount: 400,
    });
    expect(tx.booking.update).not.toHaveBeenCalled();
  });

  it("updates discountAmount when dryRun is false", async () => {
    const tx = createTxMock();
    mockTransaction(tx);

    tx.couponUsage.groupBy.mockResolvedValue([
      {
        bookingId: "booking-1",
        _sum: { discountAmount: 300 },
      },
      {
        bookingId: "booking-2",
        _sum: { discountAmount: 200 },
      },
    ]);

    tx.booking.findMany.mockResolvedValue([
      {
        id: "booking-1",
        bookingRef: "DS_TEST_1",
        bookingStatus: "INCOMPLETE",
        discountAmount: 500,
      },
      {
        id: "booking-2",
        bookingRef: "DS_TEST_2",
        bookingStatus: "AWAITING_PAYMENT",
        discountAmount: 200,
      },
    ]);

    const result = await reconcileCouponDiscountMismatches({
      dryRun: false,
    });

    expect(result.dryRun).toBe(false);
    expect(result.scannedCount).toBe(2);
    expect(result.mismatchCount).toBe(1);
    expect(result.updatedCount).toBe(1);
    expect(result.updatedBookingIds).toEqual(["booking-1"]);

    expect(tx.booking.update).toHaveBeenCalledTimes(1);
    expect(tx.booking.update).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      data: { discountAmount: 300 },
    });
  });
});
