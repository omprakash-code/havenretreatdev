import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { resolveGuestLockOwnerToken } from "@/app/api/theatres/_guest-token";
import {
  createBookingSessionToken,
  verifyBookingSessionToken,
} from "@/services/booking/bookingSession.server";
import {
  createOrReplaceRangeBookingLock,
  RangeBookingLockError,
  rangeBookingLockInputSchema,
} from "@/services/booking/range-booking-lock.service";
import { releaseCurrentRangeBookingLock } from "@/services/booking/range-lock-lifecycle.service";

function disabled() {
  return NextResponse.json(
    { success: false, code: "RANGE_LOCKS_DISABLED" },
    { status: 404 }
  );
}

function clearBookingSession(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  cookieStore.set("ds_booking_session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function POST(req: Request) {
  if (
    process.env.RANGE_BOOKING_LOCKS_ENABLED !== "true" ||
    process.env.CUSTOMER_RANGE_BOOKING_ENABLED !== "true"
  ) {
    return disabled();
  }

  const parsed = rangeBookingLockInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, code: "INVALID_REQUEST", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const cookieStore = await cookies();
    const lockOwner = await resolveGuestLockOwnerToken();
    const sessionToken = cookieStore.get("ds_booking_session")?.value;
    const session = sessionToken
      ? verifyBookingSessionToken(sessionToken)
      : null;
    const ownedSession =
      session?.lockOwner === lockOwner
        ? {
            bookingId: session.bookingId,
            lockVersion: session.lockVersion,
          }
        : null;

    const result = await createOrReplaceRangeBookingLock(
      parsed.data,
      lockOwner,
      ownedSession
    );
    cookieStore.set(
      "ds_booking_session",
      createBookingSessionToken(
        result.booking.id,
        lockOwner,
        result.lock.version
      ),
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 2,
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        bookingId: result.booking.id,
        lockId: result.lock.id,
        version: result.lock.version,
        packageId: result.booking.packageId,
        status: result.lock.status,
        expiresAt: result.lock.expiresAt.toISOString(),
        replaced: result.replaced,
      },
    });
  } catch (error) {
    if (error instanceof RangeBookingLockError) {
      const status = error.code === "LOCK_SESSION_STALE" ? 401 : 409;
      if (error.code === "LOCK_SESSION_STALE") {
        clearBookingSession(await cookies());
      }
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status }
      );
    }
    console.error("RANGE_BOOKING_LOCK_FAILED", error);
    return NextResponse.json(
      { success: false, code: "LOCK_FAILED" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  if (process.env.RANGE_BOOKING_LOCKS_ENABLED !== "true") return disabled();

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("ds_booking_session")?.value;
  const session = sessionToken
    ? verifyBookingSessionToken(sessionToken)
    : null;
  if (!session) {
    clearBookingSession(cookieStore);
    return NextResponse.json({ success: true, data: { released: false } });
  }

  const released = await releaseCurrentRangeBookingLock(
    session.bookingId,
    session.lockOwner,
    session.lockVersion
  );
  clearBookingSession(cookieStore);
  return NextResponse.json({ success: true, data: { released } });
}
