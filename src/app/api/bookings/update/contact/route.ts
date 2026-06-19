// src/app/api/bookings/update/contact/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import { calculateBookingPricing } from "@/lib/booking-pricing";
import { BOOKING_SESSION_EXPIRED_MODAL_MESSAGE } from "@/lib/booking-session-expiry";
import { buildMinimumPayableMessage } from "@/services/coupon/coupon-minimum-payable";
import {
  buildBookingCouponContext,
  BookingCouponMinimumPayableError,
  rebalanceReservedBookingCoupons,
  resolveBookingCouponUserId,
} from "@/services/coupon/booking-coupon.service";
import { getRequiredAdvancePaymentAmount } from "@/lib/advance-payment";
import {
  resolveBookingDurationPricingConfig,
  resolveSlotDurationHours,
} from "@/lib/booking-duration-pricing";
import {
  PACKAGE_EXTRA_PERSON_PRICE,
  maxGuestsForIncluded,
  resolvePackageIncludedGuestCount,
} from "@/lib/package-guest-pricing";
import { getRangeBookingApiIdentity } from "@/services/booking/range-booking-api-session";
import {
  buildRangePricingSnapshot,
  resolveRangePackageGuestLimit,
} from "@/services/booking/range-booking-pricing.service";
import {
  RangeBookingSessionError,
  requireActiveRangeBookingSession,
} from "@/services/booking/range-booking-session.service";

const EDITABLE_BOOKING_STATUSES = [
  "INCOMPLETE",
  "AWAITING_PAYMENT",
  "PAYMENT_PROCESSING",
] as const;

function isEditableBookingStatus(status: string) {
  return EDITABLE_BOOKING_STATUSES.includes(
    status as (typeof EDITABLE_BOOKING_STATUSES)[number]
  );
}

