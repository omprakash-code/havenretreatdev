import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth/adminAuth.server", () => ({
  getAuthenticatedAdminIdFromCookies: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    appSetting: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
import { GET, PATCH } from "@/app/api/admin/settings/coupon-widgets/route";
import { getDefaultHomeCouponWidgetSettings } from "@/lib/coupon-widget-settings";

describe("/api/admin/settings/coupon-widgets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when admin is not authenticated", async () => {
    (
      getAuthenticatedAdminIdFromCookies as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toMatchObject({
      success: false,
      message: "Unauthorized",
    });
  });

  it("returns defaults when rows are missing", async () => {
    (
      getAuthenticatedAdminIdFromCookies as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue("admin-1");
    (
      prisma.appSetting.findMany as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toEqual(getDefaultHomeCouponWidgetSettings());
  });

  it("saves settings and returns normalized payload", async () => {
    (
      getAuthenticatedAdminIdFromCookies as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue("admin-1");
    (
      prisma.appSetting.upsert as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({});
    (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      []
    );
    (
      prisma.appSetting.findMany as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce([
      {
        key: "HOME_COUPON_DRAWER_CONFIG_JSON",
        value: JSON.stringify({
          status: "on",
          triggerLabel: "Deals",
          title: "Best Deals",
          subtitle: "Pick one",
          desktopPosition: "left",
          mobilePosition: "bottom-left",
          coupons: [
            {
              id: "deal1",
              code: "DEAL50",
              description: "50 off",
              badge: "50 OFF",
              terms: "Terms apply",
              isActive: true,
              sortOrder: 1,
            },
          ],
        }),
      },
      {
        key: "HOME_COUPON_STRIP_CONFIG_JSON",
        value: JSON.stringify({
          status: "on",
          message: "Save more",
          couponCode: "DEAL50",
          dismissForHours: 1,
          forceShow: false,
          appearDelayMs: 1500,
          ctaLabel: "Book",
          ctaHref: "/booking",
          position: "bottom",
          ctaPosition: "right",
        }),
      },
    ]);

    const req = new Request("http://localhost/api/admin/settings/coupon-widgets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        drawer: {
          status: "on",
          triggerLabel: "Deals",
          title: "Best Deals",
          subtitle: "Pick one",
          desktopPosition: "left",
          mobilePosition: "bottom-left",
          coupons: [
            {
              id: "deal1",
              code: "deal50",
              description: "50 off",
              badge: "50 OFF",
              terms: "Terms apply",
              isActive: true,
              sortOrder: 1,
            },
          ],
        },
        strip: {
          status: "on",
          message: "Save more",
          couponCode: "deal50",
          dismissForHours: 1,
          forceShow: false,
          appearDelayMs: 1500,
          ctaLabel: "Book",
          ctaHref: "/booking",
          position: "bottom",
          ctaPosition: "right",
        },
      }),
    });

    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.appSetting.upsert).toHaveBeenCalledTimes(2);
    expect(json.data.drawer.status).toBe("on");
    expect(json.data.drawer.desktopPosition).toBe("left");
    expect(json.data.drawer.coupons[0].code).toBe("DEAL50");
    expect(json.data.strip.status).toBe("on");
    expect(json.data.strip.couponCode).toBe("DEAL50");
  });
});
