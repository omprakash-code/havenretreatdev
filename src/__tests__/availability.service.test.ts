import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    theatre: { findMany: vi.fn(), findUnique: vi.fn() },
    bookingSettings: { findUnique: vi.fn() },
    booking: { findMany: vi.fn() },
    bookingLock: { findMany: vi.fn() },
    availabilityBlock: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { getRangeAvailabilityForLocation } from "@/services/availability/availability.service";

describe("range availability service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.theatre.findMany).mockResolvedValue([
      { id: "theatre-1" },
    ] as never);
    vi.mocked(prisma.theatre.findUnique).mockResolvedValue({
      timezone: "America/New_York",
    } as never);
    vi.mocked(prisma.bookingSettings.findUnique).mockResolvedValue({
      id: "settings-1",
      theatreId: "theatre-1",
      businessOpenTime: "09:00",
      businessCloseTime: "23:00",
      minimumDurationMinutes: 240,
      bufferMinutes: 60,
      lockDurationMinutes: 10,
      maximumGuests: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        startsAtUtc: new Date("2026-07-04T13:00:00.000Z"),
        occupiedUntilUtc: new Date("2026-07-04T18:00:00.000Z"),
      },
    ] as never);
    vi.mocked(prisma.bookingLock.findMany).mockResolvedValue([]);
    vi.mocked(prisma.availabilityBlock.findMany).mockResolvedValue([]);
  });

  it("derives availability from booking-owned occupied ranges", async () => {
    const result = await getRangeAvailabilityForLocation({
      locationId: "location-1",
      date: "2026-07-04",
      now: new Date("2026-07-01T12:00:00.000Z"),
    });

    expect(result.unavailableRanges).toEqual([
      { startTime: "09:00", endTime: "14:00", reason: "BOOKED" },
    ]);
    expect(result.theatres[0].availableRanges).toEqual([
      { startTime: "14:00", endTime: "23:00" },
    ]);
    expect(result.hasAvailability).toBe(true);
  });

  it("queries only confirmed bookings and active unexpired locks", async () => {
    const now = new Date("2026-07-01T12:00:00.000Z");
    await getRangeAvailabilityForLocation({
      locationId: "location-1",
      date: "2026-07-04",
      now,
    });

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bookingStatus: "CONFIRMED" }),
      })
    );
    expect(prisma.bookingLock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ACTIVE",
          expiresAt: { gt: now },
        }),
      })
    );
  });
});
