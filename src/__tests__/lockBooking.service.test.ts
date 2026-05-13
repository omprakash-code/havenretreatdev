import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/slot-time", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/slot-time")>();
  return {
    ...actual,
    isSlotExpiredInIST: vi.fn(() => false),
  };
});

vi.mock("@/services/booking/booking-abandonment-email.service", () => ({
  notifyAbandonedBookingsByIds: vi.fn().mockResolvedValue({
    notifiedBookingIds: [],
  }),
}));

import { prisma } from "@/lib/db";
import { lockBookingService } from "@/services/booking/lockBooking.service";

type TxMock = {
  slot: {
    updateMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  booking: {
    updateMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  couponUsage: {
    updateMany: ReturnType<typeof vi.fn>;
  };
};

function createTxMock(): TxMock {
  return {
    slot: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    booking: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({
        id: "booking-new",
        bookingRef: "TEMP",
      }),
      count: vi.fn().mockResolvedValue(0),
    },
    couponUsage: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

function mockTransaction(tx: TxMock) {
  const transactionFn = (
    prisma as unknown as { $transaction: ReturnType<typeof vi.fn> }
  ).$transaction;

  transactionFn.mockImplementation(async (cb: (arg0: TxMock) => Promise<unknown>) => cb(tx));
}

const futureSlot = {
  id: "slot-1",
  theatreId: "theatre-1",
  status: "LOCKED",
  lockedBy: "another-owner",
  lockedAt: new Date("2099-01-01T10:00:00.000Z"),
  lockExpiresAt: new Date("2099-01-01T10:10:00.000Z"),
  startTime: "10:00",
  endTime: "11:00",
  date: new Date("2099-01-01T00:00:00.000Z"),
  finalPrice: null,
  basePrice: 1200,
};

describe("lockBookingService orphan and lock integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("auto-releases orphan LOCKED slot and proceeds with new lock", async () => {
    const tx = createTxMock();
    mockTransaction(tx);

    tx.slot.findUnique.mockResolvedValue({ ...futureSlot });
    tx.booking.findFirst
      // active booking lookup for locked slot
      .mockResolvedValueOnce(null)
      // existing INCOMPLETE booking after lock
      .mockResolvedValueOnce(null);

    const result = await lockBookingService({
      slotId: "slot-1",
      theatreId: "theatre-1",
      lockOwner: "owner-new",
      currentBookingId: null,
    });

    expect(result.booking.id).toBe("booking-new");

    const releaseCall = tx.slot.updateMany.mock.calls.find(
      ([arg]) =>
        arg?.where?.id === "slot-1" && arg?.where?.status === "LOCKED"
    );
    expect(releaseCall).toBeTruthy();
    expect(releaseCall?.[0]?.data).toMatchObject({
      status: "AVAILABLE",
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
    });

    const acquireCall = tx.slot.updateMany.mock.calls.find(
      ([arg]) =>
        arg?.where?.id === "slot-1" && arg?.where?.status === "AVAILABLE"
    );
    expect(acquireCall).toBeTruthy();
    expect(acquireCall?.[0]?.data).toMatchObject({
      status: "LOCKED",
      lockedBy: "owner-new",
    });
  });

  it("returns existing booking idempotently when active lock matches current booking context", async () => {
    const tx = createTxMock();
    mockTransaction(tx);

    tx.slot.findUnique.mockResolvedValue({ ...futureSlot });
    tx.booking.findFirst.mockResolvedValueOnce({
      id: "booking-current",
      bookingStatus: "AWAITING_PAYMENT",
    });

    const result = await lockBookingService({
      slotId: "slot-1",
      theatreId: "theatre-1",
      lockOwner: "owner-any",
      currentBookingId: "booking-current",
    });

    expect(result).toMatchObject({
      booking: { id: "booking-current" },
    });

    const triedAcquire = tx.slot.updateMany.mock.calls.some(
      ([arg]) => arg?.where?.status === "AVAILABLE"
    );
    expect(triedAcquire).toBe(false);
  });

  it("throws LOCK_IN_USE when slot is locked by another active booking context", async () => {
    const tx = createTxMock();
    mockTransaction(tx);

    tx.slot.findUnique.mockResolvedValue({ ...futureSlot });
    tx.booking.findFirst.mockResolvedValueOnce({
      id: "booking-other",
      bookingStatus: "PAYMENT_PROCESSING",
    });

    await expect(
      lockBookingService({
        slotId: "slot-1",
        theatreId: "theatre-1",
        lockOwner: "owner-new",
        currentBookingId: "booking-current",
      })
    ).rejects.toThrow("LOCK_IN_USE");
  });

  it("throws SLOT_NOT_FOUND when slot does not exist", async () => {
    const tx = createTxMock();
    mockTransaction(tx);

    tx.slot.findUnique.mockResolvedValue(null);

    await expect(
      lockBookingService({
        slotId: "slot-missing",
        theatreId: "theatre-1",
        lockOwner: "owner-new",
      })
    ).rejects.toThrow("SLOT_NOT_FOUND");
  });

  it("locks an AVAILABLE slot and creates booking", async () => {
    const tx = createTxMock();
    mockTransaction(tx);

    tx.slot.findUnique.mockResolvedValue({
      ...futureSlot,
      status: "AVAILABLE",
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
    });
    tx.booking.findFirst.mockResolvedValueOnce(null);

    const result = await lockBookingService({
      slotId: "slot-1",
      theatreId: "theatre-1",
      lockOwner: "owner-new",
      currentBookingId: null,
    });

    expect(result.booking.id).toBe("booking-new");

    const acquireCall = tx.slot.updateMany.mock.calls.find(
      ([arg]) =>
        arg?.where?.id === "slot-1" && arg?.where?.status === "AVAILABLE"
    );
    expect(acquireCall).toBeTruthy();
    expect(acquireCall?.[0]?.data).toMatchObject({
      status: "LOCKED",
      lockedBy: "owner-new",
    });
  });

  it("returns existing booking when lock is owned by same lockOwner", async () => {
    const tx = createTxMock();
    mockTransaction(tx);

    tx.slot.findUnique.mockResolvedValue({
      ...futureSlot,
      lockedBy: "owner-same",
    });
    tx.booking.findFirst.mockResolvedValueOnce({
      id: "booking-owned",
      bookingStatus: "AWAITING_PAYMENT",
    });

    const result = await lockBookingService({
      slotId: "slot-1",
      theatreId: "theatre-1",
      lockOwner: "owner-same",
      currentBookingId: null,
    });

    expect(result).toMatchObject({
      booking: { id: "booking-owned" },
    });

    const triedAcquire = tx.slot.updateMany.mock.calls.some(
      ([arg]) =>
        arg?.where?.id === "slot-1" && arg?.where?.status === "AVAILABLE"
    );
    expect(triedAcquire).toBe(false);
  });

  it("runs expired/corrupt lock cleanup sweep before slot fetch", async () => {
    const tx = createTxMock();
    mockTransaction(tx);

    tx.slot.findUnique.mockResolvedValue({
      ...futureSlot,
      status: "AVAILABLE",
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
    });
    tx.booking.findFirst.mockResolvedValueOnce(null);

    await lockBookingService({
      slotId: "slot-1",
      theatreId: "theatre-1",
      lockOwner: "owner-cleanup",
      currentBookingId: null,
    });

    expect(tx.slot.updateMany).toHaveBeenCalled();
    const firstSlotUpdate = tx.slot.updateMany.mock.calls[0]?.[0];
    expect(firstSlotUpdate?.where?.status).toBe("LOCKED");
    expect(Array.isArray(firstSlotUpdate?.where?.OR)).toBe(true);

    const staleBookingsQuery = tx.booking.findMany.mock.calls[0]?.[0];
    expect(staleBookingsQuery?.where).toMatchObject({
      bookingStatus: "INCOMPLETE",
      OR: [{ createdByRole: null }, { createdByRole: { not: "ADMIN" } }],
    });
  });
});
