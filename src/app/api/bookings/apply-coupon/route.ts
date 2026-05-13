import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { evaluateCoupon } from "@/services/coupon";
import { calculateDiscountBreakdown } from "@/services/coupon/coupon-discount";
import {
    buildMinimumPayableMessage,
} from "@/services/coupon/coupon-minimum-payable";
import { resolveCouponBaseAmount } from "@/services/coupon/coupon-targeting";
import {
    CouponEntity,
    CouponRejectionReason,
    CouponRuleEntity
} from "@/services/coupon/coupon.types";
import { buildRuleNotSatisfiedMessage } from "@/services/coupon/coupon-messages";
import { mapPrismaRuleToDomain } from '@/services/coupon/coupon-rule.mapper'
import {
    buildBookingCouponContext,
    BookingCouponMinimumPayableError,
    rebalanceReservedBookingCoupons,
    resolveBookingCouponUserId,
} from "@/services/coupon/booking-coupon.service";
import {
    buildCouponCombinationConflictMessage,
    findCouponCombinationConflict,
} from "@/services/coupon/coupon-combination";
import { getRequiredAdvancePaymentAmount } from "@/lib/advance-payment";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import { BOOKING_SESSION_EXPIRED_MODAL_MESSAGE } from "@/lib/booking-session-expiry";
import { isSlotOnlyCouponScope } from "@/lib/coupon-scope";
import { getCouponDisplayCode } from "@/lib/coupon-display";

function isEditableBookingStatus(status: string) {
    return (
        status === "INCOMPLETE" ||
        status === "AWAITING_PAYMENT" ||
        status === "PAYMENT_PROCESSING"
    );
}

