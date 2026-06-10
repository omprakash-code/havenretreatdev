import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";

import {
  createBookingSessionToken,
  verifyBookingSessionToken,
} from "@/services/booking/bookingSession.server";
import {
  createOrReplaceVenueBookingSession,
  VenueBookingSessionError,
  venueBookingSessionInputSchema,
} from "@/services/booking/venue-booking-session.service";

function disabled() {
  return NextResponse.json(
    { success: false, code: "BOOKING_DISABLED" },
    { status: 503 }
  );
}

export async function POST(req: Request) {
  if (process.env.CUSTOMER_RANGE_BOOKING_ENABLED !== "true") {
    return disabled();
  }

  const body = await req.json().catch(() => null);
  const parsed = venueBookingSessionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, code: "INVALID_REQUEST", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const cookieStore = await cookies();

    // Resolve or generate lockOwner
    const sessionToken = cookieStore.get("ds_booking_session")?.value;
    const session = sessionToken ? verifyBookingSessionToken(sessionToken) : null;
    let lockOwner = cookieStore.get("ds_lock_owner")?.value ?? null;

    if (session?.lockOwner && lockOwner !== session.lockOwner) {
      lockOwner = session.lockOwner;
    }
    if (!lockOwner) {
      lockOwner = `guest_${crypto.randomUUID()}`;
    }

    const ownedSession =
      session?.lockOwner === lockOwner && session.lockVersion !== null
        ? { bookingId: session.bookingId, lockVersion: session.lockVersion }
        : null;

    const result = await createOrReplaceVenueBookingSession(
      parsed.data,
      lockOwner,
      ownedSession
    );

    const response = NextResponse.json({
      success: true,
      bookingId: result.bookingId,
      lockVersion: result.lockVersion,
    });

    response.cookies.set("ds_lock_owner", lockOwner, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 2,
    });
    response.cookies.set(
      "ds_booking_session",
      createBookingSessionToken(result.bookingId, lockOwner, result.lockVersion),
      {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 2,
      }
    );

    return response;
  } catch (err) {
    if (err instanceof VenueBookingSessionError) {
      const status =
        err.code === "PACKAGE_NOT_FOUND" ? 404 :
        err.code === "BOOKING_CONFLICT" ? 409 :
        err.code === "PAYMENT_IN_PROGRESS" ? 409 :
        err.code === "SESSION_STALE" ? 409 :
        400;
      return NextResponse.json(
        { success: false, code: err.code, message: err.message },
        { status }
      );
    }
    console.error("BOOKING_LOCK_ERROR", err);
    return NextResponse.json(
      { success: false, code: "INTERNAL_ERROR", message: "Failed to create booking session." },
      { status: 500 }
    );
  }
}
