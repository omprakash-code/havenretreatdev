import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  beginRangePaymentAttempt,
  finalizeRangePayment,
} from "@/services/booking/range-payment.service";
import {
  createOrReplaceRangeBookingLock,
  RangeBookingLockError,
} from "@/services/booking/range-booking-lock.service";
import { expireRangeBookingLocks } from "@/services/booking/range-lock-lifecycle.service";

const suffix = randomUUID();
const locationId = `concurrency-location-${suffix}`;
const theatreId = `concurrency-theatre-${suffix}`;
const venueId = `concurrency-venue-${suffix}`;
const packageId = `concurrency-package-${suffix}`;
const baselineNow = new Date("2030-01-01T12:00:00.000Z");

function recordTiming(scenario: string, startedAt: number) {
  console.info("CONCURRENCY_QUERY_TIMING", {
    scenario,
    durationMs: Number((performance.now() - startedAt).toFixed(2)),
  });
}

async function createDraft(eventDate: string, owner: string) {
  const result = await createOrReplaceRangeBookingLock(
    {
      theatreId,
      packageId,
      eventDate,
      startTime: "09:00",
      endTime: "13:00",
    },
    owner,
    null,
    baselineNow
  );
  await prisma.booking.update({
    where: { id: result.booking.id },
    data: {
      bookingStatus: "AWAITING_PAYMENT",
      termsAcceptedAt: baselineNow,
      advancePaid: 750,
      remainingPayable: Math.max(result.booking.totalAmount - 750, 0),
    },
  });
  return result;
}

async function preparePayment(
  eventDate: string,
  provider: "SQUARE" | "RAZORPAY" = "SQUARE"
) {
  const draft = await createDraft(
    eventDate,
    `payment-owner-${eventDate}-${randomUUID()}`
  );
  const orderId = `${provider.toLowerCase()}-order-${randomUUID()}`;
  const payment = await prisma.payment.create({
    data: {
      bookingId: draft.booking.id,
      provider,
      providerOrderId: orderId,
      bookingLockVersion: draft.lock.version,
      idempotencyKey: `test:${provider}:${draft.booking.id}:${randomUUID()}`,
      amount: 750,
      status: "AWAITING_PAYMENT",
      method: "ONLINE",
    },
  });
  await prisma.booking.update({
    where: { id: draft.booking.id },
    data: {
      bookingStatus: "PAYMENT_PROCESSING",
      paymentStatus: "AWAITING_PAYMENT",
      paymentProvider: provider,
      paymentOrderId: orderId,
      ...(provider === "RAZORPAY" ? { razorpayOrderId: orderId } : {}),
    },
  });
  return { ...draft, payment, orderId };
}

