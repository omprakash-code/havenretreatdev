import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    coupon: {
      findUnique: vi.fn(),
    },
    slot: {
      findUnique: vi.fn(),
    },
    couponUsage: {
      groupBy: vi.fn(),
    },
    appSetting: {
      findUnique: vi.fn(),
    },
  },
}));

const { getAuthenticatedAdminIdFromCookiesMock } = vi.hoisted(() => ({
  getAuthenticatedAdminIdFromCookiesMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/services/auth/adminAuth.server", () => ({
  getAuthenticatedAdminIdFromCookies: getAuthenticatedAdminIdFromCookiesMock,
}));

import { prisma } from "@/lib/db";
import { POST } from "@/app/api/admin/coupons/[id]/preview/route";

const baseCoupon = {
  id: "coupon-1",
  code: "SAVE300",
  discountType: "FLAT" as const,
  discountValue: 300,
  maxDiscount: null,
  isStackable: true,
  stackableCouponIds: [],
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
  validTill: new Date("2026-12-31T23:59:59.000Z"),
  scope: "BOOKING_TOTAL" as const,
  usageLimit: null,
  perUserUsageLimit: null,
  minimumAmount: null,
  locationId: "loc-1",
  isActive: true,
  isDeleted: false,
  rules: [],
};

const baseSlot = {
  id: "slot-1",
  theatreId: "theatre-1",
  date: new Date("2026-04-01T00:00:00.000Z"),
  startTime: "10:00",
  endTime: "11:00",
  finalPrice: 2000,
  theatre: {
    id: "theatre-1",
    locationId: "loc-1",
  },
};

describe("POST /api/admin/coupons/[id]/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedAdminIdFromCookiesMock.mockResolvedValue("admin-1");
    (
      prisma.appSetting.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ value: "750" });
    (
      prisma.couponUsage.groupBy as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);
    (
      prisma.coupon.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue(baseCoupon);
    (
      prisma.slot.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue(baseSlot);
  });

  it("returns a valid preview using the shared admin coupon evaluator", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/coupons/coupon-1/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slotId: "slot-1",
          items: [],
          extrasAmount: 0,
          decorationRequired: false,
        }),
      }),
      { params: Promise.resolve({ id: "coupon-1" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      valid: true,
      scope: "BOOKING_TOTAL",
      bookingTotal: 2000,
      discountAmount: 300,
      finalPayable: 1700,
      debug: {
        couponId: "coupon-1",
        code: "SAVE300",
        outcome: "APPLIED",
        finalDiscountAmount: 300,
      },
    });
    expect(prisma.couponUsage.groupBy).toHaveBeenCalledTimes(1);
  });

  it("returns invalid preview details when the coupon is inactive", async () => {
    (
      prisma.coupon.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      ...baseCoupon,
      isActive: false,
    });

    const res = await POST(
      new Request("http://localhost/api/admin/coupons/coupon-1/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slotId: "slot-1",
          items: [],
          extrasAmount: 0,
          decorationRequired: false,
        }),
      }),
      { params: Promise.resolve({ id: "coupon-1" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      valid: false,
      reason: "COUPON_INACTIVE",
      message: "This coupon is disabled.",
      bookingTotal: 2000,
      debug: {
        couponId: "coupon-1",
        code: "SAVE300",
        outcome: "REJECTED",
        rejectionReason: "COUPON_INACTIVE",
      },
    });
  });
});
