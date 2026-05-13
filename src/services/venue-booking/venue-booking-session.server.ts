import {
  createBookingSessionToken,
  verifyBookingSessionToken,
} from "@/services/booking/bookingSession.server";

export const VENUE_BOOKING_SESSION_COOKIE = "hr_booking_session";

export function createVenueBookingSessionToken(
  bookingId: string,
  sessionOwner: string
) {
  return createBookingSessionToken(bookingId, sessionOwner);
}

export function verifyVenueBookingSessionToken(token: string) {
  return verifyBookingSessionToken(token);
}

export function getVenueBookingSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 3,
  };
}
