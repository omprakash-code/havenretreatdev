import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/services/booking/lockBooking.service", () => ({
  lockBookingService: vi.fn(),
}));

vi.mock("@/services/booking/bookingSession.server", () => ({
  createBookingSessionToken: vi.fn(() => "session-token"),
  verifyBookingSessionToken: vi.fn(() => null),
}));

import { cookies } from "next/headers";
import { POST } from "@/app/api/bookings/lock/route";
import { lockBookingService } from "@/services/booking/lockBooking.service";
import { verifyBookingSessionToken } from "@/services/booking/bookingSession.server";

function createCookieStore(input: {
  lockOwner?: string | null;
  bookingSession?: string | null;
}) {
  return {
    get: vi.fn((key: string) => {
      if (key === "ds_lock_owner" && input.lockOwner) {
        return { value: input.lockOwner };
      }
      if (key === "ds_booking_session" && input.bookingSession) {
        return { value: input.bookingSession };
      }
      return undefined;
    }),
    set: vi.fn(),
  };
}

describe("POST /api/bookings/lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns structured INVALID_REQUEST when slot/theatre data is missing", async () => {
    const req = new Request("http://localhost/api/bookings/lock", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toMatchObject({
      success: false,
      code: "INVALID_REQUEST",
    });
  });

  it("returns structured SESSION_EXPIRED when lock owner cookie is missing", async () => {
    const store = createCookieStore({ lockOwner: null });
    (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      store
    );

    const req = new Request("http://localhost/api/bookings/lock", {
      method: "POST",
      body: JSON.stringify({
        slotId: "slot-1",
        theatreId: "theatre-1",
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toMatchObject({
      success: false,
      code: "SESSION_EXPIRED",
    });
  });

  it("maps LOCK_IN_USE from service to structured 409 response", async () => {
    const store = createCookieStore({ lockOwner: "owner-1" });
    (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      store
    );
    (
      lockBookingService as unknown as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new Error("LOCK_IN_USE"));

    const req = new Request("http://localhost/api/bookings/lock", {
      method: "POST",
      body: JSON.stringify({
        slotId: "slot-1",
        theatreId: "theatre-1",
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json).toMatchObject({
      success: false,
      code: "LOCK_IN_USE",
      message:
        "This slot is currently reserved by another active booking.",
    });
  });

  it("passes currentBookingId from booking session payload to lock service", async () => {
    const store = createCookieStore({
      lockOwner: "owner-1",
      bookingSession: "booking-session-token",
    });
    (cookies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      store
    );
    (
      verifyBookingSessionToken as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      bookingId: "booking-123",
      lockOwner: "owner-1",
    });
    (
      lockBookingService as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      booking: { id: "booking-123" },
      lockExpiresAt: null,
    });

    const req = new Request("http://localhost/api/bookings/lock", {
      method: "POST",
      body: JSON.stringify({
        slotId: "slot-1",
        theatreId: "theatre-1",
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(lockBookingService).toHaveBeenCalledWith(
      expect.objectContaining({
        slotId: "slot-1",
        theatreId: "theatre-1",
        lockOwner: "owner-1",
        currentBookingId: "booking-123",
      })
    );
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.bookingId).toBe("booking-123");
  });
});
