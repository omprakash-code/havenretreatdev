import { Prisma, type ProductCategory } from "@prisma/client";
import { evaluateCoupon } from "@/services/coupon";
import { mapPrismaRuleToDomain } from "@/services/coupon/coupon-rule.mapper";
import { allocateCouponsInOrder } from "@/services/coupon/coupon-allocation";
import {
  buildMinimumPayableMessage,
  isMinimumPayableSatisfied,
} from "@/services/coupon/coupon-minimum-payable";
import { resolveCouponBaseAmount } from "@/services/coupon/coupon-targeting";
import {
  CouponEntity,
  CouponItemDiscount,
  CouponRejectionReason,
  CouponRuleEntity,
} from "@/services/coupon/coupon.types";
import {
  buildCouponDebugSnapshot,
  type CouponDebugSnapshot,
} from "@/services/coupon/coupon-debug";
import { buildRuleNotSatisfiedMessage } from "@/services/coupon/coupon-messages";
import {
  buildCouponCombinationConflictMessage,
  findCouponCombinationPairConflict,
} from "@/services/coupon/coupon-combination";
import { AdminBookingApiError } from "@/app/api/admin/bookings/_shared";
import {
  buildBookingCouponContext,
  resolveBookingCouponUserId,
} from "@/services/coupon/booking-coupon.service";
import { isSlotOnlyCouponScope } from "@/lib/coupon-scope";
import { isArchivedDeletedCouponCode } from "@/lib/coupon-display";
import { normalizePhone } from "@/lib/phone";

type CouponContextItem = {
  itemKey?: string;
  productId: string;
  category: ProductCategory;
  totalPrice: number;
};

type EvaluateAdminCouponInput = {
  couponCode?: string | null;
  couponCodes?: string[] | null;
  slot: {
    id: string;
    date: Date;
    startTime: string;
    endTime: string;
    durationMin: number;
  };
  theatreId: string;
  locationId: string;
  userId?: string | null;
  userPhone?: string | null;
  decorationRequired?: boolean;
  items: CouponContextItem[];
  bookingSubtotal: number;
  slotAmount: number;
  nonSlotAmount: number;
  productsTotal: number;
  extrasTotal: number;
  advanceFloor: number;
};

export type EvaluatedAdminCoupon = {
  couponId: string;
  code: string;
  discountAmount: number;
  itemDiscounts?: CouponItemDiscount[];
};

export type EvaluatedAdminCoupons = {
  totalDiscount: number;
  coupons: EvaluatedAdminCoupon[];
  debug: CouponDebugSnapshot[];
};

type PersistAdminBookingCouponsInput = {
  tx: Prisma.TransactionClient;
  bookingId: string;
  userId: string | null;
  coupons: EvaluatedAdminCoupon[];
  status: "RESERVED" | "CONFIRMED";
  now: Date;
  mode: "create" | "replace";
};

export type AdminCouponPreviewResult =
  | {
      valid: false;
      reason: CouponRejectionReason;
      message: string;
      bookingTotal: number;
      debug: CouponDebugSnapshot;
    }
  | {
      valid: true;
      scope: CouponEntity["scope"];
      bookingTotal: number;
      discountAmount: number;
      finalPayable: number;
      debug: CouponDebugSnapshot;
    };

export function couponRejectionReasonToMessage(
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
) {
  switch (reason) {
    case CouponRejectionReason.COUPON_INACTIVE:
      return "This coupon is disabled.";
    case CouponRejectionReason.OUTSIDE_VALIDITY:
      return "This coupon is expired or not active yet.";
    case CouponRejectionReason.USAGE_LIMIT_EXCEEDED:
      return "This coupon has reached its usage limit.";
    case CouponRejectionReason.PER_USER_LIMIT_EXCEEDED:
      return "You’ve reached the usage limit for this coupon.";
    case CouponRejectionReason.RULE_NOT_SATISFIED:
      return buildRuleNotSatisfiedMessage(coupon, failure);
    case CouponRejectionReason.MINIMUM_AMOUNT_NOT_MET: {
      return (
        buildMinimumAmountShortfallMessage(coupon, baseAmount) ||
        "Minimum amount condition for this coupon is not met."
      );
    }
    case CouponRejectionReason.MINIMUM_PAYABLE_VIOLATION:
      return "Minimum payable requirement is not met for this coupon.";
    default:
      return "Coupon is not applicable.";
  }
}

