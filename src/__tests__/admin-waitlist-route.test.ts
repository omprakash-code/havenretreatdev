import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    waitlistEntry: {
      count: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/services/auth/adminAuth.server", () => ({
  getAuthenticatedAdminIdFromCookies: authMock,
}));

import { prisma } from "@/lib/db";
import { GET } from "@/app/api/admin/waitlist/route";
import { PATCH } from "@/app/api/admin/waitlist/[id]/route";

describe("/api/admin/waitlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue("admin-1");
  });

  it("returns 401 for unauthorized admin list request", async () => {
    authMock.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/admin/waitlist");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
  });

  it("returns paginated waitlist entries", async () => {
    (
      prisma.waitlistEntry.count as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue(1);
    (
      prisma.waitlistEntry.findMany as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      {
        id: "w1",
        reference: "WL-20260218-ABC123",
        name: "Rahul",
        phone: "9999999999",
        email: "rahul@example.com",
        city: "Delhi",
        locationPreference: "Pitampura, Delhi",
        theatrePreference: null,
        preferredDate: new Date("2026-02-20T00:00:00.000Z"),
        preferredTime: "19:00",
        peopleCount: 4,
        occasion: "birthday",
        notes: "Need decor",
        status: "NEW",
        contactedAt: null,
        closedAt: null,
        createdAt: new Date("2026-02-18T08:00:00.000Z"),
        updatedAt: new Date("2026-02-18T08:00:00.000Z"),
      },
    ]);

    const req = new Request(
      "http://localhost/api/admin/waitlist?page=1&pageSize=20"
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.pagination).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it("updates waitlist status", async () => {
    (
      prisma.waitlistEntry.update as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "w1",
      reference: "WL-20260218-ABC123",
      name: "Rahul",
      phone: "9999999999",
      email: null,
      city: "Delhi",
      locationPreference: "Pitampura, Delhi",
      theatrePreference: null,
      preferredDate: null,
      preferredTime: null,
      peopleCount: 2,
      occasion: null,
      notes: null,
      status: "CONTACTED",
      contactedAt: new Date("2026-02-18T10:00:00.000Z"),
      closedAt: null,
      createdAt: new Date("2026-02-18T09:00:00.000Z"),
      updatedAt: new Date("2026-02-18T10:00:00.000Z"),
    });

    const req = new Request("http://localhost/api/admin/waitlist/w1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONTACTED" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "w1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("CONTACTED");
    expect(prisma.waitlistEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "w1" },
      })
    );
  });
});
