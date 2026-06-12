import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks (hoisted so they resolve before any module imports) ─────────────
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

vi.mock("@/services/booking/bookingId.service", () => ({
  allocateBookingRef: vi.fn().mockResolvedValue("HR-TEST-001"),
}));

vi.mock("@/services/booking/booking-snapshot.service", () => ({
  buildPackageSnapshot: vi.fn().mockReturnValue({ name: "Test Package" }),
  buildInitialPricingSnapshot: vi.fn().mockResolvedValue({
    packageAmount: 1500,
    extraDurationAmount: 0,
    totalAmount: 1500,
    remainingPayable: 1350,
  }),
}));

import {
  createOrReplaceVenueBookingSession,
  VenueBookingSessionError,
} from "@/services/booking/venue-booking-session.service";
import {
  BOOKING_HOLD_MINUTES,
  getBookingHoldExpiry,
} from "@/lib/booking-policy";

// ─── Fixtures ──────────────────────────────────────────────────────────────

const PACKAGE = {
  id: "pkg-1",
  venueId: "venue-1",
  locationId: "loc-1",
  name: "Garden Package",
  slug: "garden",
  shortDescription: "Garden event",
  isActive: true,
  guestLimit: 20,
  eventDurationHours: 4,
  complimentarySetupHours: 1,
  rentalAmount: 1000,
  decorationAmount: 200,
  decorationAddonPrice: 300,
  decorationDefault: true,
  cleaningAmount: 100,
  subtotalAmount: 1500,
  hourlyRate: 150,
  features: [],
  venue: { id: "venue-1", name: "Haven", slug: "haven", isActive: true },
};

// A date in the future (2030) so startsAtUtc > now always holds
const FUTURE_DATE = "2030-07-15";
const VALID_INPUT = {
  packageId: "pkg-1",
  eventDate: FUTURE_DATE,
  startTime: "14:00",
  endTime: "18:00",
};

