import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock, authMock, resolveSlotExpiryConfigMock } = vi.hoisted(() => ({
  prismaMock: {
    slot: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
  authMock: vi.fn(),
  resolveSlotExpiryConfigMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("@/services/auth/adminAuth.server", () => ({
  getAuthenticatedAdminIdFromCookies: authMock,
}));

vi.mock("@/services/booking/slot-expiry-config.service", () => ({
  resolveSlotExpiryConfig: resolveSlotExpiryConfigMock,
}));

import { PATCH } from "@/app/api/admin/slots/[id]/route";

describe("PATCH /api/admin/slots/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue("admin_1");
    resolveSlotExpiryConfigMock.mockResolvedValue({ mode: "END_TIME" });
  });

  it("returns 400 for invalid status payload", async () => {
    const res = await PATCH(
      new NextRequest("http://localhost/api/admin/slots/slot_1", {
        method: "PATCH",
        body: JSON.stringify({
          status: { value: "BOOKED" },
          overrideReason: "Valid reason text",
        }),
      }),
      { params: Promise.resolve({ id: "slot_1" }) }
    );

    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(prismaMock.slot.findUnique).not.toHaveBeenCalled();
  });

  it("blocks re-enabling when slot now overlaps with another slot", async () => {
    prismaMock.slot.findUnique.mockResolvedValue({
      id: "slot_1",
      theatreId: "theatre_1",
      status: "DISABLED",
      date: new Date("2026-03-10T00:00:00+05:30"),
      startTime: "09:00",
      endTime: "12:00",
      durationMin: 180,
      regularPrice: 1499,
      salePrice: null,
      finalPrice: 1499,
      discountText: null,
      isSpecial: false,
      isOverridden: false,
      overrideReason: null,
      bookings: [],
      _count: { bookings: 0 },
    });

    prismaMock.slot.findMany.mockResolvedValue([
      {
        date: new Date("2026-03-10T00:00:00+05:30"),
        startTime: "11:30",
        endTime: "13:30",
        template: { bufferMin: 30 },
      },
    ]);

    const res = await PATCH(
      new NextRequest("http://localhost/api/admin/slots/slot_1", {
        method: "PATCH",
        body: JSON.stringify({
          status: { value: "AVAILABLE" },
          overrideReason: "Re-enable requested by admin",
        }),
      }),
      { params: Promise.resolve({ id: "slot_1" }) }
    );

    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.code).toBe("SLOT_OVERLAP");
    expect(prismaMock.slot.update).not.toHaveBeenCalled();
  });
});
