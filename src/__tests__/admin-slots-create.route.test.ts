import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, authMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    slot: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    theatre: {
      findUnique: vi.fn(),
    },
    slotTemplate: {
      findFirst: vi.fn(),
      create: vi.fn(),
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

import { POST } from "@/app/api/admin/slots/route";

function buildRequest(payload: unknown) {
  return new Request("http://localhost/api/admin/slots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/admin/slots", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T12:00:00.000Z"));
    vi.clearAllMocks();
    authMock.mockResolvedValue("admin_1");
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
      callback(prismaMock)
    );
    prismaMock.slot.findFirst.mockResolvedValue(null);
    prismaMock.slot.findMany.mockResolvedValue([]);
    prismaMock.theatre.findUnique.mockResolvedValue({
      id: "theatre_1",
      baseGuests: 2,
    });
    prismaMock.slotTemplate.findFirst.mockResolvedValue({
      id: "template_existing",
      decorationMandatory: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 401 when admin is not authenticated", async () => {
    authMock.mockResolvedValueOnce(null);

    const res = await POST(
      buildRequest({
        theatreId: "theatre_1",
        date: "2026-04-08",
        timing: { startTime: "09:00", endTime: "12:00" },
        pricing: { regularPrice: 1499, salePrice: null },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.message).toBe("Unauthorized");
  });

  it("creates a manual slot when input is valid", async () => {
    prismaMock.slot.create.mockResolvedValue({
      id: "slot_new",
      date: new Date("2026-04-08T00:00:00+05:30"),
      startTime: "09:00",
      endTime: "12:00",
      durationMin: 180,
      regularPrice: 1499,
      salePrice: 1299,
      finalPrice: 1299,
      discountText: "Morning Offer",
      isSpecial: true,
      status: "AVAILABLE",
      isOverridden: false,
      overrideReason: null,
      slotModifiedAt: null,
      slotModifiedBy: null,
      createdAt: new Date("2026-03-05T12:00:00.000Z"),
      updatedAt: new Date("2026-03-05T12:00:00.000Z"),
      theatre: {
        id: "theatre_1",
        name: "Theatre 1",
      },
      template: {
        id: "template_existing",
        startTime: "09:00",
        endTime: "12:00",
        durationMin: 180,
        regularPrice: 1499,
        salePrice: 1299,
      },
      bookings: [],
    });

    const res = await POST(
      buildRequest({
        theatreId: "theatre_1",
        date: "2026-04-08",
        timing: { startTime: "09:00", endTime: "12:00" },
        pricing: { regularPrice: 1499, salePrice: 1299 },
        status: { value: "AVAILABLE", discountText: "Morning Offer" },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      id: "slot_new",
      date: "2026-04-08",
      startTime: "09:00",
      endTime: "12:00",
      status: "AVAILABLE",
      bookingCount: 0,
    });

    expect(prismaMock.slot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          theatreId: "theatre_1",
          slotTemplateId: "template_existing",
          startTime: "09:00",
          endTime: "12:00",
          regularPrice: 1499,
          salePrice: 1299,
          finalPrice: 1299,
        }),
      })
    );
  });

  it("returns 409 when requested slot overlaps an existing slot", async () => {
    prismaMock.slot.findMany.mockResolvedValueOnce([
      {
        date: new Date("2026-04-08T00:00:00+05:30"),
        startTime: "09:30",
        endTime: "12:30",
        template: {
          bufferMin: 30,
        },
      },
    ]);

    const res = await POST(
      buildRequest({
        theatreId: "theatre_1",
        date: "2026-04-08",
        timing: { startTime: "09:00", endTime: "12:00" },
        pricing: { regularPrice: 1499, salePrice: null },
      })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.code).toBe("SLOT_OVERLAP");
    expect(prismaMock.slot.create).not.toHaveBeenCalled();
  });
});