function makeTxClient(overrides: Record<string, unknown> = {}) {
  return {
    eventPackage: {
      findFirst: vi.fn().mockResolvedValue(PACKAGE),
    },
    booking: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null), // no conflict
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({ id: "booking-1", lockVersion: 2 }),
      create: vi.fn().mockResolvedValue({ id: "booking-new", lockVersion: 1 }),
    },
    couponUsage: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function withTx(tx: ReturnType<typeof makeTxClient>) {
  prismaMock.$transaction.mockImplementation(
    (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)
  );
  return tx;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("createOrReplaceVenueBookingSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Input validation ──────────────────────────────────────────────────────

  it("throws INVALID_RANGE for a malformed date", async () => {
    withTx(makeTxClient());
    await expect(
      createOrReplaceVenueBookingSession(
        { ...VALID_INPUT, eventDate: "not-a-date" },
        "guest-1",
        null
      )
    ).rejects.toMatchObject({ code: "INVALID_RANGE" });
  });

  it("throws INVALID_RANGE for times not aligned to 30-minute increments", async () => {
    withTx(makeTxClient());
    await expect(
      createOrReplaceVenueBookingSession(
        { ...VALID_INPUT, startTime: "14:07" },
        "guest-1",
        null
      )
    ).rejects.toMatchObject({ code: "INVALID_RANGE" });
  });

  it("throws INVALID_RANGE when end time is before start time", async () => {
    withTx(makeTxClient());
    await expect(
      createOrReplaceVenueBookingSession(
        { ...VALID_INPUT, startTime: "18:00", endTime: "14:00" },
        "guest-1",
        null
      )
    ).rejects.toMatchObject({ code: "INVALID_RANGE" });
  });

  it("throws OUTSIDE_BUSINESS_HOURS when start is before 09:00", async () => {
    withTx(makeTxClient());
    await expect(
      createOrReplaceVenueBookingSession(
        { ...VALID_INPUT, startTime: "08:00", endTime: "13:00" },
        "guest-1",
        null
      )
    ).rejects.toMatchObject({ code: "OUTSIDE_BUSINESS_HOURS" });
  });

  it("throws OUTSIDE_BUSINESS_HOURS when end is after 23:00", async () => {
    withTx(makeTxClient());
    await expect(
      createOrReplaceVenueBookingSession(
        { ...VALID_INPUT, startTime: "20:00", endTime: "23:30" },
        "guest-1",
        null
      )
    ).rejects.toMatchObject({ code: "OUTSIDE_BUSINESS_HOURS" });
  });

  it("throws MINIMUM_DURATION when duration is shorter than package minimum", async () => {
    withTx(makeTxClient()); // PACKAGE has eventDurationHours=4, so < 4h is invalid
    await expect(
      createOrReplaceVenueBookingSession(
        { ...VALID_INPUT, startTime: "14:00", endTime: "16:00" }, // 2h
        "guest-1",
        null
      )
    ).rejects.toMatchObject({ code: "MINIMUM_DURATION" });
  });

  // ── Package lookup ─────────────────────────────────────────────────────────

  it("throws PACKAGE_NOT_FOUND when package is missing or inactive", async () => {
    const tx = makeTxClient();
    tx.eventPackage.findFirst.mockResolvedValue(null);
    withTx(tx);
    await expect(
      createOrReplaceVenueBookingSession(VALID_INPUT, "guest-1", null)
    ).rejects.toMatchObject({ code: "PACKAGE_NOT_FOUND" });
  });

  // ── Conflict detection ─────────────────────────────────────────────────────

  it("throws BOOKING_CONFLICT when another confirmed booking overlaps", async () => {
    const tx = makeTxClient();
    tx.booking.findFirst.mockResolvedValue({ id: "conflict-booking" });
    withTx(tx);
    await expect(
      createOrReplaceVenueBookingSession(VALID_INPUT, "guest-1", null)
    ).rejects.toMatchObject({ code: "BOOKING_CONFLICT" });
  });

  // ── Payment guard ──────────────────────────────────────────────────────────

  it("throws PAYMENT_IN_PROGRESS when existing booking has active payment", async () => {
    const tx = makeTxClient();
    // existing session booking has payment in progress
    tx.booking.findUnique.mockResolvedValueOnce({
      id: "booking-1",
      bookingStatus: "INCOMPLETE",
      lockVersion: 1,
      holdExpiresAt: new Date("2030-07-15T17:00:00.000Z"),
      payment: [{ id: "pay-1" }],
    });
    withTx(tx);
    await expect(
      createOrReplaceVenueBookingSession(
        VALID_INPUT,
        "guest-1",
        { bookingId: "booking-1", lockVersion: 1 }
      )
    ).rejects.toMatchObject({ code: "PAYMENT_IN_PROGRESS" });
  });

  it("throws PAYMENT_IN_PROGRESS when booking status is PAYMENT_PROCESSING", async () => {
    const tx = makeTxClient();
    tx.booking.findUnique.mockResolvedValueOnce({
      id: "booking-1",
      bookingStatus: "PAYMENT_PROCESSING",
      lockVersion: 1,
      holdExpiresAt: new Date("2030-07-15T17:00:00.000Z"),
      payment: [],
    });
    withTx(tx);
    await expect(
      createOrReplaceVenueBookingSession(
        VALID_INPUT,
        "guest-1",
        { bookingId: "booking-1", lockVersion: 1 }
      )
    ).rejects.toMatchObject({ code: "PAYMENT_IN_PROGRESS" });
  });

  it("keeps the payment guard after the hold timestamp expires", async () => {
    const now = new Date("2029-01-01T12:00:00.000Z");
    const tx = makeTxClient();
    tx.booking.findUnique.mockResolvedValueOnce({
      id: "booking-1",
      bookingStatus: "PAYMENT_PROCESSING",
      lockVersion: 1,
      holdExpiresAt: new Date(now.getTime() - 1),
      payment: [{ id: "pay-1" }],
    });
    withTx(tx);

    await expect(
      createOrReplaceVenueBookingSession(
        VALID_INPUT,
        "guest-1",
        { bookingId: "booking-1", lockVersion: 1 },
        now
      )
    ).rejects.toMatchObject({ code: "PAYMENT_IN_PROGRESS" });
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  // ── Stale session ──────────────────────────────────────────────────────────

  it("creates a fresh booking when the previous booking no longer exists", async () => {
    const tx = makeTxClient();
    tx.booking.findUnique.mockResolvedValue(null); // booking no longer exists
    withTx(tx);
    const result = await createOrReplaceVenueBookingSession(
      VALID_INPUT,
      "guest-1",
      { bookingId: "ghost-booking", lockVersion: 1 }
    );

    expect(result.replaced).toBe(false);
    expect(tx.booking.create).toHaveBeenCalledOnce();
  });

  it("creates a fresh booking when the previous booking is already confirmed", async () => {
    const tx = makeTxClient();
    tx.booking.findUnique.mockResolvedValueOnce({
      id: "booking-1",
      bookingStatus: "CONFIRMED",
      lockVersion: 1,
      holdExpiresAt: null,
      payment: [],
    });
    withTx(tx);

    const result = await createOrReplaceVenueBookingSession(
      VALID_INPUT,
      "guest-1",
      { bookingId: "booking-1", lockVersion: 1 }
    );

    expect(result.replaced).toBe(false);
    expect(tx.booking.create).toHaveBeenCalledOnce();
  });

  it("abandons an expired hold and creates a fresh booking", async () => {
    const now = new Date("2029-01-01T12:00:00.000Z");
    const tx = makeTxClient();
    tx.booking.findUnique.mockResolvedValueOnce({
      id: "booking-1",
      bookingStatus: "INCOMPLETE",
      lockVersion: 1,
      holdExpiresAt: new Date(now.getTime() - 1),
      payment: [],
    });
    withTx(tx);

    const result = await createOrReplaceVenueBookingSession(
      VALID_INPUT,
      "guest-1",
      { bookingId: "booking-1", lockVersion: 1 },
      now
    );

    expect(result.replaced).toBe(false);
    expect(tx.booking.update).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      data: expect.objectContaining({
        bookingStatus: "ABANDONED",
        cancelledReason: "SESSION_EXPIRED",
        holdExpiresAt: null,
      }),
    });
    expect(tx.booking.create).toHaveBeenCalledOnce();
  });

  it("throws SESSION_STALE when an active session has a different lock version", async () => {
    const tx = makeTxClient();
    tx.booking.findUnique.mockResolvedValueOnce({
      id: "booking-1",
      bookingStatus: "INCOMPLETE",
      lockVersion: 2,
      holdExpiresAt: new Date("2030-07-15T17:00:00.000Z"),
      payment: [],
    });
    withTx(tx);

    await expect(
      createOrReplaceVenueBookingSession(
        VALID_INPUT,
        "guest-1",
        { bookingId: "booking-1", lockVersion: 1 }
      )
    ).rejects.toMatchObject({
      code: "SESSION_STALE",
      message: "The active booking session was replaced in another tab.",
    });
  });

  // ── Successful creation ────────────────────────────────────────────────────

  it("creates a new booking and returns lockVersion=1 for a fresh session", async () => {
    const tx = makeTxClient();
    withTx(tx);
    const result = await createOrReplaceVenueBookingSession(
      VALID_INPUT,
      "guest-1",
      null
    );
    expect(result.lockVersion).toBe(1);
    expect(result.replaced).toBe(false);
    expect(tx.booking.create).toHaveBeenCalledOnce();
  });

  it("sets venueId and packageId on the created booking", async () => {
    const tx = makeTxClient();
    withTx(tx);
    await createOrReplaceVenueBookingSession(VALID_INPUT, "guest-1", null);
    const createCall = tx.booking.create.mock.calls[0][0];
    expect(createCall.data.venueId).toBe("venue-1");
    expect(createCall.data.packageId).toBe("pkg-1");
  });

  it("starts each successful reservation with a full 20-minute hold", async () => {
    const now = new Date("2029-01-01T12:00:00.000Z");
    const tx = makeTxClient();
    withTx(tx);

    await createOrReplaceVenueBookingSession(
      VALID_INPUT,
      "guest-1",
      null,
      now
    );

    const createCall = tx.booking.create.mock.calls[0][0];
    expect(BOOKING_HOLD_MINUTES).toBe(20);
    expect(createCall.data.holdExpiresAt).toEqual(getBookingHoldExpiry(now));
  });

  it("starts a booking with the package decoration default and no decoration charge", async () => {
    const tx = makeTxClient();
    withTx(tx);
    await createOrReplaceVenueBookingSession(VALID_INPUT, "guest-1", null);

    const createCall = tx.booking.create.mock.calls[0][0];
    expect(createCall.data.decorationRequired).toBe(true);
    expect(createCall.data.decorationAmount).toBe(0);
    expect(createCall.data.totalAmount).toBe(1500);
    expect(createCall.data.remainingPayable).toBe(1350);
  });

  // ── Successful replacement ─────────────────────────────────────────────────

  it("updates existing booking and increments lockVersion when replacing", async () => {
    const now = new Date("2029-01-01T12:00:00.000Z");
    const tx = makeTxClient();
    // First findUnique is the payment-in-progress check
    tx.booking.findUnique
      .mockResolvedValueOnce({
        id: "booking-1",
        bookingStatus: "INCOMPLETE",
        lockVersion: 3,
        holdExpiresAt: new Date("2030-07-15T17:00:00.000Z"),
        payment: [],
      })
      .mockResolvedValueOnce({ lockVersion: 3 }); // second call for increment
    withTx(tx);
    const result = await createOrReplaceVenueBookingSession(
      VALID_INPUT,
      "guest-1",
      { bookingId: "booking-1", lockVersion: 3 },
      now
    );
    expect(result.replaced).toBe(true);
    expect(result.lockVersion).toBe(4);
    expect(tx.booking.update).toHaveBeenCalledOnce();
    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          holdExpiresAt: getBookingHoldExpiry(now),
        }),
      })
    );
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it("skips conflict with own booking when replacing", async () => {
    const tx = makeTxClient();
    tx.booking.findUnique
      .mockResolvedValueOnce({
        id: "booking-1",
        bookingStatus: "INCOMPLETE",
        lockVersion: 1,
        holdExpiresAt: new Date("2030-07-15T17:00:00.000Z"),
        payment: [],
      })
      .mockResolvedValueOnce({ lockVersion: 1 });
    // No external conflict
    tx.booking.findFirst.mockResolvedValue(null);
    withTx(tx);

    const result = await createOrReplaceVenueBookingSession(
      VALID_INPUT,
      "guest-1",
      { bookingId: "booking-1", lockVersion: 1 }
    );
    expect(result.replaced).toBe(true);

    // Confirm the conflict check excluded the current bookingId
    const conflictCall = tx.booking.findFirst.mock.calls[0][0];
    expect(conflictCall.where.id).toEqual({ not: "booking-1" });
  });

  // ── Error class ────────────────────────────────────────────────────────────

  it("VenueBookingSessionError carries its code", () => {
    const err = new VenueBookingSessionError("BOOKING_CONFLICT", "overlap");
    expect(err.code).toBe("BOOKING_CONFLICT");
    expect(err.message).toBe("overlap");
    expect(err).toBeInstanceOf(Error);
  });
});