export async function POST(req: Request) {
  let minimumPayableForError = 0;
  try {
    const {
      bookingId,
      name,
      phone,
      email,
      guestCount,
      decorationRequired,
    } = await req.json();

    if (!bookingId || !name || !phone || guestCount == null) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        "Missing required fields."
      );
    }

    const rangeIdentity = await getRangeBookingApiIdentity(bookingId);
    if (rangeIdentity) {
      const result = await prisma.$transaction(async (tx) => {
        const { booking } = await requireActiveRangeBookingSession(
          rangeIdentity,
          new Date(),
          tx
        );
        if (!isEditableBookingStatus(booking.bookingStatus)) {
          throw new Error("BOOKING_INVALID_STATE");
        }

        const includedGuests = resolveRangePackageGuestLimit(
          booking.packageSnapshot
        );
        const maxGuests = maxGuestsForIncluded(includedGuests);
        const parsedGuestCount = Number(guestCount);
        if (
          !Number.isInteger(parsedGuestCount) ||
          parsedGuestCount < includedGuests ||
          parsedGuestCount > maxGuests
        ) {
          throw new Error("INVALID_GUEST_COUNT");
        }

        const productsAmount = booking.items.reduce(
          (sum, item) => sum + Math.max(item.totalPrice, 0),
          0
        );
        const pricingSnapshot = buildRangePricingSnapshot({
          packageSnapshot: booking.packageSnapshot,
          pricingSnapshot: booking.pricingSnapshot,
          guestCount: parsedGuestCount,
          productsAmount,
          discountAmount: booking.discountAmount,
        });

        await tx.booking.update({
          where: { id: booking.id },
          data: {
            contactName: name,
            contactPhone: phone,
            contactEmail: email ?? null,
            guestCount: parsedGuestCount,
            decorationRequired: Boolean(decorationRequired),
            pricingSnapshot,
            baseAmount:
              pricingSnapshot.packageAmount +
              pricingSnapshot.extraDurationAmount,
            extrasAmount: pricingSnapshot.extraGuestAmount,
            productsAmount,
            totalAmount: pricingSnapshot.totalAmount,
            remainingPayable: Math.max(
              pricingSnapshot.totalAmount - booking.advancePaid,
              0
            ),
            user: {
              connectOrCreate: {
                where: { phone },
                create: { name, phone, email: email ?? null },
              },
            },
          },
        });

        return {
          effectiveDecorationRequired: Boolean(decorationRequired),
          discountAmount: booking.discountAmount,
          appliedCoupons: booking.couponUsages.map((usage) => ({
            id: usage.coupon.id,
            code: usage.coupon.code,
            discountAmount: usage.discountAmount ?? 0,
            status: usage.status,
          })),
        };
      });

      return NextResponse.json({ success: true, data: result });
    }

    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          items: true,
        },
      });

      if (!booking) {
        throw new Error("BOOKING_NOT_FOUND");
      }

      if (booking.bookingStatus === "CONFIRMED") {
        throw new Error("BOOKING_FINALIZED");
      }

      if (!isEditableBookingStatus(booking.bookingStatus)) {
        throw new Error("BOOKING_INVALID_STATE");
      }

      const legacySnapshot = booking.packageSnapshot as
        | { capacity?: number | null; guestLimit?: number | null }
        | null;
      const includedGuestCount = resolvePackageIncludedGuestCount({
        capacity: legacySnapshot?.guestLimit ?? legacySnapshot?.capacity ?? null,
      });
      const guestLimit = maxGuestsForIncluded(includedGuestCount);
      const parsedGuestCount = Number(guestCount);
      const normalizedGuestCount = Math.min(
        Math.max(
          Number.isFinite(parsedGuestCount)
            ? Math.trunc(parsedGuestCount)
            : includedGuestCount,
          includedGuestCount
        ),
        guestLimit
      );

      const effectiveDecorationRequired = Boolean(decorationRequired);
      const contextItems = booking.items.map((item) => ({
        itemKey: item.id,
        productId: item.productId,
        category: item.category,
        totalPrice: item.totalPrice,
      }));
      const productsTotal = contextItems.reduce(
        (sum, item) => sum + Math.max(Number(item.totalPrice ?? 0), 0),
        0
      );
      const durationPricing = await resolveBookingDurationPricingConfig(tx);
      const packageHourlyRate =
        (booking.packageSnapshot as { hourlyRate?: number } | null)?.hourlyRate;
      const effectiveExtraHourlyRate =
        packageHourlyRate || durationPricing.extraHourlyRate;
      const durationHours = resolveSlotDurationHours({
        startTime: booking.eventStartTime ?? '',
        endTime: booking.eventEndTime ?? '',
        durationMin:
          booking.startsAtUtc && booking.endsAtUtc
            ? Math.round(
                (booking.endsAtUtc.getTime() - booking.startsAtUtc.getTime()) / 60_000
              )
            : 0,
      });

      const pricingBase = calculateBookingPricing({
        slotBasePrice: booking.baseAmount,
        slotFinalPrice: booking.baseAmount,
        durationHours,
        includedDurationHours: durationPricing.includedDurationHours,
        extraHourlyRate: effectiveExtraHourlyRate,
        guestCount: normalizedGuestCount,
        theatreBaseGuests: includedGuestCount,
        theatreExtraPersonPrice: PACKAGE_EXTRA_PERSON_PRICE,
        productsAmount: 0,
        discountAmount: 0,
        advancePaid: 0,
      });
      const slotAmount = pricingBase.baseAmount;
      const nonSlotAmount =
        pricingBase.extrasAmount +
        pricingBase.decorationAmount +
        productsTotal;
      const bookingTotalBeforeDiscount = slotAmount + nonSlotAmount;
      const resolvedUserId = await resolveBookingCouponUserId(tx, {
        userId: null,
        contactPhone: phone,
      });
      const context = buildBookingCouponContext({
        bookingSchedule: {
          eventDate: booking.eventDate,
          eventStartTime: booking.eventStartTime,
          eventEndTime: booking.eventEndTime,
          startsAtUtc: booking.startsAtUtc,
          endsAtUtc: booking.endsAtUtc,
        },
        venueId: booking.venueId ?? '',
        locationId: '',
        userId: resolvedUserId,
        contactPhone: phone,
        decorationRequired: effectiveDecorationRequired,
        items: contextItems,
        slotAmount,
        nonSlotAmount,
        productsTotal,
        extrasTotal: pricingBase.extrasAmount,
      });

      const advanceFloor = await getRequiredAdvancePaymentAmount(tx);
      minimumPayableForError = advanceFloor;
      const { totalDiscount, appliedCoupons } =
        await rebalanceReservedBookingCoupons({
          tx,
          bookingId,
          context,
          resolvedUserId,
          minimumPayable: advanceFloor,
        });
      const totalAmount = bookingTotalBeforeDiscount - totalDiscount;
      const shouldInvalidatePaymentOrder =
        booking.bookingStatus === "AWAITING_PAYMENT" ||
        booking.bookingStatus === "PAYMENT_PROCESSING";

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          contactName: name,
          contactPhone: phone,
          contactEmail: email ?? null,
          guestCount: normalizedGuestCount,
          decorationRequired: effectiveDecorationRequired,
          baseAmount: pricingBase.baseAmount,
          extrasAmount: pricingBase.extrasAmount,
          decorationAmount: pricingBase.decorationAmount,
          productsAmount: productsTotal,
          discountAmount: totalDiscount,
          totalAmount,
          remainingPayable: Math.max(totalAmount - booking.advancePaid, 0),
          advancePaid: booking.advancePaid,
          ...(shouldInvalidatePaymentOrder
            ? {
                bookingStatus: "AWAITING_PAYMENT" as const,
                paymentStatus: "INITIALIZED" as const,
                paymentProvider: null,
                paymentOrderId: null,
                paymentTransactionId: null,
                paymentSignature: null,
                paymentCheckoutUrl: null,
              }
            : {}),
          user: {
            connectOrCreate: {
              where: { phone },
              create: { name, phone, email: email ?? null },
            },
          },
        },
      });

      return {
        effectiveDecorationRequired,
        discountAmount: totalDiscount,
        appliedCoupons,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        effectiveDecorationRequired: result.effectiveDecorationRequired,
        discountAmount: result.discountAmount,
        appliedCoupons: result.appliedCoupons,
      },
    });
  } catch (error) {
    if (error instanceof RangeBookingSessionError) {
      return bookingErrorResponse(
        error.code === "BOOKING_NOT_FOUND" ? 404 : 409,
        error.code,
        error.message
      );
    }
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";

    if (code === "BOOKING_NOT_FOUND") {
      return bookingErrorResponse(404, code, "Booking not found.");
    }
    if (code === "BOOKING_FINALIZED") {
      return bookingErrorResponse(
        409,
        code,
        "This booking is already confirmed."
      );
    }
    if (code === "BOOKING_INVALID_STATE") {
      return bookingErrorResponse(
        409,
        "SESSION_EXPIRED",
        BOOKING_SESSION_EXPIRED_MODAL_MESSAGE
      );
    }
    if (code === "BOOKING_INVALID_DETAILS") {
      return bookingErrorResponse(
        409,
        "BOOKING_INVALID_STATE",
        "Booking details are incomplete."
      );
    }
    if (code === "INVALID_GUEST_COUNT") {
      return bookingErrorResponse(
        400,
        code,
        "Guest count is outside the package and venue limits."
      );
    }
    if (code === "SLOT_EXPIRED") {
      return bookingErrorResponse(
        409,
        code,
        "Selected slot has expired. Please choose a slot again."
      );
    }
    if (
      code === "COUPON_MINIMUM_PAYABLE_NOT_MET" ||
      error instanceof BookingCouponMinimumPayableError
    ) {
      return bookingErrorResponse(
        409,
        "COUPON_NOT_APPLICABLE",
        buildMinimumPayableMessage(minimumPayableForError),
        {
          severity: "info",
        }
      );
    }

    console.error("CONTACT UPDATE ERROR:", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to update booking."
    );
  }
}
