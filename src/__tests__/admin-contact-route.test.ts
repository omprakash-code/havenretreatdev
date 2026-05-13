import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    contactInquiry: {
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
import { GET } from "@/app/api/admin/contact/route";
import { PATCH } from "@/app/api/admin/contact/[id]/route";

describe("/api/admin/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue("admin-1");
  });

  it("returns 401 for unauthorized admin list request", async () => {
    authMock.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/admin/contact");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
  });

  it("returns paginated contact inquiries", async () => {
    (
      prisma.contactInquiry.count as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue(1);
    (
      prisma.contactInquiry.findMany as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      {
        id: "c1",
        name: "Aarav",
        mobile: "9999999999",
        message: "Please call me back.",
        status: "NEW",
        isRead: false,
        respondedAt: null,
        createdAt: new Date("2026-02-19T08:00:00.000Z"),
        updatedAt: new Date("2026-02-19T08:00:00.000Z"),
      },
    ]);

    const req = new Request("http://localhost/api/admin/contact?page=1&pageSize=20");
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

  it("updates inquiry status", async () => {
    (
      prisma.contactInquiry.update as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "c1",
      name: "Aarav",
      mobile: "9999999999",
      message: "Please call me back.",
      status: "CONTACTED",
      isRead: true,
      respondedAt: new Date("2026-02-19T10:00:00.000Z"),
      createdAt: new Date("2026-02-19T08:00:00.000Z"),
      updatedAt: new Date("2026-02-19T10:00:00.000Z"),
    });

    const req = new Request("http://localhost/api/admin/contact/c1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONTACTED" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "c1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("CONTACTED");
    expect(prisma.contactInquiry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1" },
        data: expect.objectContaining({
          status: "CONTACTED",
          isRead: true,
        }),
      })
    );
  });
});
