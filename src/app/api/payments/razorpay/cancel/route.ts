import { prisma } from "@/lib/db";
import { getRequiredAdvancePaymentAmount } from "@/lib/advance-payment";
import { bookingErrorResponse } from "@/lib/booking-api-response";

const CANCEL_DEDUPE_WINDOW_MS = 30 * 1000;
const DEFAULT_CANCEL_SOURCE = "CHECKOUT_MODAL";
const DEFAULT_CANCEL_REASON = "DISMISSED_BY_USER";

type CancelAttemptPayload = {
  bookingId?: string;
  source?: string;
  reason?: string;
};

function normalizeTag(value: string | undefined, fallback: string) {
  const cleaned = (value ?? fallback)
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .slice(0, 40);

  return cleaned.length > 0 ? cleaned : fallback;
}

export async function POST(req: Request) {
  try {
    const payload = (await req
      .json()
      .catch(() => null)) as CancelAttemptPayload | null;

    const bookingId = payload?.bookingId;
    const source = normalizeTag(
      payload?.source,
      DEFAULT_CANCEL_SOURCE
    );
    const reason = normalizeTag(
      payload?.reason,
      DEFAULT_CANCEL_REASON
    );

    if (!bookingId) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        "bookingId is required."
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        advancePaid: true,
      },
    });

    if (!booking) {
      return bookingErrorResponse(
        404,
        "BOOKING_NOT_FOUND",
        "Booking not found."
      );
    }

    const latestCancelledAttempt = await prisma.payment.findFirst({
      where: {
        bookingId,
        provider: "RAZORPAY",
        status: "CANCELLED",
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    if (latestCancelledAttempt) {
      const elapsedMs =
        Date.now() - latestCancelledAttempt.createdAt.getTime();
      if (elapsedMs <= CANCEL_DEDUPE_WINDOW_MS) {
        return Response.json({
          success: true,
          recorded: false,
          reason: "DUPLICATE_WITHIN_WINDOW",
        });
      }
    }

    const amount =
      booking.advancePaid && booking.advancePaid > 0
        ? booking.advancePaid
        : await getRequiredAdvancePaymentAmount(prisma);

    await prisma.payment.create({
      data: {
        bookingId,
        provider: "RAZORPAY",
        method: `CHECKOUT_DISMISSED|SRC:${source}|RSN:${reason}`,
        amount,
        status: "CANCELLED",
      },
    });

    return Response.json({
      success: true,
      recorded: true,
    });
  } catch (error) {
    console.error("RAZORPAY_CANCEL_ATTEMPT_ERROR", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to record cancelled payment attempt."
    );
  }
}