export async function POST(req: Request) {
    let minimumPayableForError = 0;
    let debugTraceEnabled = false;
    let latestTrace:
        | {
            scope: CouponEntity["scope"];
            slotAmount: number;
            nonSlotAmount: number;
            bookingSubtotal: number;
            baseAmountUsed: number;
            rawDiscount: number;
            cappedDiscount: number;
            discountAfterClamp: number;
            finalDiscount: number;
            discountedTotal: number;
            minimumAdvanceRequired: number;
            payableAfterDiscount: number;
          }
        | null = null;
    let couponNotApplicableMessage: string | null = null;
    try {
        const body = await req.json();
        const { bookingId, couponCode } = body;
        debugTraceEnabled = Boolean(body?.debugTrace);
        const contactPhoneOverride =
            typeof body?.contactPhone === "string" && body.contactPhone.trim()
                ? body.contactPhone.trim()
                : null;

        if (!bookingId || !couponCode) {
            return bookingErrorResponse(
                400,
                "INVALID_REQUEST",
                "Missing booking or coupon code."
            );
        }

        const normalizedCouponCode = couponCode.trim().toUpperCase();
        const [booking, rawCoupon] = await Promise.all([
            prisma.booking.findUnique({
                where: { id: bookingId },
                include: {
                    slot: true,
                    theatre: true,
                    items: true,
                },
            }),
            prisma.coupon.findUnique({
                where: {
                    code: normalizedCouponCode,
                },
                include: { rules: true },
            }),
        ]);

        if (!booking) {
            return bookingErrorResponse(
                404,
                "BOOKING_NOT_FOUND",
                "Booking not found."
            );
        }

        if (booking.bookingStatus === "CONFIRMED") {
            return bookingErrorResponse(
                409,
                "BOOKING_FINALIZED",
                "This booking is already confirmed.",
                { bookingRef: booking.bookingRef }
            );
        }

        if (!isEditableBookingStatus(booking.bookingStatus)) {
            return bookingErrorResponse(
                409,
                "SESSION_EXPIRED",
                BOOKING_SESSION_EXPIRED_MODAL_MESSAGE
            );
        }

        if (!booking.slot || booking.slot.status !== "LOCKED") {
            return bookingErrorResponse(
                409,
                "SLOT_EXPIRED",
                "Selected slot has expired. Please choose a slot again."
            );
        }

        const resolvedUserId = await resolveBookingCouponUserId(prisma, {
            userId: booking.userId,
            contactPhone: contactPhoneOverride ?? booking.contactPhone,
        });

        /* ---------------------------------
           Fetch coupon + rules
        ---------------------------------- */
        if (!rawCoupon || !rawCoupon.isActive || rawCoupon.isDeleted) {
            return bookingErrorResponse(
                404,
                "COUPON_INVALID",
                "Invalid coupon."
            );
        }

        /* ---------------------------------
           Map Prisma → Domain Coupon
        ---------------------------------- */
        const coupon: CouponEntity & { rules: CouponRuleEntity[] } = {
            id: rawCoupon.id,
            code: rawCoupon.code,
            discountType: rawCoupon.discountType,
            discountValue: rawCoupon.discountValue,
            maxDiscount: rawCoupon.maxDiscount,
            isStackable: rawCoupon.isStackable,
            stackableCouponIds: rawCoupon.stackableCouponIds ?? [],
            validFrom: rawCoupon.validFrom,
            validTill: rawCoupon.validTill,
            scope: rawCoupon.scope,
            usageLimit: rawCoupon.usageLimit,
            perUserUsageLimit: rawCoupon.perUserUsageLimit,
            minimumAmount: rawCoupon.minimumAmount,
            locationId: rawCoupon.locationId,
            isActive: rawCoupon.isActive,
            isDeleted: rawCoupon.isDeleted,
            rules: rawCoupon.rules.map(mapPrismaRuleToDomain),
        }


        /* ---------------------------------
           Usage counts
        ---------------------------------- */
        const normalizedContactPhone = contactPhoneOverride ?? (
          booking.contactPhone?.trim()
            ? booking.contactPhone.trim()
            : null
        );
        const [totalUsed, usedByUser] = await Promise.all([
            prisma.couponUsage.count({
                where: { couponId: coupon.id, status: "CONFIRMED" },
            }),
            resolvedUserId || normalizedContactPhone
                ? prisma.couponUsage.count({
                    where: {
                        couponId: coupon.id,
                        status: "CONFIRMED",
                        OR: [
                            ...(resolvedUserId ? [{ userId: resolvedUserId }] : []),
                            ...(normalizedContactPhone
                                ? [
                                      {
                                          booking: {
                                              is: {
                                                  contactPhone: normalizedContactPhone,
                                              },
                                          },
                                      },
                                  ]
                                : []),
                        ],
                    },
                })
                : Promise.resolve(0),
        ]);

        /* ---------------------------------
           Build evaluation context
        ---------------------------------- */
        const contextItems = booking.items.map(i => ({
            itemKey: i.id,
            productId: i.productId,
            category: i.category,
            totalPrice: i.totalPrice,
        }));
        const productsTotal = contextItems.reduce(
            (sum, item) => sum + Math.max(Number(item.totalPrice ?? 0), 0),
            0
        );
        const slotAmount =
            booking.baseAmount;
        const nonSlotAmount =
            booking.extrasAmount +
            booking.decorationAmount +
            productsTotal;

        const context = buildBookingCouponContext({
            slot: {
                id: booking.slot.id,
                date: booking.slot.date,
                startTime: booking.slot.startTime,
                endTime: booking.slot.endTime,
                durationMin: booking.slot.durationMin,
            },
            theatreId: booking.theatreId,
            locationId: booking.theatre.locationId,
            userId: resolvedUserId,
            contactPhone: normalizedContactPhone,
            decorationRequired: booking.decorationRequired,
            items: contextItems,
            slotAmount,
            nonSlotAmount,
            productsTotal,
            extrasTotal: booking.extrasAmount,
        });

        const result = evaluateCoupon(coupon, context, {
            totalUsed,
            usedByUser,
        });

        const scopeBaseAmount = resolveCouponBaseAmount(coupon, context);
        const initialDiscountTrace = calculateDiscountBreakdown(
            {
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                maxDiscount: coupon.maxDiscount,
            },
            scopeBaseAmount
        );

        if (!result.valid) {
            couponNotApplicableMessage = rejectionReasonToMessage(
                result.reason,
                coupon,
                scopeBaseAmount,
                {
                    failedRule: result.failedRule,
                    failedLocation: result.failedLocation,
                }
            );
            return bookingErrorResponse(
                409,
                "COUPON_NOT_APPLICABLE",
                couponNotApplicableMessage,
                {
                    reason: result.reason,
                    severity:
                        result.reason === CouponRejectionReason.RULE_NOT_SATISFIED ||
                        result.reason === CouponRejectionReason.MINIMUM_AMOUNT_NOT_MET
                            ? "info"
                            : undefined,
                }
            );
        }

        const advanceFloor = await getRequiredAdvancePaymentAmount(prisma);
        minimumPayableForError = advanceFloor;

        /* ---------------------------------
           Reserve coupon + update booking
        ---------------------------------- */
        const { totalDiscount, appliedCoupons } = await prisma.$transaction(async tx => {
            const existingUsages = await tx.couponUsage.findMany({
                where: {
                    bookingId,
                    status: "RESERVED",
                },
                include: {
                    coupon: {
                        include: {
                            rules: true,
                        },
                    },
                },
            });
            const existingUsageForSameCoupon = existingUsages.find(
                (usage) => usage.couponId === coupon.id
            );

            const conflictingCoupon = findCouponCombinationConflict(
                coupon,
                existingUsages.map((usage) => ({
                    id: usage.coupon.id,
                    code: usage.coupon.code,
                    isStackable: usage.coupon.isStackable,
                    stackableCouponIds: usage.coupon.stackableCouponIds ?? [],
                }))
            );

            if (conflictingCoupon) {
                throw new Error(
                    `COUPON_NOT_STACKABLE:${buildCouponCombinationConflictMessage(
                        coupon,
                        conflictingCoupon
                    )}`
                );
            }

            if (existingUsageForSameCoupon?.status === "RESERVED") {
                throw new Error("COUPON_ALREADY_APPLIED");
            }

            await tx.couponUsage.upsert({
                where: {
                    couponId_bookingId: {
                        couponId: coupon.id,
                        bookingId,
                    },
                },
                update: {
                    userId: resolvedUserId ?? existingUsageForSameCoupon?.userId ?? null,
                    status: "RESERVED",
                    discountAmount: result.discountAmount,
                    reservedAt: new Date(),
                    confirmedAt: null,
                    releasedAt: null,
                },
                create: {
                    couponId: coupon.id,
                    bookingId,
                    userId: resolvedUserId,
                    status: "RESERVED",
                    discountAmount: result.discountAmount,
                },
            });

            const {
                totalDiscount,
                appliedCoupons,
                allocations,
            } = await rebalanceReservedBookingCoupons({
                tx,
                bookingId,
                context,
                resolvedUserId,
                minimumPayable: advanceFloor,
            });
            const incomingCappedDiscount =
                allocations.find((item) => item.couponId === coupon.id)?.discountAmount ??
                0;
            latestTrace = {
                scope: coupon.scope,
                slotAmount: context.amounts.slotAmount,
                nonSlotAmount: context.amounts.nonSlotAmount,
                bookingSubtotal: context.amounts.bookingSubtotal,
                baseAmountUsed: scopeBaseAmount,
                rawDiscount: initialDiscountTrace.rawDiscount,
                cappedDiscount: initialDiscountTrace.afterMaxDiscount,
                discountAfterClamp: incomingCappedDiscount,
                finalDiscount: incomingCappedDiscount,
                discountedTotal: Math.max(context.amounts.bookingTotal - totalDiscount, 0),
                minimumAdvanceRequired: advanceFloor,
                payableAfterDiscount: Math.max(context.amounts.bookingTotal - totalDiscount, 0),
            };
            if (incomingCappedDiscount <= 0) {
                couponNotApplicableMessage = buildNoDiscountMessage(
                    coupon,
                    context.amounts,
                    scopeBaseAmount
                );
                throw new Error("COUPON_NO_DISCOUNT");
            }
            const newTotal = context.amounts.bookingTotal - totalDiscount;

            await tx.booking.update({
                where: { id: bookingId },
                data: {
                    discountAmount: totalDiscount,
                    totalAmount: newTotal,
                    remainingPayable: Math.max(newTotal - booking.advancePaid, 0),
                    ...(booking.bookingStatus === "AWAITING_PAYMENT" ||
                        booking.bookingStatus === "PAYMENT_PROCESSING"
                        ? {
                            bookingStatus: "AWAITING_PAYMENT" as const,
                            paymentStatus: "INITIALIZED" as const,
                            razorpayOrderId: null,
                            razorpayPaymentId: null,
                            razorpaySignature: null,
                        }
                        : {}),
                },
            });

            return {
                totalDiscount,
                appliedCoupons,
            };
        });

        return NextResponse.json({
            success: true,
            discountAmount: totalDiscount,
            appliedCoupons: appliedCoupons.map((coupon) => ({
                ...coupon,
                code: getCouponDisplayCode(coupon.code),
            })),
            ...(debugTraceEnabled && latestTrace ? { trace: latestTrace } : {}),
        });
    } catch (err) {
        if (err instanceof Error) {
            if (err.message.startsWith("COUPON_NOT_STACKABLE")) {
                const [, message] = err.message.split(":");
                return bookingErrorResponse(
                    409,
                    "COUPON_NOT_APPLICABLE",
                    message || "Coupon cannot be combined with existing coupons.",
                    {
                        reason: "COUPON_NOT_STACKABLE",
                    }
                );
            }

            if (err.message === "COUPON_ALREADY_APPLIED") {
                return bookingErrorResponse(
                    409,
                    "COUPON_NOT_APPLICABLE",
                    "This coupon is already applied.",
                    {
                        reason: "COUPON_ALREADY_APPLIED",
                    }
                );
            }

            if (
                err.message === "COUPON_MINIMUM_PAYABLE_NOT_MET" ||
                err instanceof BookingCouponMinimumPayableError
            ) {
                return bookingErrorResponse(
                    409,
                    "COUPON_NOT_APPLICABLE",
                    buildMinimumPayableMessage(minimumPayableForError),
                    {
                        reason: CouponRejectionReason.MINIMUM_PAYABLE_VIOLATION,
                        severity: "info",
                        ...(debugTraceEnabled && latestTrace ? { trace: latestTrace } : {}),
                    }
                );
            }
            if (err.message === "COUPON_NO_DISCOUNT") {
                return bookingErrorResponse(
                    409,
                    "COUPON_NOT_APPLICABLE",
                    couponNotApplicableMessage || "This coupon is not applicable to your current selection.",
                    {
                        reason: CouponRejectionReason.RULE_NOT_SATISFIED,
                        severity: "info",
                        ...(debugTraceEnabled && latestTrace ? { trace: latestTrace } : {}),
                    }
                );
            }
        }

        console.error("[APPLY COUPON]", err);

        return bookingErrorResponse(
            500,
            "INTERNAL_ERROR",
            "Failed to apply coupon."
        );
    }
}