function buildMinimumAmountShortfallMessage(
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

function buildZeroDiscountMessage(
  coupon: Pick<CouponEntity, "scope" | "minimumAmount">,
  baseAmount: number
) {
  const minimumMessage = buildMinimumAmountShortfallMessage(coupon, baseAmount);
  if (minimumMessage) return minimumMessage;

  if (coupon.scope === "PRODUCTS_ONLY") {
    return "Add at least one product to use this coupon.";
  }
  if (isSlotOnlyCouponScope(coupon.scope)) {
    return "Select a slot to use this coupon.";
  }
  return "This coupon is not applicable to your current selection.";
}

export async function evaluateAdminCoupon(
  tx: Prisma.TransactionClient,
  input: EvaluateAdminCouponInput
): Promise<EvaluatedAdminCoupon | null> {
  const result = await evaluateAdminCoupons(tx, {
    ...input,
    couponCodes: [input.couponCode ?? ""],
  });
  return result.coupons[0] ?? null;
}

function normalizeCouponCodes(codes: string[]) {
  const deduped: string[] = [];
  const seen = new Set<string>();

  codes.forEach((code) => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    deduped.push(normalized);
  });

  return deduped;
}

export async function previewAdminCoupon(
  tx: Prisma.TransactionClient,
  input: EvaluateAdminCouponInput & {
    rawCoupon: Prisma.CouponGetPayload<{
      include: {
        rules: true;
      };
    }>;
  }
): Promise<AdminCouponPreviewResult> {
  const resolvedUserId = await resolveBookingCouponUserId(tx, {
    userId: input.userId,
    contactPhone: input.userPhone,
  });
  const context = buildBookingCouponContext({
    slot: input.slot,
    theatreId: input.theatreId,
    locationId: input.locationId,
    userId: resolvedUserId,
    contactPhone: input.userPhone,
    decorationRequired: input.decorationRequired,
    items: input.items,
    slotAmount: input.slotAmount,
    nonSlotAmount: input.nonSlotAmount,
    productsTotal: input.productsTotal,
    extrasTotal: input.extrasTotal,
  });
  const usageCounts = await loadAdminCouponUsageCounts(
    tx,
    [input.rawCoupon.id],
    resolvedUserId,
    input.userPhone
  );
  const coupon = mapRawCouponToDomain(input.rawCoupon);
  const result = evaluateCoupon(coupon, context, {
    totalUsed: usageCounts.totalByCouponId.get(coupon.id) ?? 0,
    usedByUser: usageCounts.userByCouponId.get(coupon.id) ?? 0,
  });
  const couponUsage = {
    totalUsed: usageCounts.totalByCouponId.get(coupon.id) ?? 0,
    usedByUser: usageCounts.userByCouponId.get(coupon.id) ?? 0,
  };
  const bookingTotal = Math.max(context.amounts.bookingSubtotal, 0);

  if (!result.valid) {
    const scopeBaseAmount = resolveCouponBaseAmount(coupon, context);
    const message = couponRejectionReasonToMessage(
      result.reason,
      coupon,
      scopeBaseAmount,
      {
        failedRule: result.failedRule,
        failedLocation: result.failedLocation,
      }
    );
    return {
      valid: false,
      reason: result.reason,
      message,
      bookingTotal,
      debug: buildCouponDebugSnapshot({
        coupon,
        context,
        result,
        usage: couponUsage,
        outcome: "REJECTED",
        finalDiscountAmount: 0,
        message,
      }),
    };
  }

  const cappedDiscountAmount = Math.min(result.discountAmount, bookingTotal);
  const minPayableCheck = isMinimumPayableSatisfied({
    bookingTotal,
    totalDiscount: cappedDiscountAmount,
    minimumPayable: input.advanceFloor,
  });

  if (!minPayableCheck.satisfied && cappedDiscountAmount > 0) {
    const message = buildMinimumPayableMessage(input.advanceFloor);
    return {
      valid: false,
      reason: CouponRejectionReason.MINIMUM_PAYABLE_VIOLATION,
      message,
      bookingTotal,
      debug: buildCouponDebugSnapshot({
        coupon,
        context,
        result,
        usage: couponUsage,
        outcome: "REJECTED",
        finalDiscountAmount: 0,
        rejectionReason: CouponRejectionReason.MINIMUM_PAYABLE_VIOLATION,
        message,
      }),
    };
  }

  return {
    valid: true,
    scope: result.scope,
    bookingTotal,
    discountAmount: cappedDiscountAmount,
    finalPayable: bookingTotal - cappedDiscountAmount,
    debug: buildCouponDebugSnapshot({
      coupon,
      context,
      result,
      usage: couponUsage,
      outcome: "APPLIED",
      finalDiscountAmount: cappedDiscountAmount,
    }),
  };
}

