import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, cookieStoreMock, verifyBookingSessionTokenMock } =
  vi.hoisted(() => ({
    prismaMock: {
      booking: { findUnique: vi.fn() },
    },
    cookieStoreMock: {
      get: vi.fn(),
      set: vi.fn(),
    },
    verifyBookingSessionTokenMock: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStoreMock),
}));

vi.mock("@/services/booking/bookingSession.server", () => ({
  verifyBookingSessionToken: verifyBookingSessionTokenMock,
}));

import { GET as getCurrent } from "@/app/api/bookings/current/route";

const SUBMITTED_BOOKING = {
  id: "booking_1",
  bookingRef: "HR0712202600001",
  bookingStatus: "PENDING_REVIEW",
  items: [],
  couponUsages: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  cookieStoreMock.get.mockReturnValue({ value: "session-token" });
  // Legacy (non-range) session: exercises the direct booking lookup branch.
  verifyBookingSessionTokenMock.mockReturnValue({
    bookingId: "booking_1",
    lockOwner: "owner_1",
  });
  prismaMock.booking.findUnique.mockResolvedValue(SUBMITTED_BOOKING);
});

/**
 * Regression: after submitting, the session cookie still pointed at the booking.
 * The route reported SESSION_EXPIRED, which is the exact code BookingContext
 * uses to show the "reservation timed out" modal — so a customer who had just
 * submitted was told their session expired instead of quietly starting fresh.
 */
describe("GET /api/bookings/current with a submitted booking", () => {
  it("does not report a submitted booking as an expired session", async () => {
    const res = await getCurrent();
    const json = await res.json();

    expect(json.code).not.toBe("SESSION_EXPIRED");
    expect(json.code).toBe("BOOKING_SUBMITTED");
    expect(json.success).toBe(false);
  });

  it("clears the stale session cookie so a new booking can start", async () => {
    await getCurrent();

    expect(cookieStoreMock.set).toHaveBeenCalledWith(
      "ds_booking_session",
      "",
      expect.objectContaining({ maxAge: 0 })
    );
  });

  it("never rehydrates a submitted booking as an editable draft", async () => {
    const res = await getCurrent();
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.data).toBeUndefined();
  });

  it("still resumes a genuine in-progress draft", async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      ...SUBMITTED_BOOKING,
      bookingStatus: "INCOMPLETE",
    });

    const res = await getCurrent();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.bookingRef).toBe("HR0712202600001");
  });
});
