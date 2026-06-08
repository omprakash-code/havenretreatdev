import { cookies } from "next/headers";

import { verifyBookingSessionToken } from "@/services/booking/bookingSession.server";

export async function getRangeBookingApiIdentity(bookingId: string) {
  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  try {
    cookieStore = await cookies();
  } catch {
    return null;
  }
  const token = cookieStore.get("ds_booking_session")?.value;
  const identity = token ? verifyBookingSessionToken(token) : null;
  if (
    !identity ||
    identity.bookingId !== bookingId ||
    typeof identity.lockVersion !== "number"
  ) {
    return null;
  }
  return identity;
}
