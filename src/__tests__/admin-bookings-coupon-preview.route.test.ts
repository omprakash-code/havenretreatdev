import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    slot: {
      findUnique: vi.fn(),
    },
    appSetting: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

const { getAuthenticatedAdminIdFromCookiesMock } = vi.hoisted(() => ({
  getAuthenticatedAdminIdFromCookiesMock: vi.fn(),
}));

const { evaluateAdminCouponsMock } = vi.hoisted(() => ({
  evaluateAdminCouponsMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/services/auth/adminAuth.server", () => ({
  getAuthenticatedAdminIdFromCookies: getAuthenticatedAdminIdFromCookiesMock,
}));

vi.mock("@/app/api/admin/bookings/_coupon", () => ({
  evaluateAdminCoupons: evaluateAdminCouponsMock,
}));

import { POST } from "@/app/api/admin/bookings/coupon-preview/route";

describe("POST /api/admin/bookings/coupon-preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedAdminIdFromCookiesMock.mockResolvedValue("admin-1");
    prismaMock.slot.findUnique.mockResolvedValue({
      id: "slot-1",
      theatreId: "theatre-1",
      date: new Date("2026-04-01T00:00:00.000Z"),
      startTime: "10:00",
      endTime: "11:30",
      durationMin: 90,
      theatre: {
        id: "theatre-1",
        locationId: "loc-1",
      },
    });
    prismaMock.appSetting.findUnique.mockResolvedValue({ value: "750" });
    evaluateAdminCouponsMock.mockResolvedValue({
      totalDiscount: 600,
      coupons: [
        {
          couponId: "coupon-1",
          code: "DS600",
          discountAmount: 600,
        },
      ],
      debug: [],
    });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({} as never)
    );
  });

  it("passes decorationRequired to the shared admin evaluator", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/bookings/coupon-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          couponCode: "DS600",
          slotId: "slot-1",
          decorationRequired: true,
          items: [],
          amounts: {
            slotAmount: 2000,
            nonSlotAmount: 0,
            productsTotal: 0,
            extrasTotal: 0,
          },
        }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(evaluateAdminCouponsMock).toHaveBeenCalledTimes(1);
    expect(evaluateAdminCouponsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        decorationRequired: true,
      })
    );
  });
});
