import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyBookingSessionToken } from "@/services/booking/bookingSession.server";
import { BookingStatus } from "@prisma/client";
import { notifyAbandonedBookingsByIds } from "@/services/booking/booking-abandonment-email.service";
import {
  PAYMENT_CHECKOUT_ABANDONED_REASON,
  PAYMENT_STEP_ABANDONED_REASON,
} from "@/lib/admin-booking-status";
import { resolveTerminalAbandonedPaymentStatus } from "@/services/booking/booking-lock-lifecycle.service";

const RELEASE_ALLOWED_STATUSES: BookingStatus[] = [
  BookingStatus.INCOMPLETE,
  BookingStatus.AWAITING_PAYMENT,
  BookingStatus.PAYMENT_PROCESSING,
];

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionToken =
      cookieStore.get("ds_booking_session")?.value ?? null;

    if (!sessionToken) {
      return NextResponse.json(
        {
          success: true,
          released: false,
          message: "No active session",
        },
        { status: 200 }
      );
    }

    const payload = verifyBookingSessionToken(sessionToken);

    if (!payload) {
      return NextResponse.json(
        { success: false, message: "Invalid session token" },
        { status: 401 }
      );
    }

    const { bookingId, lockOwner } = payload;
    let released = false;
    const abandonedBookingIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { slot: true },
      });

      if (!booking || !booking.slot) {
        return;
      }

      if (!RELEASE_ALLOWED_STATUSES.includes(booking.bookingStatus)) {
        return;
      }

      if (booking.createdByRole === "ADMIN") {
        return;
      }

      if (booking.paymentStatus === "PAID") {
        return;
      }

      if (booking.slot.status === "LOCKED" && booking.slot.lockedBy !== lockOwner) {
        return;
      }

      await tx.slot.updateMany({
        where: {
          id: booking.slotId,
          status: "LOCKED",
          lockedBy: lockOwner,
        },
        data: {
          status: "AVAILABLE",
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      });

      if (booking.bookingStatus === BookingStatus.INCOMPLETE) {
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            bookingStatus: BookingStatus.ABANDONED,
            cancelledAt: new Date(),
            cancelledReason: "SESSION_EXPIRED",
          },
        });
        abandonedBookingIds.push(bookingId);
      } else if (
        booking.bookingStatus === BookingStatus.AWAITING_PAYMENT ||
        booking.bookingStatus === BookingStatus.PAYMENT_PROCESSING
      ) {
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            bookingStatus: BookingStatus.ABANDONED,
            cancelledAt: new Date(),
            cancelledReason:
              booking.bookingStatus === BookingStatus.PAYMENT_PROCESSING
                ? PAYMENT_CHECKOUT_ABANDONED_REASON
                : PAYMENT_STEP_ABANDONED_REASON,
            paymentStatus: await resolveTerminalAbandonedPaymentStatus(
              tx,
              bookingId
            ),
          },
        });
      }

      await tx.couponUsage.updateMany({
        where: {
          bookingId,
          status: "RESERVED",
        },
        data: {
          status: "RELEASED",
          discountAmount: 0,
          releasedAt: new Date(),
          confirmedAt: null,
        },
      });

      released = true;
    });

    if (abandonedBookingIds.length > 0) {
      try {
        await notifyAbandonedBookingsByIds(abandonedBookingIds);
      } catch (notifyError) {
        console.error("[BOOKING RELEASE ABANDONMENT NOTIFY ERROR]", notifyError);
      }
    }

    cookieStore.set("ds_booking_session", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return NextResponse.json({ success: true, released });
  } catch (error) {
    console.error("[BOOKING RELEASE ERROR]", error);

    return NextResponse.json(
      { success: false, message: "Release failed" },
      { status: 500 }
    );
  }
}