export async function evaluateAdminCoupons(
  tx: Prisma.TransactionClient,
  input: EvaluateAdminCouponInput
): Promise<EvaluatedAdminCoupons> {
  const providedCodes = Array.isArray(input.couponCodes)
    ? input.couponCodes
    : input.couponCode
    ? [input.couponCode]
    : [];

  const normalizedCodes = normalizeCouponCodes(providedCodes);
  if (normalizedCodes.length === 0) {
    return { totalDiscount: 0, coupons: [], debug: [] };
  }

  if (providedCodes.length !== normalizedCodes.length) {
    throw new AdminBookingApiError(
      409,
      "COUPON_NOT_APPLICABLE",
      "This coupon is already applied."
    );
  }

  const rawCoupons = await tx.coupon.findMany({
    where: {
      code: { in: normalizedCodes },
      isActive: true,
      isDeleted: false,
    },
    include: {
      rules: true,
    },
  });

  const rawCouponByCode = new Map(rawCoupons.map((coupon) => [coupon.code, coupon]));
  const missingCode = normalizedCodes.find((code) => !rawCouponByCode.has(code));
  if (missingCode) {
    throw new AdminBookingApiError(
      400,
      "COUPON_NOT_APPLICABLE",
      isArchivedDeletedCouponCode(missingCode)
        ? "This coupon is no longer available."
        : "Invalid coupon code."
    );
  }

  return evaluateResolvedAdminCoupons(tx, {
    rawCoupons,
    normalizedCodes,
    input,
  });
}

