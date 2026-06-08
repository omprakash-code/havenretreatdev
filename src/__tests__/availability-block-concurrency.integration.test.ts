import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  createAvailabilityBlock,
  AvailabilityBlockConflictError,
} from "@/services/availability/availability-block.service";
import {
  createOrReplaceRangeBookingLock,
  RangeBookingLockError,
} from "@/services/booking/range-booking-lock.service";

const suffix = randomUUID();
const locationId = `block-race-location-${suffix}`;
const theatreId = `block-race-theatre-${suffix}`;
const venueId = `block-race-venue-${suffix}`;
const packageId = `block-race-package-${suffix}`;
const now = new Date("2030-01-01T12:00:00.000Z");

function recordTiming(scenario: string, startedAt: number) {
  console.info("CONCURRENCY_QUERY_TIMING", {
    scenario,
    durationMs: Number((performance.now() - startedAt).toFixed(2)),
  });
}

describe("availability block PostgreSQL concurrency", () => {
  beforeAll(async () => {
    await prisma.location.create({
      data: {
        id: locationId,
        name: `Block race ${suffix}`,
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
        timezone: "America/New_York",
      },
    });
    await prisma.venue.create({
      data: {
        id: venueId,
        name: `Range venue ${suffix}`,
        slug: `block-race-venue-${suffix}`,
        images: [],
      },
    });
    await prisma.eventPackage.create({
      data: {
        id: packageId,
        venueId,
        name: `Essential ${suffix}`,
        slug: `block-race-essential-${suffix}`,
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
    await prisma.payment.deleteMany({
      where: { booking: { theatreId } },
    });
    await prisma.booking.deleteMany({ where: { theatreId } });
    await prisma.availabilityBlock.deleteMany({ where: { theatreId } });
    await prisma.bookingSettings.deleteMany({ where: { theatreId } });
    await prisma.eventPackage.deleteMany({ where: { venueId } });
    await prisma.venue.delete({ where: { id: venueId } });
    await prisma.theatre.delete({ where: { id: theatreId } });
    await prisma.location.delete({ where: { id: locationId } });
  });

  it("allows exactly one of twenty concurrent overlapping blocks", async () => {
    const startedAt = performance.now();
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, index) =>
        createAvailabilityBlock(
          {
            theatreId,
            eventDate: "2030-07-01",
            isFullDay: false,
            startTime: "10:00",
            endTime: "14:00",
            internalNote: `race-${index}`,
          },
          `admin-${index}`
        )
      )
    );
    recordTiming("twenty_overlapping_blocks", startedAt);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(19);
    expect(
      rejected.every(
        (result) =>
          result.status === "rejected" &&
          result.reason instanceof AvailabilityBlockConflictError
      )
    ).toBe(true);
    expect(
      await prisma.availabilityBlock.count({
        where: { theatreId, eventDate: fulfilled[0].value.eventDate, isActive: true },
      })
    ).toBe(1);
  });

  it("serializes a booking lock racing an availability block", async () => {
    const startedAt = performance.now();
    const results = await Promise.allSettled([
      createAvailabilityBlock(
        {
          theatreId,
          eventDate: "2030-07-02",
          isFullDay: false,
          startTime: "09:00",
          endTime: "14:00",
          internalNote: "Maintenance",
        },
        "admin-race"
      ),
      createOrReplaceRangeBookingLock(
        {
          theatreId,
          packageId,
          eventDate: "2030-07-02",
          startTime: "09:00",
          endTime: "13:00",
        },
        `customer-race-${suffix}`,
        null,
        now
      ),
    ]);
    recordTiming("block_vs_booking_lock", startedAt);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rejection = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    expect(
      rejection?.reason instanceof AvailabilityBlockConflictError ||
        (
          rejection?.reason instanceof RangeBookingLockError &&
          rejection.reason.code === "BLOCK_CONFLICT"
        )
    ).toBe(true);

    const [blocks, locks] = await Promise.all([
      prisma.availabilityBlock.count({
        where: { theatreId, eventDate: new Date("2030-07-02T04:00:00.000Z"), isActive: true },
      }),
      prisma.bookingLock.count({
        where: {
          theatreId,
          eventDate: new Date("2030-07-02T04:00:00.000Z"),
          status: "ACTIVE",
        },
      }),
    ]);
    expect(blocks + locks).toBe(1);
  });

  it("rejects blocks overlapping confirmed booking occupied ranges", async () => {
    const startsAtUtc = new Date("2030-07-03T13:00:00.000Z");
    const endsAtUtc = new Date("2030-07-03T17:00:00.000Z");
    await prisma.booking.create({
      data: {
        bookingRef: `CONFIRMED-${suffix}`,
        theatreId,
        venueId,
        packageId,
        eventDate: new Date("2030-07-03T04:00:00.000Z"),
        eventStartTime: "09:00",
        eventEndTime: "13:00",
        startsAtUtc,
        endsAtUtc,
        occupiedUntilUtc: new Date("2030-07-03T18:00:00.000Z"),
        bufferMinutes: 60,
        timezone: "America/New_York",
        guestCount: 30,
        baseAmount: 1000,
        extrasAmount: 0,
        discountAmount: 0,
        totalAmount: 1000,
        advancePaid: 750,
        remainingPayable: 250,
        bookingStatus: "CONFIRMED",
        paymentStatus: "PAID",
      },
    });

    const startedAt = performance.now();
    await expect(
      createAvailabilityBlock(
        {
          theatreId,
          eventDate: "2030-07-03",
          isFullDay: false,
          startTime: "13:30",
          endTime: "14:30",
        },
        "admin-confirmed-conflict"
      )
    ).rejects.toThrow("confirmed booking");
    recordTiming("block_vs_confirmed_booking", startedAt);
  });
});
