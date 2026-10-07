import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatInTimeZone } from "date-fns-tz";
import { BOOKING_TIME_ZONE } from "@/lib/booking-policy";
import { addDaysToDateKey } from "@/lib/date";

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
    // Default tests run without the env override (90-day fallback).
    vi.stubEnv("RANGE_AVAILABILITY_DAYS", undefined);
    setupDefaults();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  // ── Horizon configuration (RANGE_AVAILABILITY_DAYS) ──────────────────────

  describe("with RANGE_AVAILABILITY_DAYS=365", () => {
    beforeEach(() => {
      vi.stubEnv("RANGE_AVAILABILITY_DAYS", "365");
    });

    it("returns 365 consecutive dates; the day after the window is not returned", async () => {
      const todayKey = formatInTimeZone(new Date(), BOOKING_TIME_ZONE, "yyyy-MM-dd");

      const res = await GET(makeRequest({ locationId: LOCATION_ID }));
      const json = await res.json();
      const dates: string[] = json.data.map((d: { date: string }) => d.date);
      const first = dates[0];

      expect(dates).toHaveLength(365);
      // The route's start day depends on the host timezone offset vs the venue
      // (pre-existing behaviour), so assert it's today or the day before.
      expect([todayKey, addDaysToDateKey(todayKey, -1)]).toContain(first);
      dates.forEach((date, i) => expect(date).toBe(addDaysToDateKey(first, i)));
      expect(dates).toContain(addDaysToDateKey(todayKey, 200));
      // Window is [first, first + 364]: first + 365 is outside it.
      expect(dates).not.toContain(addDaysToDateKey(first, 365));
      expect(dates).not.toContain(addDaysToDateKey(todayKey, -2));
    });

    it("queries blocking bookings across the full 365-day window", async () => {
      await GET(makeRequest({ locationId: LOCATION_ID }));

      const where = prismaMock.booking.findMany.mock.calls[0][0].where;
      const spanDays = Math.round(
        (where.eventDate.lte.getTime() - where.eventDate.gte.getTime()) / 86_400_000
      );
      expect(spanDays).toBe(365);
    });

    it("still excludes a fully blocked date far in the window", async () => {
      const blockedDateUtc = new Date();
      blockedDateUtc.setUTCDate(blockedDateUtc.getUTCDate() + 200);
      blockedDateUtc.setUTCHours(16, 0, 0, 0);
      const blockedKey = formatInTimeZone(blockedDateUtc, BOOKING_TIME_ZONE, "yyyy-MM-dd");

      prismaMock.booking.findMany.mockResolvedValue([
        {
          eventDate: blockedDateUtc,
          eventStartTime: "09:00",
          eventEndTime: "22:30",
        },
      ]);

      const res = await GET(makeRequest({ locationId: LOCATION_ID }));
      const json = await res.json();
      const dates = json.data.map((d: { date: string }) => d.date);

      expect(dates).toHaveLength(364);
      expect(dates).not.toContain(blockedKey);
    });
  });

  it.each(["", "abc", "0", "-30", "365.5"])(
    "falls back to 90 dates when RANGE_AVAILABILITY_DAYS is invalid (%j)",
    async (value) => {
      vi.stubEnv("RANGE_AVAILABILITY_DAYS", value);

      const res = await GET(makeRequest({ locationId: LOCATION_ID }));
      const json = await res.json();
      expect(json.data).toHaveLength(90);
    }
  );

  it("caps RANGE_AVAILABILITY_DAYS at 730 days", async () => {
    vi.stubEnv("RANGE_AVAILABILITY_DAYS", "100000");

    const res = await GET(makeRequest({ locationId: LOCATION_ID }));
    const json = await res.json();
    expect(json.data).toHaveLength(730);
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
