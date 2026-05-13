import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock, authMock } = vi.hoisted(() => ({
  prismaMock: {
    slot: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    theatre: {
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

import { GET as getAdminSlots } from "@/app/api/admin/slots/route";
import { GET as getAdminSlotById } from "@/app/api/admin/slots/[id]/route";
import { findTheatresWithSlotsByLocationAndDate } from "@/repos/theatre.repo";

describe("Booking Slot Status Consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue("admin-1");
  });

  it("keeps BOOKED as BOOKED in admin slots list when bookingCount is 0", async () => {
    prismaMock.slot.findMany.mockResolvedValue([
      {
        id: "slot_1",
        date: new Date("2026-04-06T18:30:00.000Z"),
        startTime: "13:00",
        endTime: "16:00",
        durationMin: 180,
        regularPrice: 1599,
        salePrice: null,
        finalPrice: 1599,
        discountText: null,
        isSpecial: false,
        status: "BOOKED",
        isOverridden: false,
        overrideReason: null,
        slotModifiedAt: null,
        slotModifiedBy: null,
        createdAt: new Date("2026-02-18T14:32:06.071Z"),
        updatedAt: new Date("2026-02-25T05:00:58.027Z"),
        theatre: {
          id: "theatre_2",
          name: "Theatre 2",
        },
        template: {
          id: "template_1",
          startTime: "13:00",
          endTime: "16:00",
          durationMin: 180,
          regularPrice: 1599,
          salePrice: null,
          isCustomTemplate: false,
        },
        bookings: [],
        _count: {
          bookings: 0,
        },
      },
    ]);

    const res = await getAdminSlots(
      new NextRequest("http://localhost/api/admin/slots")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data[0]).toMatchObject({
      id: "slot_1",
      status: "BOOKED",
      bookingCount: 0,
    });
  });

  it("keeps BOOKED as BOOKED in admin slot detail when bookingCount is 0", async () => {
    prismaMock.slot.findUnique.mockResolvedValue({
      id: "slot_1",
      theatreId: "theatre_2",
      slotTemplateId: "template_1",
      date: new Date("2026-04-06T18:30:00.000Z"),
      startTime: "13:00",
      endTime: "16:00",
      durationMin: 180,
      basePrice: 1599,
      baseGuests: 4,
      regularPrice: 1599,
      salePrice: null,
      finalPrice: 1599,
      isSpecial: false,
      discountText: null,
      decorationMandatory: false,
      status: "BOOKED",
      lockedAt: null,
      lockExpiresAt: null,
      lockedBy: null,
      isOverridden: false,
      overrideReason: null,
      slotModifiedAt: null,
      slotModifiedBy: null,
      isTimingOverridden: false,
      isPricingOverridden: false,
      isStatusOverridden: false,
      createdAt: new Date("2026-02-18T14:32:06.071Z"),
      updatedAt: new Date("2026-02-25T05:00:58.027Z"),
      theatre: {
        id: "theatre_2",
        name: "Theatre 2",
      },
      template: {
        id: "template_1",
        theatreId: "theatre_2",
        startTime: "13:00",
        durationMin: 180,
        bufferMin: 30,
        regularPrice: 1599,
        salePrice: null,
        decorationMandatory: false,
        isActive: true,
        createdAt: new Date("2026-02-18T14:32:05.933Z"),
        updatedAt: new Date("2026-02-25T19:43:54.469Z"),
      },
      bookings: [],
    });

    const res = await getAdminSlotById(new NextRequest("http://localhost/api/admin/slots/slot_1"), {
      params: Promise.resolve({ id: "slot_1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      id: "slot_1",
      status: "BOOKED",
      bookingCount: 0,
    });
  });

  it("keeps BOOKED as BOOKED in theatres feed and marks it not available", async () => {
    prismaMock.theatre.findMany.mockResolvedValue([
      {
        id: "theatre_2",
        name: "Theatre 2",
        locationId: "loc_1",
        hasFood: true,
        capacity: 6,
        baseGuests: 4,
        extraPersonPrice: 300,
        decorationPrice: 750,
        advanceAmount: 750,
        footerMessage: "",
        mapUrl: null,
        menuFile: null,
        isActive: true,
        sortOrder: 2,
        createdAt: new Date("2026-02-18T14:32:05.921Z"),
        updatedAt: new Date("2026-02-25T19:43:54.456Z"),
        images: [],
        slots: [
          {
            id: "slot_1",
            theatreId: "theatre_2",
            slotTemplateId: "template_1",
            date: new Date("2026-04-06T18:30:00.000Z"),
            startTime: "13:00",
            endTime: "16:00",
            durationMin: 180,
            basePrice: 1599,
            baseGuests: 4,
            regularPrice: 1599,
            salePrice: null,
            finalPrice: 1599,
            isSpecial: false,
            discountText: null,
            decorationMandatory: false,
            status: "BOOKED",
            lockedAt: null,
            lockExpiresAt: null,
            lockedBy: null,
            isOverridden: false,
            overrideReason: null,
            slotModifiedAt: null,
            slotModifiedBy: null,
            isTimingOverridden: false,
            isPricingOverridden: false,
            isStatusOverridden: false,
            createdAt: new Date("2026-02-18T14:32:06.071Z"),
            updatedAt: new Date("2026-02-25T05:00:58.027Z"),
            bookings: [],
          },
        ],
      },
    ]);

    const result = await findTheatresWithSlotsByLocationAndDate(
      "loc_1",
      "2026-04-06",
      null
    );

    expect(result[0]?.slots[0]).toMatchObject({
      id: "slot_1",
      status: "BOOKED",
      isBooked: true,
      isAvailable: false,
      statusLabel: "Booked",
    });
  });
});
