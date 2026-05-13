import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock, authMock } = vi.hoisted(() => ({
  prismaMock: {
    slot: {
      findUnique: vi.fn(),
      delete: vi.fn(),
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

import { DELETE } from "@/app/api/admin/slots/[id]/route";

describe("DELETE /api/admin/slots/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue("admin_1");
  });

  it("returns 401 when admin is not authenticated", async () => {
    authMock.mockResolvedValueOnce(null);

    const res = await DELETE(
      new NextRequest("http://localhost/api/admin/slots/slot_1"),
      { params: Promise.resolve({ id: "slot_1" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.message).toBe("Unauthorized");
  });

  it("deletes custom slot with no booking history", async () => {
    prismaMock.slot.findUnique.mockResolvedValue({
      id: "slot_1",
      status: "AVAILABLE",
      overrideReason: "MANUAL_SLOT_CREATED",
      _count: { bookings: 0 },
    });
    prismaMock.slot.delete.mockResolvedValue({ id: "slot_1" });

    const res = await DELETE(
      new NextRequest("http://localhost/api/admin/slots/slot_1"),
      { params: Promise.resolve({ id: "slot_1" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prismaMock.slot.delete).toHaveBeenCalledWith({
      where: { id: "slot_1" },
    });
  });

  it("blocks deletion when slot has booking history", async () => {
    prismaMock.slot.findUnique.mockResolvedValue({
      id: "slot_2",
      status: "AVAILABLE",
      overrideReason: "MANUAL_SLOT_CREATED",
      _count: { bookings: 1 },
    });

    const res = await DELETE(
      new NextRequest("http://localhost/api/admin/slots/slot_2"),
      { params: Promise.resolve({ id: "slot_2" }) }
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.code).toBe("SLOT_DELETE_NOT_ALLOWED");
    expect(prismaMock.slot.delete).not.toHaveBeenCalled();
  });
});
