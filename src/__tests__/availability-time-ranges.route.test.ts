import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ─────────────────────────────────────────────────────────────────

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    eventPackage: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    venue: {
      findMany: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { GET } from "@/app/api/availability/time-ranges/route";

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/availability/time-ranges");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

const LOCATION_ID = "loc-1";
const VENUE_ID = "venue-1";
const DATE = "2030-07-15"; // future date so "today" guard never fires

function setupDefaults() {
  prismaMock.eventPackage.findMany.mockResolvedValue([{ venueId: VENUE_ID }]);
  prismaMock.booking.findMany.mockResolvedValue([]);
  prismaMock.eventPackage.findFirst.mockResolvedValue({ eventDurationHours: 4 });
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("GET /api/availability/time-ranges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it("returns 400 when locationId is missing", async () => {
    const res = await GET(makeRequest({ date: DATE }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("returns 400 when date is missing", async () => {
    const res = await GET(makeRequest({ locationId: LOCATION_ID }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("returns 400 for an invalid date format", async () => {
    const res = await GET(makeRequest({ locationId: LOCATION_ID, date: "not-a-date" }));
    expect(res.status).toBe(400);
  });

  // ── No bookings ────────────────────────────────────────────────────────────

  it("returns empty unavailable ranges when no confirmed bookings exist", async () => {
    const res = await GET(makeRequest({ locationId: LOCATION_ID, date: DATE }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toEqual([]);
  });

  // ── Blocked ranges from local time strings ─────────────────────────────────

  it("returns a blocked range for a confirmed booking with local time strings", async () => {
    prismaMock.booking.findMany.mockResolvedValue([
      {
        eventStartTime: "14:00",
        eventEndTime: "18:00",
        startsAtUtc: null,
        occupiedUntilUtc: null,
        bookingStatus: "CONFIRMED",
        bufferMinutes: 30,
      },
    ]);
    const res = await GET(makeRequest({ locationId: LOCATION_ID, date: DATE }));
    const json = await res.json();
    const range = json.data[0];
    expect(range.startTime).toBe("14:00");
    expect(range.endTime).toBe("18:30"); // 18:00 + 30 min buffer
    expect(range.reason).toBe("BOOKED");
  });

  it("asks the database to skip bookings an admin deleted", async () => {
    await GET(makeRequest({ locationId: LOCATION_ID, date: DATE }));

    const { where } = prismaMock.booking.findMany.mock.calls[0][0];
    const notSoftDeleted = {
      OR: [
        { cancelledReason: null },
        { cancelledReason: { not: "ADMIN_SOFT_DELETED" } },
      ],
    };

    // A deleted pending request keeps its PENDING_REVIEW status, so without this
    // clause its date would stay blocked for every customer.
    expect(where.OR).toHaveLength(2);
    for (const branch of where.OR) {
      expect(branch.AND).toEqual([notSoftDeleted]);
    }
  });

  it("caps blocked range end time at business close (23:00)", async () => {
    prismaMock.booking.findMany.mockResolvedValue([
      {
        eventStartTime: "21:00",
        eventEndTime: "22:45",
        startsAtUtc: null,
        occupiedUntilUtc: null,
        bookingStatus: "CONFIRMED",
        bufferMinutes: 30,
      },
    ]);
    const res = await GET(makeRequest({ locationId: LOCATION_ID, date: DATE }));
    const json = await res.json();
    expect(json.data[0].endTime).toBe("23:00"); // capped
  });

  // ── UTC fallback ────────────────────────────────────────────────────────────

  it("uses UTC timestamps to compute blocked range when local time strings are null", async () => {
    // 14:00–18:00 Eastern = 19:00–23:00 UTC (EDT, UTC-5 in July)
    prismaMock.booking.findMany.mockResolvedValue([
      {
        eventStartTime: null,
        eventEndTime: null,
        startsAtUtc: new Date("2030-07-15T18:00:00.000Z"), // 14:00 EDT
        occupiedUntilUtc: new Date("2030-07-15T22:30:00.000Z"), // 18:30 EDT (with buffer already)
        bookingStatus: "CONFIRMED",
        bufferMinutes: 30,
      },
    ]);
    const res = await GET(makeRequest({ locationId: LOCATION_ID, date: DATE }));
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].reason).toBe("BOOKED");
    // Start should be 14:00 (19:00Z → 14:00 EDT)
    expect(json.data[0].startTime).toBe("14:00");
  });

  it("skips bookings that have neither local times nor UTC timestamps", async () => {
    prismaMock.booking.findMany.mockResolvedValue([
      {
        eventStartTime: null,
        eventEndTime: null,
        startsAtUtc: null,
        occupiedUntilUtc: null,
        bookingStatus: "CONFIRMED",
        bufferMinutes: 30,
      },
    ]);
    const res = await GET(makeRequest({ locationId: LOCATION_ID, date: DATE }));
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  // ── Business hours metadata ─────────────────────────────────────────────────

  it("includes business hours and minimum duration in the response", async () => {
    const res = await GET(makeRequest({ locationId: LOCATION_ID, date: DATE }));
    const json = await res.json();
    expect(json.theatres).toHaveLength(1);
    const meta = json.theatres[0];
    expect(meta.businessOpenTime).toBe("09:00");
    expect(meta.businessCloseTime).toBe("22:30");
    expect(meta.minimumDurationMinutes).toBe(4 * 60); // 4h package
  });

  // ── Multiple bookings ───────────────────────────────────────────────────────

  it("returns a range for each confirmed booking", async () => {
    prismaMock.booking.findMany.mockResolvedValue([
      {
        eventStartTime: "10:00",
        eventEndTime: "14:00",
        startsAtUtc: null,
        occupiedUntilUtc: null,
        bookingStatus: "CONFIRMED",
        bufferMinutes: 30,
      },
      {
        eventStartTime: "17:00",
        eventEndTime: "21:00",
        startsAtUtc: null,
        occupiedUntilUtc: null,
        bookingStatus: "CONFIRMED",
        bufferMinutes: 30,
      },
    ]);
    const res = await GET(makeRequest({ locationId: LOCATION_ID, date: DATE }));
    const json = await res.json();
    expect(json.data).toHaveLength(2);
  });

  it("returns active unexpired holds as temporarily locked ranges", async () => {
    prismaMock.booking.findMany.mockResolvedValue([
      {
        eventStartTime: "14:00",
        eventEndTime: "18:00",
        startsAtUtc: null,
        occupiedUntilUtc: null,
        bookingStatus: "INCOMPLETE",
        bufferMinutes: 30,
      },
    ]);

    const res = await GET(makeRequest({ locationId: LOCATION_ID, date: DATE }));
    const json = await res.json();

    expect(json.data[0].reason).toBe("LOCKED");
  });
});
