import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, authMock } = vi.hoisted(() => ({
  prismaMock: {
    location: {
      findMany: vi.fn(),
    },
    theatre: {
      findMany: vi.fn(),
    },
    slotTemplate: {
      findMany: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
    coupon: {
      findMany: vi.fn(),
    },
  },
  authMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/services/auth/adminAuth.server", () => ({
  getAuthenticatedAdminIdFromCookies: authMock,
}));

import { GET } from "@/app/api/admin/coupons/options/route";

function makeRequest(url: string) {
  return new Request(url, { method: "GET" });
}

describe("GET /api/admin/coupons/options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue("admin-1");
    prismaMock.location.findMany.mockResolvedValue([{ id: "loc_1", name: "Pitampura" }]);
    prismaMock.theatre.findMany.mockResolvedValue([
      {
        id: "theatre_1",
        name: "Gold",
        locationId: "loc_1",
        location: { name: "Pitampura" },
      },
    ]);
    prismaMock.slotTemplate.findMany.mockResolvedValue([
      { durationMin: 90 },
      { durationMin: 180 },
    ]);
    prismaMock.product.findMany.mockResolvedValue([
      {
        id: "product_1",
        name: "Cake",
        category: "CAKE",
        locationId: "loc_1",
        location: { name: "Pitampura" },
      },
    ]);
    prismaMock.coupon.findMany.mockResolvedValue([
      {
        id: "coupon_1",
        code: "SAVE10",
        isActive: true,
      },
    ]);
  });

  it("loads only base location and theatre options by default", async () => {
    const res = await GET(makeRequest("http://localhost/api/admin/coupons/options"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prismaMock.location.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.theatre.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.slotTemplate.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.slotTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ isActive: true }, { isCustomTemplate: true }],
        }),
      })
    );
    expect(prismaMock.product.findMany).not.toHaveBeenCalled();
    expect(prismaMock.coupon.findMany).not.toHaveBeenCalled();
    expect(body.data.slotDurations).toEqual([
      { value: 90, label: "1.5 hours (90 min)" },
      { value: 180, label: "3 hours (180 min)" },
    ]);
    expect(body.data).not.toHaveProperty("products");
    expect(body.data).not.toHaveProperty("coupons");
  });

  it("loads requested extended option sets on demand", async () => {
    const res = await GET(
      makeRequest(
        "http://localhost/api/admin/coupons/options?include=locations&include=theatres&include=products&include=coupons"
      )
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prismaMock.product.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.coupon.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.slotTemplate.findMany).not.toHaveBeenCalled();
    expect(body.data).not.toHaveProperty("slotDurations");
    expect(body.data.products).toHaveLength(1);
    expect(body.data.coupons).toHaveLength(1);
  });
});
