import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  localBookingTimeToUtc,
  toBookingDate,
} from "@/lib/booking-range";
import {
  createOrReplaceRangeBookingLock,
  RangeBookingLockError,
} from "@/services/booking/range-booking-lock.service";
import {
  expireRangeBookingLocks,
  getCurrentRangeBookingLock,
} from "@/services/booking/range-lock-lifecycle.service";
import {
  RangeBookingSessionError,
  requireActiveRangeBookingSession,
} from "@/services/booking/range-booking-session.service";

const suffix = randomUUID();
const locationId = `range-lock-location-${suffix}`;
const theatreId = `range-lock-theatre-${suffix}`;
const venueId = `range-lock-venue-${suffix}`;
const packageId = `range-lock-package-${suffix}`;
const now = new Date("2030-01-01T12:00:00.000Z");
const baseInput = {
  theatreId,
  packageId,
  eventDate: "2030-06-10",
  startTime: "09:00",
  endTime: "13:00",
};

describe("range booking lock integration", () => {
  beforeAll(async () => {
    await prisma.location.create({
      data: {
        id: locationId,
        name: `Range lock ${suffix}`,
        city: "Miami",
      },
    });
    await prisma.theatre.create({
      data: {
        id: theatreId,
        locationId,
        name: `Venue ${suffix}`,
        images: [],
        capacity: 50,
      },
    });
    await prisma.venue.create({
      data: {
        id: venueId,
        name: `Range venue ${suffix}`,
        slug: `range-venue-${suffix}`,
        images: [],
      },
    });
    await prisma.eventPackage.create({
      data: {
        id: packageId,
        venueId,
        name: `Essential ${suffix}`,
        slug: `essential-${suffix}`,
        guestLimit: 30,
        eventDurationHours: 4,
        rentalAmount: 1000,
        subtotalAmount: 1000,
        finalAmount: 1000,
      },
    });
    await prisma.bookingSettings.create({
      data: {
        theatreId,
        businessOpenTime: "09:00",
        businessCloseTime: "23:00",
        minimumDurationMinutes: 240,
        bufferMinutes: 60,
        lockDurationMinutes: 10,
        maximumGuests: 50,
      },
    });
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { theatreId } });
    await prisma.availabilityBlock.deleteMany({ where: { theatreId } });
    await prisma.bookingSettings.deleteMany({ where: { theatreId } });
    await prisma.eventPackage.deleteMany({ where: { venueId } });
    await prisma.venue.delete({ where: { id: venueId } });
    await prisma.theatre.delete({ where: { id: theatreId } });
    await prisma.location.delete({ where: { id: locationId } });
  });

  it("retains released history and increments versions on replacement", async () => {
    const first = await createOrReplaceRangeBookingLock(
      baseInput,
      `history-owner-${suffix}`,
      null,
      now
    );
    const replacement = await createOrReplaceRangeBookingLock(
      { ...baseInput, startTime: "14:00", endTime: "18:00" },
      `history-owner-${suffix}`,
      { bookingId: first.booking.id, lockVersion: first.lock.version },
      now
    );

    const history = await prisma.bookingLock.findMany({
      where: { bookingId: first.booking.id },
      orderBy: { version: "asc" },
    });
    expect(history.map(({ version, status }) => ({ version, status }))).toEqual([
      { version: 1, status: "RELEASED" },
      { version: 2, status: "ACTIVE" },
    ]);
    expect(replacement.lock.version).toBe(2);
    expect(replacement.booking.lockVersion).toBe(2);
    expect(replacement.booking.slotId).toBeNull();
    expect(replacement.booking.timezone).toBe("America/New_York");
    expect(replacement.booking.packageId).toBe(packageId);
    expect(
      await prisma.slot.count({ where: { theatreId } })
    ).toBe(0);
  });

  it("returns an identical active lock idempotently", async () => {
    const owner = `idempotent-owner-${suffix}`;
    const first = await createOrReplaceRangeBookingLock(
      { ...baseInput, eventDate: "2030-06-11" },
      owner,
      null,
      now
    );
    const second = await createOrReplaceRangeBookingLock(
      { ...baseInput, eventDate: "2030-06-11" },
      owner,
      { bookingId: first.booking.id, lockVersion: 1 },
      now
    );

    expect(second.lock.id).toBe(first.lock.id);
    expect(second.replaced).toBe(false);
    expect(
      await prisma.bookingLock.count({ where: { bookingId: first.booking.id } })
    ).toBe(1);
    expect(
      await getCurrentRangeBookingLock(first.booking.id, owner, 1, now)
    ).toMatchObject({ id: first.lock.id });
    await expect(
      requireActiveRangeBookingSession(
        {
          bookingId: first.booking.id,
          lockOwner: owner,
          lockVersion: 1,
        },
        now
      )
    ).resolves.toMatchObject({ lock: { id: first.lock.id, version: 1 } });
  });

  it("rejects a stale cookie version even when another lock is active", async () => {
    const owner = `stale-owner-${suffix}`;
    const first = await createOrReplaceRangeBookingLock(
      { ...baseInput, eventDate: "2030-06-16" },
      owner,
      null,
      now
    );
    const replacement = await createOrReplaceRangeBookingLock(
      {
        ...baseInput,
        eventDate: "2030-06-16",
        startTime: "14:00",
        endTime: "18:00",
      },
      owner,
      { bookingId: first.booking.id, lockVersion: 1 },
      now
    );

    await expect(
      requireActiveRangeBookingSession(
        {
          bookingId: first.booking.id,
          lockOwner: owner,
          lockVersion: 1,
        },
        now
      )
    ).rejects.toBeInstanceOf(RangeBookingSessionError);
    expect(replacement.booking.lockVersion).toBe(2);
  });

  it("allows only one of two concurrent overlapping lock requests", async () => {
    const input = { ...baseInput, eventDate: "2030-06-12" };
    const results = await Promise.allSettled([
      createOrReplaceRangeBookingLock(
        input,
        `race-owner-a-${suffix}`,
        null,
        now
      ),
      createOrReplaceRangeBookingLock(
        input,
        `race-owner-b-${suffix}`,
        null,
        now
      ),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "LOCK_CONFLICT",
    } satisfies Partial<RangeBookingLockError>);
  });

  it("expires locks and abandons their unpaid drafts", async () => {
    const result = await createOrReplaceRangeBookingLock(
      { ...baseInput, eventDate: "2030-06-13" },
      `expiry-owner-${suffix}`,
      null,
      now
    );

    const summary = await expireRangeBookingLocks(
      new Date(now.getTime() + 11 * 60_000)
    );
    const [lock, booking] = await Promise.all([
      prisma.bookingLock.findUniqueOrThrow({ where: { id: result.lock.id } }),
      prisma.booking.findUniqueOrThrow({ where: { id: result.booking.id } }),
    ]);

    expect(summary.expiredLocks).toBeGreaterThanOrEqual(1);
    expect(lock.status).toBe("EXPIRED");
    expect(booking.bookingStatus).toBe("ABANDONED");
  });

  it("enforces BookingSettings capacity without a hardcoded venue limit", async () => {
    await prisma.bookingSettings.update({
      where: { theatreId },
      data: { maximumGuests: 25 },
    });

    await expect(
      createOrReplaceRangeBookingLock(
        { ...baseInput, eventDate: "2030-06-14" },
        `capacity-owner-${suffix}`,
        null,
        now
      )
    ).rejects.toMatchObject({ code: "CAPACITY_EXCEEDED" });

    await prisma.bookingSettings.update({
      where: { theatreId },
      data: { maximumGuests: 50 },
    });
  });

  it("rejects ranges that overlap an active availability block", async () => {
    await prisma.availabilityBlock.create({
      data: {
        theatreId,
        eventDate: toBookingDate("2030-06-15"),
        isFullDay: false,
        startTime: "10:00",
        endTime: "12:00",
        startsAtUtc: localBookingTimeToUtc("2030-06-15", "10:00"),
        endsAtUtc: localBookingTimeToUtc("2030-06-15", "12:00"),
      },
    });

    await expect(
      createOrReplaceRangeBookingLock(
        { ...baseInput, eventDate: "2030-06-15" },
        `block-owner-${suffix}`,
        null,
        now
      )
    ).rejects.toMatchObject({ code: "BLOCK_CONFLICT" });
  });

  it("uses Theatre.timezone and snapshots it on Booking", async () => {
    await prisma.theatre.update({
      where: { id: theatreId },
      data: { timezone: "America/Chicago" },
    });
    const result = await createOrReplaceRangeBookingLock(
      { ...baseInput, eventDate: "2030-06-17" },
      `timezone-owner-${suffix}`,
      null,
      now
    );

    expect(result.booking.timezone).toBe("America/Chicago");
    expect(result.booking.startsAtUtc?.toISOString()).toBe(
      "2030-06-17T14:00:00.000Z"
    );
  });
});
