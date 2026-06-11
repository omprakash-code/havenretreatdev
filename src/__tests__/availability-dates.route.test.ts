import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ─────────────────────────────────────────────────────────────────

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    eventPackage: {
      findMany: vi.fn(),
    },
    venue: {
      findMany: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    location: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { GET } from "@/app/api/availability/dates/route";

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/availability/dates");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

const LOCATION_ID = "loc-1";

function setupDefaults() {
  prismaMock.eventPackage.findMany.mockResolvedValue([{ venueId: "venue-1" }]);
  prismaMock.booking.findMany.mockResolvedValue([]);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("GET /api/availability/dates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it("returns 400 when locationId is missing", async () => {
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.message).toMatch(/locationId/i);
  });

  // ── Date range ────────────────────────────────────────────────────────────

  it("returns exactly 90 dates when no days are blocked", async () => {
    const res = await GET(makeRequest({ locationId: LOCATION_ID }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(90);
  });

  it("first date is today (or the venue's current date)", async () => {
    const res = await GET(makeRequest({ locationId: LOCATION_ID }));
    const json = await res.json();
    // The first entry should be a valid date string in yyyy-MM-dd format
    expect(json.data[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Consecutive dates should be in ascending order
    const first = json.data[0].date;
    const second = json.data[1].date;
    expect(second > first).toBe(true);
  });

  // ── Fully blocked dates ───────────────────────────────────────────────────

  it("excludes a date that is fully blocked including the cleanup buffer", async () => {
    // Simulate a booking that spans the entire business day
    const blockedDateUtc = new Date();
    blockedDateUtc.setUTCDate(blockedDateUtc.getUTCDate() + 5);
    blockedDateUtc.setUTCHours(4, 0, 0, 0); // midnight Eastern

    prismaMock.booking.findMany.mockResolvedValue([
      {
        eventDate: blockedDateUtc,
        eventStartTime: "09:00",
        eventEndTime: "22:30",
      },
    ]);

    const res = await GET(makeRequest({ locationId: LOCATION_ID }));
    const json = await res.json();
    // Should have one fewer date (89 instead of 90)
    expect(json.data).toHaveLength(89);
  });

  it("does NOT exclude a date with only a partial booking (not 09:00–23:00)", async () => {
    const partialDateUtc = new Date();
    partialDateUtc.setUTCDate(partialDateUtc.getUTCDate() + 5);
    partialDateUtc.setUTCHours(4, 0, 0, 0);

    prismaMock.booking.findMany.mockResolvedValue([
      {
        eventDate: partialDateUtc,
        eventStartTime: "14:00",
        eventEndTime: "18:00",
      },
    ]);

    const res = await GET(makeRequest({ locationId: LOCATION_ID }));
    const json = await res.json();
    // Partial booking should not block the whole day
    expect(json.data).toHaveLength(90);
  });

  it("does NOT exclude a date where eventStartTime is null", async () => {
    const dateUtc = new Date();
    dateUtc.setUTCDate(dateUtc.getUTCDate() + 5);
    dateUtc.setUTCHours(4, 0, 0, 0);

    prismaMock.booking.findMany.mockResolvedValue([
      {
        eventDate: dateUtc,
        eventStartTime: null,
        eventEndTime: null,
      },
    ]);

    const res = await GET(makeRequest({ locationId: LOCATION_ID }));
    const json = await res.json();
    expect(json.data).toHaveLength(90);
  });

  // ── Venue fallback ────────────────────────────────────────────────────────

  it("returns no dates when no package maps the location to a venue", async () => {
    prismaMock.eventPackage.findMany.mockResolvedValue([]);
    prismaMock.location.findFirst.mockResolvedValue(null);

    const res = await GET(makeRequest({ locationId: "unknown-loc" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([]);
    expect(prismaMock.venue.findMany).not.toHaveBeenCalled();
  });

  // ── Response shape ────────────────────────────────────────────────────────

  it("returns dates as objects with a date string field", async () => {
    const res = await GET(makeRequest({ locationId: LOCATION_ID }));
    const json = await res.json();
    expect(json.data[0]).toHaveProperty("date");
    expect(typeof json.data[0].date).toBe("string");
  });
});