describe("range booking PostgreSQL concurrency invariants", () => {
  beforeAll(async () => {
    process.env.RANGE_PAYMENT_FINALIZATION_ENABLED = "true";
    process.env.RANGE_PAYMENT_CREATION_ENABLED = "true";
    process.env.SQUARE_RANGE_PAYMENTS_ENABLED = "true";
    process.env.SUCCESS_PAGE_SECRET = "range-concurrency-test-secret";

    await prisma.location.create({
      data: {
        id: locationId,
        name: `Concurrency ${suffix}`,
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
        slug: `concurrency-venue-${suffix}`,
        images: [],
      },
    });
    await prisma.eventPackage.create({
      data: {
        id: packageId,
        venueId,
        name: `Essential ${suffix}`,
        slug: `concurrency-essential-${suffix}`,
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
    await prisma.couponUsage.deleteMany({
      where: { booking: { theatreId } },
    });
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

  it("allows exactly one of twenty identical booking locks", async () => {
    const startedAt = performance.now();
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, index) =>
        createOrReplaceRangeBookingLock(
          {
            theatreId,
            packageId,
            eventDate: "2031-01-10",
            startTime: "09:00",
            endTime: "13:00",
          },
          `lock-race-${index}-${suffix}`,
          null,
          baselineNow
        )
      )
    );
    recordTiming("twenty_identical_booking_locks", startedAt);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    expect(rejected).toHaveLength(19);
    expect(
      rejected.every(
        (result) =>
          result.reason instanceof RangeBookingLockError &&
          result.reason.code === "LOCK_CONFLICT"
      )
    ).toBe(true);
  });

  it("enforces the post-booking buffer boundary", async () => {
    const first = await createDraft(
      "2031-01-11",
      `buffer-owner-${suffix}`
    );
    await prisma.booking.update({
      where: { id: first.booking.id },
      data: { bookingStatus: "CONFIRMED", paymentStatus: "PAID" },
    });
    await prisma.bookingLock.update({
      where: { id: first.lock.id },
      data: { status: "CONSUMED" },
    });

    const startedAt = performance.now();
    await expect(
      createOrReplaceRangeBookingLock(
        {
          theatreId,
          packageId,
          eventDate: "2031-01-11",
          startTime: "13:30",
          endTime: "17:30",
        },
        `buffer-rejected-${suffix}`,
        null,
        baselineNow
      )
    ).rejects.toMatchObject({ code: "BOOKING_CONFLICT" });
    await expect(
      createOrReplaceRangeBookingLock(
        {
          theatreId,
          packageId,
          eventDate: "2031-01-11",
          startTime: "14:00",
          endTime: "18:00",
        },
        `buffer-accepted-${suffix}`,
        null,
        baselineNow
      )
    ).resolves.toMatchObject({ lock: { status: "ACTIVE" } });
    recordTiming("buffer_boundary_pair", startedAt);
  });

  it("finalizes twenty duplicate webhook deliveries exactly once", async () => {
    const prepared = await preparePayment("2031-01-12");
    const startedAt = performance.now();
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        finalizeRangePayment({
          provider: "SQUARE",
          providerOrderId: prepared.orderId,
          providerPaymentId: "square-payment-duplicate",
          providerPayload: { eventId: "square-event-duplicate" },
          amount: 750,
          now: baselineNow,
        })
      )
    );
    recordTiming("twenty_duplicate_webhooks", startedAt);

    expect(results.filter((result) => result.status === "CONFIRMED")).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "ALREADY_CONFIRMED")
    ).toHaveLength(19);
    const [booking, lock, payments] = await Promise.all([
      prisma.booking.findUniqueOrThrow({ where: { id: prepared.booking.id } }),
      prisma.bookingLock.findUniqueOrThrow({ where: { id: prepared.lock.id } }),
      prisma.payment.findMany({ where: { bookingId: prepared.booking.id } }),
    ]);
    expect(booking.bookingStatus).toBe("CONFIRMED");
    expect(lock.status).toBe("CONSUMED");
    expect(payments.filter((payment) => payment.status === "PAID")).toHaveLength(1);
  });

  it("preserves a confirmed booking when a different captured payment arrives", async () => {
    const prepared = await preparePayment("2031-01-13");
    await finalizeRangePayment({
      provider: "SQUARE",
      providerOrderId: prepared.orderId,
      providerPaymentId: "square-payment-primary",
      providerPayload: { eventId: "primary" },
      amount: 750,
      now: baselineNow,
    });

    const startedAt = performance.now();
    const duplicate = await finalizeRangePayment({
      provider: "SQUARE",
      providerOrderId: prepared.orderId,
      providerPaymentId: "square-payment-secondary",
      providerPayload: { eventId: "secondary" },
      amount: 750,
      now: baselineNow,
    });
    recordTiming("different_payment_id_after_confirmation", startedAt);

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: prepared.booking.id },
    });
    const review = await prisma.payment.findUniqueOrThrow({
      where: {
        provider_providerPaymentId: {
          provider: "SQUARE",
          providerPaymentId: "square-payment-secondary",
        },
      },
    });
    expect(duplicate.status).toBe("MANUAL_REVIEW");
    expect(booking.bookingStatus).toBe("CONFIRMED");
    expect(booking.paymentStatus).toBe("PAID");
    expect(review.status).toBe("MANUAL_REVIEW");
  });

  it("places a late capture into manual review without confirming", async () => {
    const prepared = await preparePayment("2031-01-14");
    const afterExpiry = new Date(
      prepared.lock.expiresAt.getTime() + 1_000
    );
    const startedAt = performance.now();
    const result = await finalizeRangePayment({
      provider: "SQUARE",
      providerOrderId: prepared.orderId,
      providerPaymentId: "square-payment-expired",
      providerPayload: { eventId: "expired" },
      amount: 750,
      now: afterExpiry,
    });
    recordTiming("expired_lock_capture", startedAt);

    const [booking, lock, payment] = await Promise.all([
      prisma.booking.findUniqueOrThrow({ where: { id: prepared.booking.id } }),
      prisma.bookingLock.findUniqueOrThrow({ where: { id: prepared.lock.id } }),
      prisma.payment.findUniqueOrThrow({ where: { id: prepared.payment.id } }),
    ]);
    expect(result.status).toBe("MANUAL_REVIEW");
    expect(booking.bookingStatus).toBe("ABANDONED");
    expect(booking.paymentStatus).toBe("MANUAL_REVIEW");
    expect(lock.status).toBe("EXPIRED");
    expect(payment.status).toBe("MANUAL_REVIEW");
  });

  it("never consumes a newer lock for a stale payment version", async () => {
    const prepared = await preparePayment("2031-01-15");
    await prisma.bookingLock.update({
      where: { id: prepared.lock.id },
      data: { status: "RELEASED" },
    });
    const newerLock = await prisma.bookingLock.create({
      data: {
        bookingId: prepared.booking.id,
        theatreId,
        lockOwnerHash: `new-owner-${suffix}`,
        version: 2,
        eventDate: prepared.lock.eventDate,
        startTime: prepared.lock.startTime,
        endTime: prepared.lock.endTime,
        startsAtUtc: prepared.lock.startsAtUtc,
        endsAtUtc: prepared.lock.endsAtUtc,
        occupiedUntilUtc: prepared.lock.occupiedUntilUtc,
        expiresAt: prepared.lock.expiresAt,
        status: "ACTIVE",
      },
    });
    await prisma.booking.update({
      where: { id: prepared.booking.id },
      data: { lockVersion: 2 },
    });

    const startedAt = performance.now();
    const result = await finalizeRangePayment({
      provider: "SQUARE",
      providerOrderId: prepared.orderId,
      providerPaymentId: "square-payment-stale-version",
      providerPayload: { eventId: "stale-version" },
      amount: 750,
      now: baselineNow,
    });
    recordTiming("stale_payment_version", startedAt);

    const refreshed = await prisma.bookingLock.findUniqueOrThrow({
      where: { id: newerLock.id },
    });
    expect(result).toMatchObject({
      status: "MANUAL_REVIEW",
      reason: "PAYMENT_LOCK_VERSION_MISMATCH",
    });
    expect(refreshed.status).toBe("RELEASED");
    expect(refreshed.status).not.toBe("CONSUMED");
  });

  it("keeps cleanup and webhook finalization in a consistent terminal state", async () => {
    const prepared = await preparePayment("2031-01-16");
    const afterExpiry = new Date(prepared.lock.expiresAt.getTime() + 1_000);
    const startedAt = performance.now();
    await Promise.allSettled([
      expireRangeBookingLocks(afterExpiry),
      finalizeRangePayment({
        provider: "SQUARE",
        providerOrderId: prepared.orderId,
        providerPaymentId: "square-payment-cleanup-race",
        providerPayload: { eventId: "cleanup-race" },
        amount: 750,
        now: afterExpiry,
      }),
    ]);
    recordTiming("cleanup_vs_webhook", startedAt);

    const [booking, lock, payment] = await Promise.all([
      prisma.booking.findUniqueOrThrow({ where: { id: prepared.booking.id } }),
      prisma.bookingLock.findUniqueOrThrow({ where: { id: prepared.lock.id } }),
      prisma.payment.findUniqueOrThrow({ where: { id: prepared.payment.id } }),
    ]);
    expect(booking.bookingStatus).toBe("ABANDONED");
    expect(["EXPIRED", "MANUAL_REVIEW"]).toContain(booking.paymentStatus);
    expect(lock.status).toBe("EXPIRED");
    expect(["EXPIRED", "MANUAL_REVIEW"]).toContain(payment.status);
    expect(
      booking.paymentStatus === "MANUAL_REVIEW"
        ? payment.status === "MANUAL_REVIEW"
        : payment.status === "EXPIRED"
    ).toBe(true);
  });

  it("creates a new version-bound payment attempt after provider failure", async () => {
    const draft = await createDraft(
      "2031-01-17",
      `retry-owner-${suffix}`
    );
    const first = await beginRangePaymentAttempt({
      bookingId: draft.booking.id,
      bookingLockVersion: draft.lock.version,
      provider: "SQUARE",
      amount: 750,
      now: baselineNow,
    });
    await prisma.payment.update({
      where: { id: first.payment.id },
      data: { status: "FAILED" },
    });

    const startedAt = performance.now();
    const retry = await beginRangePaymentAttempt({
      bookingId: draft.booking.id,
      bookingLockVersion: draft.lock.version,
      provider: "SQUARE",
      amount: 750,
      now: baselineNow,
    });
    recordTiming("payment_retry_after_failure", startedAt);

    expect(retry.payment.id).not.toBe(first.payment.id);
    expect(retry.payment.bookingLockVersion).toBe(draft.lock.version);
    expect(retry.payment.status).toBe("INITIALIZED");
    expect(
      await prisma.payment.count({
        where: {
          bookingId: draft.booking.id,
          bookingLockVersion: draft.lock.version,
        },
      })
    ).toBe(2);
  });
});
