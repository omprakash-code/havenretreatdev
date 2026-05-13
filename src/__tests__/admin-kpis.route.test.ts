import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
  },
}));

const { getCouponAuditReportMock } = vi.hoisted(() => ({
  getCouponAuditReportMock: vi.fn(),
}));

const { assessCouponHealthMock } = vi.hoisted(() => ({
  assessCouponHealthMock: vi.fn(),
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

vi.mock("@/services/coupon/coupon-audit.service", () => ({
  getCouponAuditReport: getCouponAuditReportMock,
}));

vi.mock("@/services/coupon/coupon-health.service", () => ({
  assessCouponHealth: assessCouponHealthMock,
}));

import { GET } from "@/app/api/admin/kpis/route";

describe("GET /api/admin/kpis", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getAuthenticatedAdminIdFromCookiesMock.mockResolvedValue("admin-1");
    prismaMock.$queryRaw.mockResolvedValue([
      {
        revenue_lifetime: 12345,
        confirmed_lifetime: 40,
        abandoned_lifetime: 7,
        live_bookings: 3,
        revenue_current: 0,
        revenue_previous: 0,
        confirmed_current: 0,
        confirmed_previous: 0,
        abandoned_current: 0,
        abandoned_previous: 0,
      },
    ]);

    getCouponAuditReportMock.mockResolvedValue({
      summary: {
        activeReservedCount: 1,
        activeConfirmedCount: 8,
        activeUsageCount: 9,
        staleReservedCount: 1,
        staleReservedBookingCount: 1,
        mismatchCount: 2,
      },
      mismatches: [],
      generatedAt: new Date("2026-02-25T10:00:00.000Z"),
      lockWindowMinutes: 10,
    });

    assessCouponHealthMock.mockReturnValue({
      level: "WARNING",
      signals: [
        {
          key: "mismatchCount",
          level: "WARNING",
          value: 2,
          warnThreshold: 1,
          criticalThreshold: 5,
        },
      ],
    });
  });

  it("returns coupon ops health alongside existing KPI payload", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      revenueLifetime: 12345,
      confirmedLifetime: 40,
      abandonedLifetime: 7,
      liveBookings: 3,
      couponHealth: {
        staleReservedCount: 1,
        mismatchCount: 2,
      },
      couponOps: {
        level: "WARNING",
        signals: [
          {
            key: "mismatchCount",
            level: "WARNING",
          },
        ],
        alerting: {
          enabled: false,
          minLevel: "CRITICAL",
        },
      },
    });

    expect(getCouponAuditReportMock).toHaveBeenCalledWith({ mismatchLimit: 0 });
    expect(assessCouponHealthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mismatchCount: 2,
      })
    );
  });

  it("returns 401 when admin is not authenticated", async () => {
    getAuthenticatedAdminIdFromCookiesMock.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toMatchObject({
      success: false,
      message: "Unauthorized",
    });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });
});
