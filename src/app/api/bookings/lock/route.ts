import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { lockBookingService } from "@/services/booking/lockBooking.service";
import {
  createBookingSessionToken,
  verifyBookingSessionToken,
} from "@/services/booking/bookingSession.server";
import { success } from "@/lib/response";

function errorResponse(
  status: number,
  code: string,
  message: string
) {
  return NextResponse.json(
    { success: false, code, message },
    { status }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { slotId, theatreId } = body;

    /* 1 Validate */
    if (!slotId || !theatreId) {
      return errorResponse(
        400,
        "INVALID_REQUEST",
        "Missing slot or theatre information."
      );
    }

    /* 2 Resolve guest identity */
    const cookieStore = await cookies();
    const guestToken = cookieStore.get("ds_lock_owner")?.value ?? null;

    if (!guestToken) {
      return errorResponse(
        401,
        "SESSION_EXPIRED",
        "Session expired. Please refresh and try again."
      );
    }

    const bookingSessionToken =
      cookieStore.get("ds_booking_session")?.value ?? null;
    const sessionPayload = bookingSessionToken
      ? verifyBookingSessionToken(bookingSessionToken)
      : null;
    const currentBookingId =
      sessionPayload &&
      sessionPayload.lockOwner === guestToken
        ? sessionPayload.bookingId
        : null;

    /* 3 Attempt lock */
    const lockResult = await lockBookingService({
      slotId,
      theatreId,
      lockOwner: guestToken,
      currentBookingId,
    });

    /* 4 Create booking session cookie */
    const sessionToken = createBookingSessionToken(
      lockResult.booking.id,
      guestToken
    );

    cookieStore.set("ds_booking_session", sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 2, // 2 hours
    });

    /* 5 Clear prebooking cookie */
    cookieStore.set("ds_prebooking", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return success({
      bookingId: lockResult.booking.id,
      lockExpiresAt: lockResult.lockExpiresAt?.toISOString() ?? null,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "UNKNOWN_ERROR";

    switch (message) {
      case "SLOT_NOT_FOUND":
        return errorResponse(
          404,
          "SLOT_NOT_FOUND",
          "Slot does not exist."
        );

      case "LOCK_IN_USE":
        return errorResponse(
          409,
          "LOCK_IN_USE",
          "This slot is currently reserved by another active booking."
        );

      case "SLOT_ALREADY_BOOKED":
        return errorResponse(
          409,
          "SLOT_ALREADY_BOOKED",
          "Slot already booked."
        );

      case "SLOT_NOT_AVAILABLE":
        return errorResponse(
          409,
          "RESERVATION_EXPIRED",
          "Reservation expired, please try again."
        );

      default:
        return errorResponse(
          500,
          "LOCK_FAILED",
          "Unable to reserve slot."
        );
    }
  }
}
