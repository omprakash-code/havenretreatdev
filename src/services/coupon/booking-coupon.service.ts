import type { Prisma, ProductCategory } from "@prisma/client";

import { normalizePhone } from "@/lib/phone";
import { allocateCouponsInOrder } from "@/services/coupon/coupon-allocation";
import { buildCouponAmountsFromComponents } from "@/services/coupon/coupon-amounts";
import { evaluateCoupon } from "@/services/coupon/coupon-evaluator";
import {
  buildCouponDebugSnapshot,
  type CouponDebugSnapshot,
} from "@/services/coupon/coupon-debug";
import { isMinimumPayableSatisfied } from "@/services/coupon/coupon-minimum-payable";
import { mapPrismaRuleToDomain } from "@/services/coupon/coupon-rule.mapper";
import {
  CouponRejectionReason,
  type CouponEntity,
  type CouponEvaluationContext,
  type CouponEvaluationResult,
  type CouponItemDiscount,
  type CouponRuleEntity,
} from "@/services/coupon/coupon.types";

type TxClient = Prisma.TransactionClient;

type BookingCouponItem = {
  itemKey?: string;
  productId: string;
  category: ProductCategory;
  totalPrice: number;
};

type BuildBookingCouponContextInput = {
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
  contactPhone?: string | null;
  decorationRequired?: boolean;
  items: BookingCouponItem[];
  slotAmount: number;
  nonSlotAmount: number;
  productsTotal: number;
  extrasTotal: number;
};

type RebalanceReservedBookingCouponsInput = {
  tx: TxClient;
  bookingId: string;
  context: CouponEvaluationContext;
  resolvedUserId: string | null;
  minimumPayable: number;
};

type ReservedBookingCouponAllocation = {
  usageId: string;
  couponId: string;
  code: string;
  discountAmount: number;
  itemDiscounts?: CouponItemDiscount[];
};

type ReservedBookingCouponUsage = Prisma.CouponUsageGetPayload<{
  include: {
    coupon: {
      include: {
        rules: true;
      };
    };
  };
}>;

type ReservedBookingCouponEvaluation = {
  usageId: string;
  couponId: string;
  code: string;
  coupon: CouponEntity & { rules: CouponRuleEntity[] };
  result: CouponEvaluationResult;
  usage: {
    totalUsed: number;
    usedByUser: number;
  };
};

export type ReservedBookingCouponValidationFailure = {
  couponId: string;
  code: string;
  reason: CouponRejectionReason;
  debug: CouponDebugSnapshot;
};

export class BookingCouponMinimumPayableError extends Error {
  debug?: CouponDebugSnapshot[];

  constructor(debug?: CouponDebugSnapshot[]) {
    super("COUPON_MINIMUM_PAYABLE_NOT_MET");
    this.name = "BookingCouponMinimumPayableError";
    this.debug = debug;
  }
}

export function buildBookingCouponContext(
  input: BuildBookingCouponContextInput
): CouponEvaluationContext {
  return {
    slot: input.slot,
    theatreId: input.theatreId,
    locationId: input.locationId,
    user:
      input.userId || input.contactPhone
        ? {
            id: input.userId ?? undefined,
            phone: input.contactPhone
              ? normalizePhone(input.contactPhone)
              : undefined,
          }
        : undefined,
    booking: {
      decorationRequired: Boolean(input.decorationRequired),
    },
    items: input.items.map((item, index) => ({
      itemKey:
        typeof item.itemKey === "string" && item.itemKey.trim()
          ? item.itemKey.trim()
          : `${item.productId}:${index}`,
      productId: item.productId,
      category: item.category,
      totalPrice: item.totalPrice,
    })),
    amounts: buildCouponAmountsFromComponents({
      slotAmount: input.slotAmount,
      nonSlotAmount: input.nonSlotAmount,
      productsTotal: input.productsTotal,
      extrasTotal: input.extrasTotal,
    }),
  };
}

