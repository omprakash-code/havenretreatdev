import { beforeEach, describe, expect, it, vi } from "vitest";

const { isInternalCouponEndpointAuthorizedMock } = vi.hoisted(() => ({
  isInternalCouponEndpointAuthorizedMock: vi.fn(),
}));
const { getCouponAuditReportMock } = vi.hoisted(() => ({
  getCouponAuditReportMock: vi.fn(),
}));
const { assessCouponHealthMock } = vi.hoisted(() => ({
  assessCouponHealthMock: vi.fn(),
}));

vi.mock("@/app/api/internal/coupon/_auth", () => ({
  isInternalCouponEndpointAuthorized: isInternalCouponEndpointAuthorizedMock,
}));

vi.mock("@/services/coupon/coupon-audit.service", () => ({
  getCouponAuditReport: getCouponAuditReportMock,
}));

vi.mock("@/services/coupon/coupon-health.service", () => ({
  assessCouponHealth: assessCouponHealthMock,
}));

import { GET } from "@/app/api/internal/coupon/health/route";

function makeRequest(url: string) {
  return new Request(url, { method: "GET" });
}

describe("GET /api/internal/coupon/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isInternalCouponEndpointAuthorizedMock.mockResolvedValue(true);
    getCouponAuditReportMock.mockResolvedValue({
      summary: {
        activeReservedCount: 0,
        activeConfirmedCount: 0,
        activeUsageCount: 0,
        staleReservedCount: 0,
        staleReservedBookingCount: 0,
        mismatchCount: 0,
      },
      mismatches: [],
      generatedAt: new Date("2026-02-25T00:00:00.000Z"),
      lockWindowMinutes: 10,
    });
    assessCouponHealthMock.mockReturnValue({
      level: "OK",
      signals: [],
    });
  });

  it("returns 401 when unauthorized", async () => {
    isInternalCouponEndpointAuthorizedMock.mockResolvedValue(false);

    const res = await GET(makeRequest("http://localhost/api/internal/coupon/health"));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("uses mismatchLimit=0 by default", async () => {
    const res = await GET(makeRequest("http://localhost/api/internal/coupon/health"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(getCouponAuditReportMock).toHaveBeenCalledWith({ mismatchLimit: 0 });
    expect(body.data.level).toBe("OK");
    expect(body.data.mismatches).toEqual([]);
  });

  it("includes mismatches when includeMismatches=true and clamps limit", async () => {
    const res = await GET(
      makeRequest("http://localhost/api/internal/coupon/health?includeMismatches=true&limit=999")
    );

    expect(res.status).toBe(200);
    expect(getCouponAuditReportMock).toHaveBeenCalledWith({ mismatchLimit: 200 });
  });
});
