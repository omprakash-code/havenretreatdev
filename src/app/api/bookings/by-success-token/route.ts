import { formatInTimeZone } from "date-fns-tz";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import {
  assignNumberDecorationDetails,
  buildOccasionDetails,
} from "@/lib/booking-celebration";
import { prisma } from "@/lib/db";
import { getCouponDisplayCode } from "@/lib/coupon-display";
import { formatSlotTime } from "@/lib/formatters";
import { timeToMinutes } from "@/lib/time";
import { verifySuccessToken } from "@/services/booking/successToken.server";

const IST_TIMEZONE = "Asia/Kolkata";
const DEFAULT_ADVANCE = 750;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("t");

    if (!token) {
      return bookingErrorResponse(
        400,
        "INVALID_TOKEN",
        "Invalid or expired success link"
      );
    }

    const verification = verifySuccessToken(token);
    if (!verification.valid || !verification.payload) {
      return bookingErrorResponse(
        400,
        "INVALID_TOKEN",
        "Invalid or expired success link"
      );
    }

    const { bookingId, bookingRef } = verification.payload;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
        },
        payment: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            provider: true,
            method: true,
            transactionId: true,
            status: true,
            amount: true,
            createdAt: true,
          },
        },
        couponUsages: {
          where: { status: "CONFIRMED" },
          include: {
            coupon: {
              select: {
                id: true,
                code: true,
              },
            },
          },
          orderBy: { confirmedAt: "asc" },
        },
      },
    });

    if (
      !booking ||
      booking.bookingStatus !== "CONFIRMED" ||
      booking.bookingRef !== bookingRef
    ) {
      return bookingErrorResponse(
        404,
        "INVALID_TOKEN",
        "Invalid or expired success link"
      );
    }

    const slot = await prisma.slot.findUnique({
      where: { id: booking.slotId },
    });
    if (!slot) {
      return bookingErrorResponse(
        404,
        "BOOKING_NOT_FOUND",
        "Booking details not found."
      );
    }

    const dateKey = formatInTimeZone(slot.date, IST_TIMEZONE, "yyyy-MM-dd");
    let slotEndAt = new Date(`${dateKey}T${slot.endTime}:00+05:30`);
    const isOvernight =
      timeToMinutes(slot.endTime) <= timeToMinutes(slot.startTime);
    if (isOvernight) {
      slotEndAt = new Date(slotEndAt.getTime() + ONE_DAY_MS);
    }

    const tokenExpiryAt = new Date(slotEndAt.getTime() + ONE_DAY_MS);
    if (Date.now() > tokenExpiryAt.getTime()) {
      return bookingErrorResponse(
        410,
        "TOKEN_EXPIRED",
        "This confirmation link has expired. Please check your email for the latest confirmation."
      );
    }

    const theatre = await prisma.theatre.findUnique({
      where: { id: booking.theatreId },
    });
    if (!theatre) {
      return bookingErrorResponse(
        404,
        "BOOKING_NOT_FOUND",
        "Booking details not found."
      );
    }

    const location = await prisma.location.findUnique({
      where: { id: theatre.locationId },
    });

    const productIds = [...new Set(booking.items.map((row) => row.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, image: true },
    });
    const productImageMap = new Map(products.map((row) => [row.id, row.image]));

    const formattedDate = formatInTimeZone(slot.date, IST_TIMEZONE, "dd MMM yyyy");
    const advance =
      booking.advancePaid !== null ? booking.advancePaid : DEFAULT_ADVANCE;
    const latestPayment = booking.payment[0] ?? null;

    const items = assignNumberDecorationDetails(
      booking.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        variantLabel: item.variantLabel,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        image: productImageMap.get(item.productId) ?? null,
      })),
      (booking.occasionData as Record<string, unknown> | null) ?? null
    );

    return Response.json({
      success: true,
      bookingRef: booking.bookingRef,
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
      createdByRole: booking.createdByRole,
      contact: {
        name: booking.contactName,
        phone: booking.contactPhone,
        email: booking.contactEmail ?? undefined,
      },
      theatreName: theatre.name,
      theatreImage: theatre.images?.[0] ?? null,
      date: formattedDate,
      timeSlot: formatSlotTime(slot.startTime, slot.endTime),
      locationName: location?.name ?? "—",
      dateTime: `${formattedDate}, ${formatSlotTime(slot.startTime, slot.endTime)}`,
      occasionLabel: booking.occasionLabel ?? undefined,
      occasionDetails: buildOccasionDetails(
        (booking.occasionData as Record<string, unknown> | null) ?? null
      ),
      guestCount: booking.guestCount,
      decorationRequired: booking.decorationRequired,
      totalAmount: booking.totalAmount,
      discountAmount: booking.discountAmount,
      advancePaid: advance,
      remainingPayable: booking.remainingPayable ?? booking.totalAmount - advance,
      payment:
        latestPayment != null
          ? {
              provider: latestPayment.provider,
              method: latestPayment.method,
              transactionId: latestPayment.transactionId,
              status: latestPayment.status,
              amount: latestPayment.amount,
              createdAt: latestPayment.createdAt,
            }
          : null,
      appliedCoupons: booking.couponUsages.map((usage) => ({
        id: usage.coupon.id,
        code: getCouponDisplayCode(usage.coupon.code),
        discountAmount: usage.discountAmount ?? 0,
      })),
      items,
    });
  } catch (error) {
    console.error("BOOKING_BY_SUCCESS_TOKEN_ERROR", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to load booking confirmation."
    );
  }
}