export async function resolveBookingCouponUserId(
  tx: TxClient,
  input: {
    userId?: string | null;
    contactPhone?: string | null;
  }
) {
  if (input.userId) return input.userId;
  if (!input.contactPhone) return null;

  const user = await tx.user.findUnique({
    where: { phone: input.contactPhone },
    select: { id: true },
  });

  return user?.id ?? null;
}

export async function rebalanceReservedBookingCoupons(
  input: RebalanceReservedBookingCouponsInput
) {
  const { tx, bookingId, context, resolvedUserId, minimumPayable } = input;
  const evaluations = await evaluateReservedBookingCoupons({
    tx,
    bookingId,
    context,
    resolvedUserId,
  });
  const validDiscounts: ReservedBookingCouponAllocation[] = [];
  const debug: CouponDebugSnapshot[] = [];

  for (const evaluation of evaluations) {
    if (!evaluation.result.valid) {
      debug.push(
        buildCouponDebugSnapshot({
          coupon: evaluation.coupon,
          context,
          result: evaluation.result,
          usage: evaluation.usage,
          outcome: "RELEASED",
          finalDiscountAmount: 0,
        })
      );
      await tx.couponUsage.update({
        where: { id: evaluation.usageId },
        data: {
          status: "RELEASED",
          discountAmount: 0,
          releasedAt: new Date(),
          confirmedAt: null,
        },
      });
      continue;
    }

    validDiscounts.push({
      usageId: evaluation.usageId,
      couponId: evaluation.couponId,
      code: evaluation.code,
      discountAmount: evaluation.result.discountAmount,
      itemDiscounts: evaluation.result.itemDiscounts,
    });
  }

  const cappedDiscounts = allocateCouponsInOrder(
    validDiscounts,
    Math.max(context.amounts.bookingTotal, 0)
  );
  const minPayableCheck = isMinimumPayableSatisfied({
    bookingTotal: context.amounts.bookingTotal,
    totalDiscount: cappedDiscounts.totalDiscount,
    minimumPayable,
  });

  if (!minPayableCheck.satisfied && cappedDiscounts.totalDiscount > 0) {
    throw new BookingCouponMinimumPayableError(
      evaluations
        .filter((evaluation) => evaluation.result.valid)
        .map((evaluation) =>
          buildCouponDebugSnapshot({
            coupon: evaluation.coupon,
            context,
            result: evaluation.result,
            usage: evaluation.usage,
            outcome: "REJECTED",
            finalDiscountAmount: 0,
            rejectionReason: CouponRejectionReason.MINIMUM_PAYABLE_VIOLATION,
          })
        )
    );
  }

  const now = new Date();
  const cappedByUsageId = new Map(
    cappedDiscounts.items.map((usage) => [usage.usageId, usage.discountAmount])
  );
  for (const usage of cappedDiscounts.items) {
    const keepReserved = usage.discountAmount > 0;
    await tx.couponUsage.update({
      where: { id: usage.usageId },
      data: {
        discountAmount: usage.discountAmount,
        status: keepReserved ? "RESERVED" : "RELEASED",
        releasedAt: keepReserved ? null : now,
        confirmedAt: null,
      },
    });
  }
  evaluations.forEach((evaluation) => {
    if (!evaluation.result.valid) return;
    const finalDiscountAmount = Math.max(
      Number(cappedByUsageId.get(evaluation.usageId) ?? 0),
      0
    );
    debug.push(
      buildCouponDebugSnapshot({
        coupon: evaluation.coupon,
        context,
        result: evaluation.result,
        usage: evaluation.usage,
        outcome: finalDiscountAmount > 0 ? "APPLIED" : "RELEASED",
        finalDiscountAmount,
      })
    );
  });

  const finalReservedUsages = await tx.couponUsage.findMany({
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

  return {
    totalDiscount: cappedDiscounts.totalDiscount,
    appliedCoupons: finalReservedUsages.map((usage) => ({
      id: usage.coupon.id,
      code: usage.coupon.code,
      discountAmount: usage.discountAmount ?? 0,
      status: usage.status,
    })),
    allocations: cappedDiscounts.items,
    debug,
  };
}

export async function findInvalidReservedBookingCoupon(input: {
  tx: TxClient;
  bookingId: string;
  context: CouponEvaluationContext;
  resolvedUserId: string | null;
}): Promise<ReservedBookingCouponValidationFailure | null> {
  const evaluations = await evaluateReservedBookingCoupons(input);
  const invalidEvaluation = evaluations.find(
    (evaluation) => !evaluation.result.valid
  );

  if (!invalidEvaluation || invalidEvaluation.result.valid) {
    return null;
  }

  return {
    couponId: invalidEvaluation.couponId,
    code: invalidEvaluation.code,
    reason: invalidEvaluation.result.reason,
    debug: buildCouponDebugSnapshot({
      coupon: invalidEvaluation.coupon,
      context: input.context,
      result: invalidEvaluation.result,
      usage: invalidEvaluation.usage,
      outcome: "REJECTED",
      finalDiscountAmount: 0,
    }),
  };
}

async function evaluateReservedBookingCoupons(input: {
  tx: TxClient;
  bookingId: string;
  context: CouponEvaluationContext;
  resolvedUserId: string | null;
}): Promise<ReservedBookingCouponEvaluation[]> {
  const reservedUsages = await loadReservedBookingCouponUsages(
    input.tx,
    input.bookingId
  );
  if (reservedUsages.length === 0) {
    return [];
  }

  const usageCounts = await loadConfirmedCouponUsageCounts(
    input.tx,
    reservedUsages.map((usage) => usage.coupon.id),
    input.resolvedUserId,
    input.context.user?.phone
  );

  return reservedUsages.map((usage) => {
    const domainCoupon = mapReservedUsageToDomainCoupon(usage);
    const usageStats = {
      totalUsed: usageCounts.totalByCouponId.get(domainCoupon.id) ?? 0,
      usedByUser: usageCounts.userByCouponId.get(domainCoupon.id) ?? 0,
    };
    return {
      usageId: usage.id,
      couponId: usage.coupon.id,
      code: usage.coupon.code,
      coupon: domainCoupon,
      result: evaluateCoupon(domainCoupon, input.context, {
        totalUsed: usageStats.totalUsed,
        usedByUser: usageStats.usedByUser,
      }),
      usage: usageStats,
    };
  });
}

async function loadReservedBookingCouponUsages(
  tx: TxClient,
  bookingId: string
) {
  return tx.couponUsage.findMany({
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
    orderBy: { reservedAt: "asc" },
  });
}

async function loadConfirmedCouponUsageCounts(
  tx: TxClient,
  couponIds: string[],
  resolvedUserId: string | null,
  contactPhone?: string | null
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
  const normalizedPhone = contactPhone ? normalizePhone(contactPhone) : null;
  const identityUsageRows =
    resolvedUserId || normalizedPhone
      ? await tx.couponUsage.findMany({
          where: {
            couponId: { in: couponIds },
            status: "CONFIRMED",
            OR: [
              ...(resolvedUserId ? [{ userId: resolvedUserId }] : []),
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

function mapReservedUsageToDomainCoupon(
  usage: ReservedBookingCouponUsage
): CouponEntity & { rules: CouponRuleEntity[] } {
  return {
    id: usage.coupon.id,
    code: usage.coupon.code,
    discountType: usage.coupon.discountType,
    discountValue: usage.coupon.discountValue,
    maxDiscount: usage.coupon.maxDiscount,
    isStackable: usage.coupon.isStackable,
    stackableCouponIds: usage.coupon.stackableCouponIds ?? [],
    validFrom: usage.coupon.validFrom,
    validTill: usage.coupon.validTill,
    scope: usage.coupon.scope,
    usageLimit: usage.coupon.usageLimit,
    perUserUsageLimit: usage.coupon.perUserUsageLimit,
    minimumAmount: usage.coupon.minimumAmount,
    locationId: usage.coupon.locationId,
    isActive: usage.coupon.isActive,
    isDeleted: usage.coupon.isDeleted,
    rules: usage.coupon.rules.map(mapPrismaRuleToDomain),
  };
}