async function evaluateResolvedAdminCoupons(
  tx: Prisma.TransactionClient,
  params: {
    rawCoupons: Array<
      Prisma.CouponGetPayload<{
        include: {
          rules: true;
        };
      }>
    >;
    normalizedCodes: string[];
    input: EvaluateAdminCouponInput;
  }
): Promise<EvaluatedAdminCoupons> {
  const { rawCoupons, normalizedCodes, input } = params;
  const rawCouponByCode = new Map(rawCoupons.map((coupon) => [coupon.code, coupon]));
  const resolvedUserId = await resolveBookingCouponUserId(tx, {
    userId: input.userId,
    contactPhone: input.userPhone,
  });
  const evaluated: Array<
    EvaluatedAdminCoupon & {
      isStackable: boolean;
      stackableCouponIds: string[];
    }
  > = [];
  const debugSnapshots: CouponDebugSnapshot[] = [];
  const context = buildBookingCouponContext({
    slot: input.slot,
    theatreId: input.theatreId,
    locationId: input.locationId,
    userId: resolvedUserId,
    contactPhone: input.userPhone,
    decorationRequired: input.decorationRequired,
    items: input.items,
    slotAmount: input.slotAmount,
    nonSlotAmount: input.nonSlotAmount,
    productsTotal: input.productsTotal,
    extrasTotal: input.extrasTotal,
  });
  const amountSnapshot = context.amounts;
  const usageCounts = await loadAdminCouponUsageCounts(
    tx,
    rawCoupons.map((coupon) => coupon.id),
    resolvedUserId,
    input.userPhone
  );

  for (const code of normalizedCodes) {
    const rawCoupon = rawCouponByCode.get(code)!;
    const coupon = mapRawCouponToDomain(rawCoupon);

    const result = evaluateCoupon(
      coupon,
      context,
      {
        totalUsed: usageCounts.totalByCouponId.get(coupon.id) ?? 0,
        usedByUser: usageCounts.userByCouponId.get(coupon.id) ?? 0,
      }
    );
    const couponUsage = {
      totalUsed: usageCounts.totalByCouponId.get(coupon.id) ?? 0,
      usedByUser: usageCounts.userByCouponId.get(coupon.id) ?? 0,
    };
    const scopeBaseAmount = resolveCouponBaseAmount(coupon, context);

    if (!result.valid) {
      const message = couponRejectionReasonToMessage(
        result.reason,
        coupon,
        scopeBaseAmount,
        {
          failedRule: result.failedRule,
          failedLocation: result.failedLocation,
        }
      );
      throw new AdminBookingApiError(
        409,
        "COUPON_NOT_APPLICABLE",
        message,
        {
          couponDebug: [
            buildCouponDebugSnapshot({
              coupon,
              context,
              result,
              usage: couponUsage,
              outcome: "REJECTED",
              finalDiscountAmount: 0,
              message,
            }),
          ],
        }
      );
    }

    if (result.discountAmount <= 0) {
      const message = buildZeroDiscountMessage(
        coupon,
        scopeBaseAmount
      );
      throw new AdminBookingApiError(
        409,
        "COUPON_NOT_APPLICABLE",
        message,
        {
          couponDebug: [
            buildCouponDebugSnapshot({
              coupon,
              context,
              result,
              usage: couponUsage,
              outcome: "REJECTED",
              finalDiscountAmount: 0,
              message,
            }),
          ],
        }
      );
    }

    debugSnapshots.push(
      buildCouponDebugSnapshot({
        coupon,
        context,
        result,
        usage: couponUsage,
        outcome: "VALID",
      })
    );
    evaluated.push({
      couponId: coupon.id,
      code: coupon.code,
      discountAmount: result.discountAmount,
      itemDiscounts: result.itemDiscounts,
      isStackable: coupon.isStackable,
      stackableCouponIds: coupon.stackableCouponIds,
    });
  }

  if (evaluated.length > 1) {
    const combinationConflict = findCouponCombinationPairConflict(
      evaluated.map((coupon) => ({
        id: coupon.couponId,
        code: coupon.code,
        isStackable: coupon.isStackable,
        stackableCouponIds: coupon.stackableCouponIds,
      }))
    );

    if (combinationConflict) {
      const message = buildCouponCombinationConflictMessage(
        combinationConflict.coupon,
        combinationConflict.otherCoupon
      );
      throw new AdminBookingApiError(409, "COUPON_NOT_APPLICABLE", message);
    }
  }

  if (
    evaluated.length > 1 &&
    evaluated.some((coupon) => !coupon.isStackable)
  ) {
    throw new AdminBookingApiError(
      409,
      "COUPON_NOT_APPLICABLE",
      "This coupon cannot be used together with other coupons."
    );
  }

  const maxDiscountAllowed = Math.max(amountSnapshot.bookingSubtotal, 0);
  const capped = allocateCouponsInOrder(evaluated, maxDiscountAllowed);
  const minPayableCheck = isMinimumPayableSatisfied({
    bookingTotal: amountSnapshot.bookingSubtotal,
    totalDiscount: capped.totalDiscount,
    minimumPayable: input.advanceFloor,
  });
  if (!minPayableCheck.satisfied && capped.totalDiscount > 0) {
    const message = buildMinimumPayableMessage(input.advanceFloor);
    throw new AdminBookingApiError(
      409,
      "COUPON_NOT_APPLICABLE",
      message,
      {
        couponDebug: debugSnapshots.map((snapshot) => ({
          ...snapshot,
          outcome: "REJECTED" as const,
          finalDiscountAmount: 0,
          rejectionReason: CouponRejectionReason.MINIMUM_PAYABLE_VIOLATION,
          message,
        })),
      }
    );
  }
  const coupons = capped.items
    .filter((coupon) => coupon.discountAmount > 0)
    .map((coupon) => ({
      couponId: coupon.couponId,
      code: coupon.code,
      discountAmount: coupon.discountAmount,
    }));
  const allocationByCouponId = new Map(
    capped.items.map((coupon) => [coupon.couponId, coupon.discountAmount])
  );
  const finalDebug: CouponDebugSnapshot[] = debugSnapshots.map((snapshot) => {
    const finalDiscountAmount = Math.max(
      Number(allocationByCouponId.get(snapshot.couponId) ?? 0),
      0
    );

    return {
      ...snapshot,
      outcome: finalDiscountAmount > 0 ? "APPLIED" : "RELEASED",
      finalDiscountAmount,
    };
  });

  return {
    totalDiscount: coupons.reduce((sum, coupon) => sum + coupon.discountAmount, 0),
    coupons,
    debug: finalDebug,
  };
}

