import { beforeEach, describe, expect, it, vi } from "vitest";

const { compareRangesMock, compareDatesMock } = vi.hoisted(() => ({
  compareRangesMock: vi.fn(),
  compareDatesMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    slot: { findMany: vi.fn() },
    booking: { findMany: vi.fn() },
  },
}));

vi.mock("@/services/availability/availability-shadow.service", () => ({
  compareTimeRangeAvailability: compareRangesMock,
  compareLegacyDates: compareDatesMock,
  scheduleAvailabilityShadow: (task: () => Promise<void>) => task(),
}));

import { prisma } from "@/lib/db";
import { GET as getDates } from "@/app/api/availability/dates/route";
import { GET as getTimeRanges } from "@/app/api/availability/time-ranges/route";

describe("availability shadow route integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RANGE_AVAILABILITY_PRIMARY = "false";
    compareRangesMock.mockResolvedValue(undefined);
    compareDatesMock.mockResolvedValue(undefined);
  });

  it("preserves the legacy time-ranges response while shadowing", async () => {
    vi.mocked(prisma.slot.findMany).mockResolvedValue([
      { startTime: "09:00", endTime: "13:00", status: "BOOKED" },
    ] as never);
    vi.mocked(prisma.booking.findMany).mockResolvedValue([]);

    const res = await getTimeRanges(
      new Request(
        "http://localhost/api/availability/time-ranges?locationId=loc-1&date=2026-07-04"
      )
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      success: true,
      date: "2026-07-04",
      data: [{ startTime: "09:00", endTime: "13:00", reason: "BOOKED" }],
    });
    expect(compareRangesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        locationId: "loc-1",
        date: "2026-07-04",
        legacyRanges: json.data,
      })
    );
  });

  it("preserves the legacy dates response while shadowing", async () => {
    vi.mocked(prisma.slot.findMany).mockResolvedValue([
      { date: new Date("2026-07-04T00:00:00+05:30") },
    ] as never);

    const res = await getDates(
      new Request("http://localhost/api/availability/dates?locationId=loc-1")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      success: true,
      data: [{ date: "2026-07-04", isWeekend: true }],
    });
    expect(compareDatesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        locationId: "loc-1",
        legacyDates: ["2026-07-04"],
      })
    );
  });
});