function rejectionReasonToMessage(
    reason: CouponRejectionReason,
    coupon?: Pick<
        CouponEntity,
        "scope" | "minimumAmount"
    > & {
        rules?: CouponRuleEntity[];
    },
    baseAmount = 0,
    failure?: {
        failedRule?: CouponRuleEntity;
        failedLocation?: boolean;
    }
): string {
    switch (reason) {
        case CouponRejectionReason.COUPON_INACTIVE:
            return "This coupon is inactive.";
        case CouponRejectionReason.OUTSIDE_VALIDITY:
            return "Coupon is expired or not active yet.";
        case CouponRejectionReason.USAGE_LIMIT_EXCEEDED:
            return "This coupon has reached its usage limit.";
        case CouponRejectionReason.PER_USER_LIMIT_EXCEEDED:
            return "You’ve reached the usage limit for this coupon.";
        case CouponRejectionReason.RULE_NOT_SATISFIED:
            return buildRuleNotSatisfiedMessage(coupon, failure);
        case CouponRejectionReason.MINIMUM_AMOUNT_NOT_MET: {
            return (
                buildMinimumAmountMessage(coupon, baseAmount) ||
                "Minimum amount condition for this coupon is not met."
            );
        }
        case CouponRejectionReason.MINIMUM_PAYABLE_VIOLATION:
            return "This coupon cannot be applied because minimum payable requirement is not met.";
        default:
            return "Coupon is not applicable.";
    }
}

