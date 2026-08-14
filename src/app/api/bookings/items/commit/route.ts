// src/app/api/bookings/items/commit/route.ts

/*-------------------------------------------------
* ---------------Commit workflow-------------------
*              Phase	What happens
* UI interaction          >  Context only (instant)
* Page change / Continue  >  Single commit
* DB write	              >  One transaction
* Pricing                 >	 Recalculated once
* Recovery                >  Safe

Commit API = “Save snapshot once”
--------------------------------------------------*/
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { calculateBookingPricing } from "@/lib/booking-pricing";
import {
  buildMinimumPayableMessage,
} from "@/services/coupon/coupon-minimum-payable";
import {
  buildBookingCouponContext,
  BookingCouponMinimumPayableError,
  rebalanceReservedBookingCoupons,
  resolveBookingCouponUserId,
} from "@/services/coupon/booking-coupon.service";
import { getRequiredAdvancePaymentAmount } from "@/lib/advance-payment";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import { BOOKING_SESSION_EXPIRED_MODAL_MESSAGE } from "@/lib/booking-session-expiry";
import { isNumberDecorationProduct } from "@/lib/product-numbering";
import { getVariantMaxAllowed } from "@/lib/product-stock";
import { getCouponDisplayCode } from "@/lib/coupon-display";
import { centsToMoney, toCents, toMoney } from "@/lib/money";
import {
  resolveBookingDurationPricingConfig,
  resolveSlotDurationHours,
} from "@/lib/booking-duration-pricing";
import { getDurationAdjustedUnitPrice } from "@/lib/product-duration-pricing";
import { resolveVariantBaseUnitPrice } from "@/lib/variant-price";
import {
  PACKAGE_EXTRA_PERSON_PRICE,
  maxGuestsForIncluded,
} from "@/lib/package-guest-pricing";
import {
  parsePackageIncludedAllowances,
  priceIncludedProductLine,
  rebuildLegacyPackageIncludedAllowances,
} from "@/lib/package-included-products";
import { getRangeBookingApiIdentity } from "@/services/booking/range-booking-api-session";
import {
  buildRangePricingSnapshot,
  resolveRangePackageGuestLimit,
} from "@/services/booking/range-booking-pricing.service";
import {
  RangeBookingSessionError,
  requireActiveRangeBookingSession,
} from "@/services/booking/range-booking-session.service";

function isEditableBookingStatus(status: string) {
  return (
    status === "INCOMPLETE" ||
    status === "AWAITING_PAYMENT" ||
    status === "PAYMENT_PROCESSING"
  );
}

