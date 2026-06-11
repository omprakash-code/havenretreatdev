import { prisma } from "@/lib/db";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import { createSuccessToken } from "@/services/booking/successToken.server";
import { NextResponse } from "next/server";

function terminalStatusResponse(data: Record<string, unknown>) {
  const response = NextResponse.json(data);
  response.cookies.set("ds_booking_session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set("ds_lock_owner", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get("bookingId");

  if (!bookingId) {
    return bookingErrorResponse(400, "INVALID_REQUEST", "bookingId is required.");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      bookingRef: true,
      bookingStatus: true,
      paymentStatus: true,
      cancelledReason: true,
    },
  });

  if (!booking) {
    return bookingErrorResponse(404, "BOOKING_NOT_FOUND", "Booking not found.");
  }

  if (booking.bookingStatus === "CONFIRMED" && booking.paymentStatus === "PAID") {
    return terminalStatusResponse({
      success: true,
      status: "CONFIRMED",
      bookingRef: booking.bookingRef,
      successToken: createSuccessToken(booking.id, booking.bookingRef),
    });
  }

  if (booking.bookingStatus === "PAID_EXPIRED") {
    return terminalStatusResponse({
      success: true,
      status: "PAID_EXPIRED",
      bookingRef: booking.bookingRef,
      cancelledReason: booking.cancelledReason,
    });
  }

  if (
    booking.bookingStatus === "ABANDONED" &&
    booking.paymentStatus === "MANUAL_REVIEW"
  ) {
    return terminalStatusResponse({
      success: true,
      status: "MANUAL_REVIEW",
      bookingRef: booking.bookingRef,
      cancelledReason: booking.cancelledReason,
    });
  }

  return Response.json({
    success: true,
    status: booking.bookingStatus,
  });
}
