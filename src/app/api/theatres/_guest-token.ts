import { cookies } from "next/headers";
import { nanoid } from "nanoid";

import { verifyBookingSessionToken } from "@/services/booking/bookingSession.server";

export async function resolveGuestLockOwnerToken() {
  const cookieStore = await cookies();
  const bookingSessionToken =
    cookieStore.get("ds_booking_session")?.value ?? null;
  const bookingSessionPayload = bookingSessionToken
    ? verifyBookingSessionToken(bookingSessionToken)
    : null;
  const sessionLockOwner = bookingSessionPayload?.lockOwner ?? null;
  let guestToken = cookieStore.get("ds_lock_owner")?.value ?? null;

  // Keep lock owner consistent with active booking session when available.
  if (sessionLockOwner && guestToken !== sessionLockOwner) {
    guestToken = sessionLockOwner;
    cookieStore.set("ds_lock_owner", guestToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 2, // 2 hours
    });
  }

  if (!guestToken) {
    guestToken = `guest_${nanoid()}`;
    cookieStore.set("ds_lock_owner", guestToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 2, // 2 hours
    });
  }

  return guestToken;
}
