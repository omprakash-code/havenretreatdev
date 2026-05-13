import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, verifyBookingSessionTokenMock, cookiesMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
  },
  verifyBookingSessionTokenMock: vi.fn(),
  cookiesMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/services/booking/bookingSession.server", () => ({
  verifyBookingSessionToken: verifyBookingSessionTokenMock,
}));

vi.mock("@/services/booking/booking-abandonment-email.service", () => ({
  notifyAbandonedBookingsByIds: vi.fn().mockResolvedValue({
    notifiedBookingIds: [],
  }),
}));

import { POST } from "@/app/api/bookings/release/route";

function createCookieStore(withSession = true) {
  return {
    get: vi.fn((key: string) =>
      key === "ds_booking_session" && withSession
        ? { value: "booking-session-token" }
        : undefined
    ),
    set: vi.fn(),
  };
}

function createTxMock() {
  return {
    booking: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    slot: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    couponUsage: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

describe("POST /api/bookings/release", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not release admin-created booking sessions", async () => {
    const store = createCookieStore(true);
    cookiesMock.mockResolvedValue(store);
    verifyBookingSessionTokenMock.mockReturnValue({
      bookingId: "booking_admin",
      lockOwner: "owner_1",
    });

    const tx = createTxMock();
    tx.booking.findUnique.mockResolvedValue({
      id: "booking_admin",
      bookingStatus: "INCOMPLETE",
      paymentStatus: null,
      createdByRole: "ADMIN",
      slotId: "slot_1",
      slot: {
        id: "slot_1",
        status: "LOCKED",
        lockedBy: "owner_1",
      },
    });

    prismaMock.$transaction.mockImplementation(async (cb: (inner: typeof tx) => Promise<unknown>) =>
      cb(tx)
    );

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, released: false });
    expect(tx.slot.updateMany).not.toHaveBeenCalled();
    expect(tx.booking.update).not.toHaveBeenCalled();
    expect(tx.couponUsage.updateMany).not.toHaveBeenCalled();
  });

  it("releases customer booking session lock and marks booking abandoned", async () => {
    const store = createCookieStore(true);
    cookiesMock.mockResolvedValue(store);
    verifyBookingSessionTokenMock.mockReturnValue({
      bookingId: "booking_customer",
      lockOwner: "owner_1",
    });

    const tx = createTxMock();
    tx.booking.findUnique.mockResolvedValue({
      id: "booking_customer",
      bookingStatus: "INCOMPLETE",
      paymentStatus: null,
      createdByRole: "CUSTOMER",
      slotId: "slot_1",
      slot: {
        id: "slot_1",
        status: "LOCKED",
        lockedBy: "owner_1",
      },
    });

    prismaMock.$transaction.mockImplementation(async (cb: (inner: typeof tx) => Promise<unknown>) =>
      cb(tx)
    );

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, released: true });
    expect(tx.slot.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.booking.update).toHaveBeenCalledTimes(1);
    expect(tx.couponUsage.updateMany).toHaveBeenCalledTimes(1);
  });
});
