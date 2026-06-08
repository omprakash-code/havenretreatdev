import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { verifyBookingSessionToken } from "@/services/booking/bookingSession.server";
import { getCurrentRangeBookingLock } from "@/services/booking/range-lock-lifecycle.service";

function clearBookingSession(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  cookieStore.set("ds_booking_session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function GET() {
  if (process.env.RANGE_BOOKING_LOCKS_ENABLED !== "true") {
    return NextResponse.json(
      { success: false, code: "RANGE_LOCKS_DISABLED" },
      { status: 404 }
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("ds_booking_session")?.value;
  const session = token ? verifyBookingSessionToken(token) : null;
  if (!session) {
    clearBookingSession(cookieStore);
    return NextResponse.json({ success: true, data: null });
  }

  const lock = await getCurrentRangeBookingLock(
    session.bookingId,
    session.lockOwner,
    session.lockVersion
  );
  if (!lock) {
    clearBookingSession(cookieStore);
    return NextResponse.json({ success: true, data: null });
  }

  return NextResponse.json({
    success: true,
    data: {
      bookingId: lock.bookingId,
      lockId: lock.id,
      version: lock.version,
      status: lock.status,
      theatreId: lock.theatreId,
      eventDate: lock.eventDate.toISOString().slice(0, 10),
      startTime: lock.startTime,
      endTime: lock.endTime,
      expiresAt: lock.expiresAt.toISOString(),
      guestCount: lock.booking.guestCount,
    },
  });
}