export async function persistAdminBookingCoupons(
  input: PersistAdminBookingCouponsInput
) {
  const { tx, bookingId, userId, coupons, status, now, mode } = input;

  if (mode === "replace") {
    await tx.couponUsage.updateMany({
      where: {
        bookingId,
        status: {
          in: ["RESERVED", "CONFIRMED"],
        },
      },
      data: {
        status: "RELEASED",
        releasedAt: now,
        confirmedAt: null,
      },
    });
  }

  if (coupons.length === 0) return;

  const couponIds = coupons.map((coupon) => coupon.couponId);

  if (userId && status === "RESERVED") {
    await tx.couponUsage.updateMany({
      where: {
        ...(mode === "replace"
          ? {
              bookingId: {
                not: bookingId,
              },
            }
          : {}),
        couponId: { in: couponIds },
        userId,
        status: "RESERVED",
      },
      data: {
        status: "RELEASED",
        releasedAt: now,
        confirmedAt: null,
      },
    });
  }

  if (mode === "create") {
    await tx.couponUsage.createMany({
      data: coupons.map((coupon) => ({
        couponId: coupon.couponId,
        bookingId,
        userId,
        status,
        discountAmount: coupon.discountAmount,
        confirmedAt: status === "CONFIRMED" ? now : null,
      })),
    });
    return;
  }

  for (const coupon of coupons) {
    await tx.couponUsage.upsert({
      where: {
        couponId_bookingId: {
          couponId: coupon.couponId,
          bookingId,
        },
      },
      update: {
        userId,
        status,
        discountAmount: coupon.discountAmount,
        reservedAt: now,
        confirmedAt: status === "CONFIRMED" ? now : null,
        releasedAt: null,
      },
      create: {
        couponId: coupon.couponId,
        bookingId,
        userId,
        status,
        discountAmount: coupon.discountAmount,
        confirmedAt: status === "CONFIRMED" ? now : null,
      },
    });
  }
}

function mapRawCouponToDomain(
  rawCoupon: Prisma.CouponGetPayload<{
    include: {
      rules: true;
    };
  }>
): CouponEntity & { rules: CouponRuleEntity[] } {
  return {
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
  };
}

async function loadAdminCouponUsageCounts(
  tx: Prisma.TransactionClient,
  couponIds: string[],
  userId: string | null,
  userPhone?: string | null
) {
  if (couponIds.length === 0) {
    return {
      totalByCouponId: new Map<string, number>(),
      userByCouponId: new Map<string, number>(),
    };
  }

  const totalUsageCounts = await tx.couponUsage.groupBy({
    by: ["couponId"],
    where: {
      couponId: { in: couponIds },
      status: "CONFIRMED",
    },
    _count: {
      _all: true,
    },
  });
  const normalizedPhone = userPhone ? normalizePhone(userPhone) : null;
  const identityUsageRows =
    userId || normalizedPhone
      ? await tx.couponUsage.findMany({
          where: {
            couponId: { in: couponIds },
            status: "CONFIRMED",
            OR: [
              ...(userId ? [{ userId }] : []),
              ...(normalizedPhone
                ? [
                    {
                      booking: {
                        is: {
                          contactPhone: normalizedPhone,
                        },
                      },
                    },
                  ]
                : []),
            ],
          },
          select: {
            couponId: true,
          },
        })
      : [];
  const userByCouponId = new Map<string, number>();
  identityUsageRows.forEach((row) => {
    userByCouponId.set(row.couponId, (userByCouponId.get(row.couponId) ?? 0) + 1);
  });

  return {
    totalByCouponId: new Map(
      totalUsageCounts.map((row) => [row.couponId, row._count._all])
    ),
    userByCouponId,
  };
}
