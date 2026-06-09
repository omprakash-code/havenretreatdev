import { bookingErrorResponse } from "@/lib/booking-api-response";
import {
  assignNumberDecorationDetails,
  buildOccasionDetails,
} from "@/lib/booking-celebration";
import { prisma } from "@/lib/db";
import { getCouponDisplayCode } from "@/lib/coupon-display";
import { verifySuccessToken } from "@/services/booking/successToken.server";
import {
  resolveBookingDurationPricingConfig,
} from "@/lib/booking-duration-pricing";
import {
  PACKAGE_EXTRA_PERSON_PRICE,
  resolvePackageIncludedGuestCount,
} from "@/lib/package-guest-pricing";
import {
  resolveRangePackageGuestLimit,
} from "@/services/booking/range-booking-pricing.service";
import {
  getPackageIncludedProductExtraQuantity,
  getPackageIncludedProductQuantity,
} from "@/lib/package-included-products";
import { resolvePresentedBookingSchedule } from "@/lib/booking-schedule-presenter";

const DEFAULT_ADVANCE = 750;

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
          include: {
            product: {
              select: {
                slug: true,
              },
            },
          },
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
        theatre: {
          include: {
            location: true,
          },
        },
        slot: true,
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

    const schedule = resolvePresentedBookingSchedule({
      eventDate: booking.eventDate,
      eventStartTime: booking.eventStartTime,
      eventEndTime: booking.eventEndTime,
      startsAtUtc: booking.startsAtUtc,
      endsAtUtc: booking.endsAtUtc,
      timezone: booking.timezone,
      theatreTimezone: booking.theatre?.timezone,
      slot: booking.slot,
    }, "dd MMM yyyy");

    if (!schedule) {
      return bookingErrorResponse(
        404,
        "BOOKING_NOT_FOUND",
        "Booking schedule details not found."
      );
    }

    if (
      schedule.successTokenExpiresAt &&
      Date.now() > schedule.successTokenExpiresAt.getTime()
    ) {
      return bookingErrorResponse(
        410,
        "TOKEN_EXPIRED",
        "This confirmation link has expired. Please check your email for the latest confirmation."
      );
    }

    const theatre = booking.theatre;
    if (!theatre) {
      return bookingErrorResponse(
        404,
        "BOOKING_NOT_FOUND",
        "Booking details not found."
      );
    }

    const location = theatre.location;

    const productIds = [...new Set(booking.items.map((row) => row.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, image: true },
    });
    const productImageMap = new Map(products.map((row) => [row.id, row.image]));

    const formattedDate = schedule.date;
    const advance =
      booking.advancePaid !== null ? booking.advancePaid : DEFAULT_ADVANCE;
    const latestPayment = booking.payment[0] ?? null;
    const durationConfig = await resolveBookingDurationPricingConfig(prisma);
    const durationHours = schedule.durationHours;
    const extraDurationHours =
      durationHours !== null
        ? Math.max(durationHours - durationConfig.includedDurationHours, 0)
        : null;
    const isRangeBooking = booking.slotId === null;
    const packageGuestLimit = isRangeBooking
      ? resolveRangePackageGuestLimit(booking.packageSnapshot)
      : resolvePackageIncludedGuestCount(theatre);
    const includedProductSource = isRangeBooking
      ? { capacity: packageGuestLimit }
      : theatre;
    const includedGuestCount = isRangeBooking
      ? packageGuestLimit
      : resolvePackageIncludedGuestCount(theatre);
    const extraGuestCount = Math.max(booking.guestCount - includedGuestCount, 0);
    const packageAmount = isRangeBooking
      ? Number((booking.pricingSnapshot as { packageAmount?: number } | null)?.packageAmount ?? 0)
      : Number(booking.baseAmount ?? 0);
    const extraDurationAmount = isRangeBooking
      ? Number((booking.pricingSnapshot as { extraDurationAmount?: number } | null)?.extraDurationAmount ?? 0)
      : 0;

    const items = assignNumberDecorationDetails(
      booking.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        productSlug: item.product?.slug ?? null,
        variantLabel: item.variantLabel,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        includedQuantity: getPackageIncludedProductQuantity(includedProductSource, {
          slug: item.product?.slug,
          name: item.productName,
        }),
        extraQuantity: getPackageIncludedProductExtraQuantity(
          includedProductSource,
          {
            slug: item.product?.slug,
            name: item.productName,
          },
          item.quantity
        ),
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
      theatreName:
        (booking.packageSnapshot as { name?: string } | null)?.name ??
        theatre.name,
      theatreImage: theatre.images?.[0] ?? null,
      date: formattedDate,
      timeSlot: schedule.timeSlot,
      durationHours,
      includedDurationHours: durationConfig.includedDurationHours,
      extraDurationHours,
      locationName: location?.name ?? "—",
      dateTime: schedule.dateTime,
      occasionLabel: booking.occasionLabel ?? undefined,
      occasionDetails: buildOccasionDetails(
        (booking.occasionData as Record<string, unknown> | null) ?? null
      ),
      guestCount: booking.guestCount,
      includedGuestCount,
      extraGuestCount,
      extraPersonPrice: PACKAGE_EXTRA_PERSON_PRICE,
      decorationRequired: booking.decorationRequired,
      packageAmount,
      extraDurationAmount: extraDurationAmount > 0 ? extraDurationAmount : undefined,
      extrasAmount: booking.extrasAmount,
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