export async function POST(req: Request) {
  let minimumPayableForError = 0;
  try {
    const body = await req
      .json()
      .catch(() => null) as
      | {
          bookingId?: string;
          items?: Array<Record<string, unknown>>;
          guestCount?: unknown;
          decorationRequired?: unknown;
        }
      | null;

    const bookingId = body?.bookingId;
    const items = body?.items;
    const requestedGuestCountRaw =
      typeof body?.guestCount === "number" ? body.guestCount : null;
    const requestedDecorationRequiredRaw =
      typeof body?.decorationRequired === "boolean"
        ? body.decorationRequired
        : null;

    if (!bookingId || !Array.isArray(items)) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        "Invalid booking payload."
      );
    }
    const rangeIdentity = await getRangeBookingApiIdentity(bookingId);

    const normalizedItemsMap = new Map<
      string,
      {
        productId: string;
        variantId: string;
        quantity: number;
        ledNumber: string;
      }
    >();

    items.forEach((item) => {
      const productId = String(item.productId ?? "").trim();
      const variantId = String(item.variantId ?? "").trim();
      const quantity = Number(item.quantity ?? 0);
      const ledNumber =
        typeof item.ledNumber === "string"
          ? item.ledNumber.trim().replace(/\D/g, "").slice(0, 3)
          : "";

      if (
        !productId ||
        !variantId ||
        !Number.isFinite(quantity) ||
        !Number.isInteger(quantity) ||
        quantity < 0
      ) {
        throw new Error("INVALID_REQUEST");
      }

      // Zero is retained: on a package-included line it means "reduced to
      // nothing", which is different from omitting the line entirely (that
      // keeps the package default). Non-allowance zeros are filtered later.
      const key = `${productId}:${variantId}`;
      const existing = normalizedItemsMap.get(key);
      normalizedItemsMap.set(key, {
        productId,
        variantId,
        quantity: (existing?.quantity ?? 0) + quantity,
        ledNumber: ledNumber || existing?.ledNumber || "",
      });
    });

    await prisma.$transaction(async (tx) => {
      // Serialize item commits per booking so overlapping requests cannot
      // interleave delete/recreate cycles and trip the unique (bookingId, variantId) key.
      await tx.$queryRaw`
        SELECT id
        FROM "Booking"
        WHERE id = ${bookingId}
        FOR UPDATE
      `;

      // 0 Lock booking FIRST
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          eventPackage: { select: { locationId: true } },
          // Needed only to rebuild an allowance for bookings that predate
          // packageIncludedSnapshot.
          items: {
            select: {
              productId: true,
              variantId: true,
              productName: true,
              unitPrice: true,
              includedUnitPrice: true,
            },
          },
        },
      });

      if (!booking) {
        throw new Error("BOOKING_NOT_FOUND");
      }

      if (booking.bookingStatus === "APPROVED") {
        throw new Error("BOOKING_FINALIZED");
      }

      if (!isEditableBookingStatus(booking.bookingStatus)) {
        throw new Error("BOOKING_INVALID_STATE");
      }

      if (!rangeIdentity) throw new Error("SESSION_EXPIRED");
      await requireActiveRangeBookingSession(rangeIdentity, new Date(), tx);

      const locationId: string | null = booking.eventPackage?.locationId ?? null;
      const schedule = {
        id: `range:${booking.id}`,
        date: booking.eventDate!,
        startTime: booking.eventStartTime!,
        endTime: booking.eventEndTime!,
        durationMin:
          booking.startsAtUtc && booking.endsAtUtc
            ? Math.round(
                (booking.endsAtUtc.getTime() -
                  booking.startsAtUtc.getTime()) /
                  60_000
              )
            : 0,
        basePrice: booking.baseAmount,
        finalPrice: booking.baseAmount,
        decorationMandatory: false,
      };
      const durationHours = resolveSlotDurationHours({
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        durationMin: schedule.durationMin,
      });
      const effectiveItemsMap = new Map(normalizedItemsMap);
      const includedProductSource = { capacity: resolveRangePackageGuestLimit(booking.packageSnapshot) };

      // The allowance was frozen when the package was chosen. Rebuilding it from
      // live products here would reprice an in-progress booking whenever an
      // admin changed a product price mid-session.
      const persistedAllowances = parsePackageIncludedAllowances(
        booking.packageIncludedSnapshot
      );
      const packageIncludedAllowances =
        persistedAllowances.length > 0
          ? persistedAllowances
          : rebuildLegacyPackageIncludedAllowances({
              source: includedProductSource,
              items: booking.items.map((item) => ({
                productId: item.productId,
                variantId: item.variantId,
                productName: item.productName,
                unitPrice:
                  toMoney(item.includedUnitPrice) > 0
                    ? item.includedUnitPrice
                    : item.unitPrice,
              })),
            });

      const allowanceByVariantId = new Map(
        packageIncludedAllowances.map((entry) => [entry.variantId, entry])
      );

      // An included line the client never sent keeps the package default; an
      // explicit 0 is a deliberate reduction and is left alone.
      packageIncludedAllowances.forEach((allowance) => {
        const key = `${allowance.productId}:${allowance.variantId}`;
        if (effectiveItemsMap.has(key)) return;
        effectiveItemsMap.set(key, {
          productId: allowance.productId,
          variantId: allowance.variantId,
          quantity: allowance.includedQuantity,
          ledNumber: "",
        });
      });

      const effectiveItems = Array.from(effectiveItemsMap.values()).filter(
        (item) => item.quantity > 0 || allowanceByVariantId.has(item.variantId)
      );
      const variantIds = [...new Set(effectiveItems.map((item) => item.variantId))];
      const variants =
        variantIds.length > 0
          ? await tx.productVariant.findMany({
              where: {
                id: { in: variantIds },
                isActive: true,
                product: {
                  isActive: true,
                  ...(locationId
                    ? { OR: [{ locationId }, { locationId: null }] }
                    : {}),
                },
              },
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    category: true,
                  },
                },
              },
            })
          : [];

      const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
      if (variants.length !== variantIds.length) {
        throw new Error("INVALID_PRODUCT_SELECTION");
      }

      const validatedItems = effectiveItems.map((item) => {
        const variant = variantMap.get(item.variantId);
        if (!variant || variant.productId !== item.productId) {
          throw new Error("INVALID_PRODUCT_SELECTION");
        }

        const maxAllowed = getVariantMaxAllowed(variant);

        // A reduced-to-zero included line is never a stock problem, so it must
        // not trip the out-of-stock guard.
        if (item.quantity > 0 && (maxAllowed <= 0 || item.quantity > maxAllowed)) {
          throw new Error(
            `PRODUCT_LIMIT_EXCEEDED:${variant.product.name}:${maxAllowed}`
          );
        }

        const unitPrice = getDurationAdjustedUnitPrice({
          product: {
            slug: variant.product.slug,
            name: variant.product.name,
          },
          baseUnitPrice: resolveVariantBaseUnitPrice(variant),
          durationHours,
        });
        const allowance = allowanceByVariantId.get(variant.id) ?? null;
        const linePricing = priceIncludedProductLine({
          includedQuantity: allowance?.includedQuantity ?? 0,
          includedUnitPrice: allowance?.includedUnitPrice ?? 0,
          quantity: item.quantity,
          unitPrice,
        });
        return {
          productId: variant.productId,
          variantId: variant.id,
          productName: variant.product.name,
          variantLabel: variant.label,
          unitPrice,
          quantity: item.quantity,
          totalPrice: linePricing.totalPrice,
          includedQuantity: linePricing.includedQuantity,
          includedUnitPrice: linePricing.includedUnitPrice,
          adjustmentAmount: linePricing.adjustmentAmount,
          category: variant.product.category,
          ledNumber: item.ledNumber,
          productSlug: variant.product.slug,
        };
      });

      // 1 Clear existing items
      await tx.bookingItem.deleteMany({
        where: { bookingId },
      });

      // 2 Insert fresh snapshot. Reduced-to-zero included lines are persisted
      // too: the row is the record that the customer chose to take none, and
      // dropping it would let the next page load re-seed the full quantity.
      for (const item of validatedItems) {
        await tx.bookingItem.create({
          data: {
            bookingId,
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            variantLabel: item.variantLabel,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            includedQuantity: item.includedQuantity,
            includedUnitPrice: item.includedUnitPrice,
            category: item.category,
          },
        });
      }

      const ledNumbers = validatedItems
        .filter((item) =>
          isNumberDecorationProduct({
            slug: item.productSlug,
            name: item.productName,
          })
        )
        .map((item) => item.ledNumber)
        .filter((value) => value.length > 0);

      const occasionData =
        booking.occasionData &&
        typeof booking.occasionData === "object" &&
        !Array.isArray(booking.occasionData)
          ? { ...booking.occasionData }
          : {};
      delete occasionData.ledNumber;

      if (ledNumbers.length === 1) {
        occasionData.ledNumber = ledNumbers[0];
      } else if (ledNumbers.length > 1) {
        occasionData.ledNumber = ledNumbers;
      }

      // 3 Recalculate product totals
      const productsAmount = validatedItems.reduce(
        (sum, i) => centsToMoney(toCents(sum) + toCents(i.totalPrice)),
        0
      );
      // Reductions below the package allowance credit the package price.
      const packageAdjustmentAmount = validatedItems.reduce(
        (sum, i) => centsToMoney(toCents(sum) + toCents(i.adjustmentAmount)),
        0
      );

      const includedGuestCount = resolveRangePackageGuestLimit(booking.packageSnapshot);
      const guestLimit = maxGuestsForIncluded(includedGuestCount);
      const parsedRequestedGuestCount =
        requestedGuestCountRaw == null ? booking.guestCount : requestedGuestCountRaw;
      const requestedGuestCount =
        Math.max(
          includedGuestCount,
          Math.min(
            guestLimit,
            Number.isFinite(Number(parsedRequestedGuestCount))
              ? Math.trunc(Number(parsedRequestedGuestCount))
              : includedGuestCount
          )
        );
      const requestedDecorationRequired =
        requestedDecorationRequiredRaw == null
          ? booking.decorationRequired
          : requestedDecorationRequiredRaw;
      const effectiveDecorationRequired = schedule.decorationMandatory
        ? true
        : requestedDecorationRequired;
      const durationPricing = await resolveBookingDurationPricingConfig(tx);
      const packageHourlyRate =
        (booking.packageSnapshot as { hourlyRate?: number } | null)?.hourlyRate;
      const effectiveExtraHourlyRate =
        packageHourlyRate || durationPricing.extraHourlyRate;

      const rangePricing = buildRangePricingSnapshot({
        packageSnapshot: booking.packageSnapshot,
        pricingSnapshot: booking.pricingSnapshot,
        guestCount: requestedGuestCount,
        productsAmount,
        packageAdjustmentAmount,
        discountAmount: 0,
      });
      const pricingBase = rangePricing
        ? {
            baseAmount:
              rangePricing.packageAmount +
              rangePricing.extraDurationAmount,
            extrasAmount: rangePricing.extraGuestAmount,
            decorationAmount: 0,
          }
        : calculateBookingPricing({
            slotBasePrice: toMoney(schedule.basePrice),
            slotFinalPrice: toMoney(schedule.finalPrice),
            durationHours,
            includedDurationHours: durationPricing.includedDurationHours,
            extraHourlyRate: effectiveExtraHourlyRate,
            guestCount: requestedGuestCount,
            theatreBaseGuests: includedGuestCount,
            theatreExtraPersonPrice: PACKAGE_EXTRA_PERSON_PRICE,
            productsAmount: 0,
            packageAdjustmentAmount,
            discountAmount: 0,
            advancePaid: 0,
          });

      const slotAmount = pricingBase.baseAmount;
      const nonSlotAmount = centsToMoney(
        toCents(pricingBase.extrasAmount) +
          toCents(pricingBase.decorationAmount) +
          toCents(productsAmount)
      );
      const bookingTotalBeforeDiscount = centsToMoney(
        toCents(slotAmount) + toCents(nonSlotAmount)
      );
      const resolvedUserId = await resolveBookingCouponUserId(tx, {
        userId: booking.userId,
        contactPhone: booking.contactPhone,
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
        locationId: locationId ?? '',
        userId: resolvedUserId,
        contactPhone: booking.contactPhone,
        decorationRequired: effectiveDecorationRequired,
        items: validatedItems.map((item) => ({
          itemKey: item.variantId,
          productId: item.productId,
          category: item.category,
          totalPrice: toMoney(item.totalPrice),
        })),
        slotAmount,
        nonSlotAmount,
        productsTotal: productsAmount,
        extrasTotal: toMoney(booking.extrasAmount),
      });

      const advanceFloor = await getRequiredAdvancePaymentAmount(tx);
      minimumPayableForError = advanceFloor;
      const { totalDiscount } = await rebalanceReservedBookingCoupons({
        tx,
        bookingId,
        context,
        resolvedUserId,
        minimumPayable: advanceFloor,
      });
      const totalAmount = centsToMoney(
        toCents(bookingTotalBeforeDiscount) - toCents(totalDiscount)
      );
      const finalRangePricing = buildRangePricingSnapshot({
        packageSnapshot: booking.packageSnapshot,
        pricingSnapshot: booking.pricingSnapshot,
        guestCount: requestedGuestCount,
        productsAmount,
        packageAdjustmentAmount,
        discountAmount: totalDiscount,
      });

      const shouldInvalidatePaymentOrder =
        booking.bookingStatus === "AWAITING_PAYMENT" ||
        booking.bookingStatus === "PAYMENT_PROCESSING";

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          guestCount: requestedGuestCount,
          decorationRequired: effectiveDecorationRequired,
          baseAmount: pricingBase.baseAmount,
          extrasAmount: pricingBase.extrasAmount,
          decorationAmount: pricingBase.decorationAmount,
          productsAmount,
          packageAdjustmentAmount,
          discountAmount: totalDiscount,
          totalAmount,
          pricingSnapshot: finalRangePricing ?? undefined,
          remainingPayable: centsToMoney(
            Math.max(toCents(totalAmount) - toCents(booking.advancePaid), 0)
          ),
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
          occasionData:
            Object.keys(occasionData).length > 0
              ? occasionData
              : Prisma.JsonNull,
        },
      });
    });

    const appliedCoupons = await prisma.couponUsage.findMany({
      where: {
        bookingId,
        status: "RESERVED",
      },
      include: {
        coupon: {
          select: {
            id: true,
            code: true,
          },
        },
      },
      orderBy: { reservedAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      discountAmount: appliedCoupons.reduce(
        (sum, usage) =>
          centsToMoney(toCents(sum) + toCents(usage.discountAmount ?? 0)),
        0
      ),
      appliedCoupons: appliedCoupons.map((usage) => ({
        id: usage.coupon.id,
        code: getCouponDisplayCode(usage.coupon.code),
        discountAmount: toMoney(usage.discountAmount ?? 0),
        status: usage.status,
      })),
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

    if (code === "INVALID_REQUEST") {
      return bookingErrorResponse(
        400,
        code,
        "Invalid booking payload."
      );
    }
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
    if (code === "SLOT_EXPIRED") {
      return bookingErrorResponse(
        409,
        code,
        "Selected slot has expired. Please choose a slot again."
      );
    }
    if (code === "INVALID_PRODUCT_SELECTION") {
      return bookingErrorResponse(
        400,
        code,
        "One or more selected products are no longer available."
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
    if (code.startsWith("PRODUCT_LIMIT_EXCEEDED:")) {
      const [, productName, limitRaw] = code.split(":");
      const limit = Number(limitRaw ?? 0);
      return bookingErrorResponse(
        409,
        "PRODUCT_LIMIT_EXCEEDED",
        limit <= 0
          ? `${productName} is currently out of stock.`
          : `You can add up to ${limit} of ${productName} in one booking.`
      );
    }

    console.error("BOOKING_ITEMS_COMMIT_ERROR:", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to save booking items."
    );
  }
}
