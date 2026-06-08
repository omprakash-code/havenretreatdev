import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createBookingSessionToken,
  verifyBookingSessionToken,
} from "@/services/booking/bookingSession.server";

describe("booking session lock version", () => {
  beforeEach(() => {
    vi.stubEnv("BOOKING_SESSION_SECRET", "test-booking-session-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips a versioned range lock session", () => {
    const token = createBookingSessionToken("booking-1", "owner-1", 3);

    expect(verifyBookingSessionToken(token)).toEqual({
      bookingId: "booking-1",
      lockOwner: "owner-1",
      lockVersion: 3,
    });
  });

  it("continues to accept legacy unversioned sessions", () => {
    const token = createBookingSessionToken("booking-1", "owner-1");

    expect(verifyBookingSessionToken(token)).toEqual({
      bookingId: "booking-1",
      lockOwner: "owner-1",
      lockVersion: null,
    });
  });
});