function buildNoDiscountMessage(
    coupon: Pick<CouponEntity, "scope" | "minimumAmount">,
    amounts: {
        slotAmount?: number;
        nonSlotAmount?: number;
        bookingSubtotal?: number;
        productsTotal?: number;
    },
    baseAmount: number
) {
    const minimumMessage = buildMinimumAmountMessage(coupon, baseAmount);
    if (minimumMessage) {
        return minimumMessage;
    }

    if (coupon.scope === "PRODUCTS_ONLY" && (amounts.productsTotal ?? 0) <= 0) {
        return "Add at least one product to use this coupon.";
    }

    if (isSlotOnlyCouponScope(coupon.scope) && (amounts.slotAmount ?? 0) <= 0) {
        return "Select a slot to use this coupon.";
    }

    return "This coupon is not applicable to your current selection.";
}

function buildMinimumAmountMessage(
    coupon: Pick<CouponEntity, "scope" | "minimumAmount"> | undefined,
    baseAmount: number
) {
    const minimumAmount = Math.max(Number(coupon?.minimumAmount ?? 0), 0);
    if (minimumAmount <= 0) return "";

    const shortfall = Math.max(minimumAmount - Math.max(baseAmount, 0), 0);
    if (shortfall <= 0) return "";

    if (coupon?.scope === "PRODUCTS_ONLY") {
        return `Add products worth at least ₹${shortfall} more to use this coupon.`;
    }

    if (isSlotOnlyCouponScope(coupon?.scope)) {
        return `Choose a slot with at least ₹${shortfall} more value to use this coupon.`;
    }

    return `Add at least ₹${shortfall} more to your booking to use this coupon.`;
}
