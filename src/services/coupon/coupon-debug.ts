import { resolveCouponBaseAmount } from "@/services/coupon/coupon-targeting";
import type {
  CouponEntity,
  CouponEvaluationContext,
  CouponEvaluationResult,
  CouponRejectionReason,
  CouponRuleEntity,
} from "@/services/coupon/coupon.types";

export type CouponDebugOutcome =
  | "VALID"
  | "APPLIED"
  | "REJECTED"
  | "RELEASED";

export type CouponDebugSnapshot = {
  couponId: string;
  code: string;
  scope: CouponEntity["scope"];
  outcome: CouponDebugOutcome;
  rejectionReason?: CouponRejectionReason;
  message?: string;
  scopeBaseAmount: number;
  bookingSubtotal: number;
  requestedDiscountAmount: number;
  finalDiscountAmount: number;
  itemDiscountCount: number;
  matchedItemKeys: string[];
  matchedProductIds: string[];
  usage: {
    totalConfirmed: number;
    confirmedByUser: number;
    usageLimit: number | null;
    perUserUsageLimit: number | null;
  };
  minimumAmount: number | null;
};

type BuildCouponDebugSnapshotInput = {
  coupon: CouponEntity & { rules: CouponRuleEntity[] };
  context: CouponEvaluationContext;
  result: CouponEvaluationResult;
  usage: {
    totalUsed: number;
    usedByUser: number;
  };
  outcome: CouponDebugOutcome;
  finalDiscountAmount?: number;
  rejectionReason?: CouponRejectionReason;
  message?: string;
};

export function buildCouponDebugSnapshot(
  input: BuildCouponDebugSnapshotInput
): CouponDebugSnapshot {
  const { coupon, context, result, usage, outcome } = input;
  const matchedItemKeys =
    result.valid ? result.itemDiscounts.map((item) => item.itemKey) : [];
  const matchedProductIds = Array.from(
    new Set(
      result.valid ? result.itemDiscounts.map((item) => item.productId) : []
    )
  );
  const requestedDiscountAmount = result.valid ? result.discountAmount : 0;

  return {
    couponId: coupon.id,
    code: coupon.code,
    scope: coupon.scope,
    outcome,
    rejectionReason:
      input.rejectionReason ?? (!result.valid ? result.reason : undefined),
    message: input.message,
    scopeBaseAmount: resolveCouponBaseAmount(coupon, context),
    bookingSubtotal: Math.max(Number(context.amounts.bookingSubtotal ?? 0), 0),
    requestedDiscountAmount,
    finalDiscountAmount: Math.max(
      Number(input.finalDiscountAmount ?? requestedDiscountAmount),
      0
    ),
    itemDiscountCount: matchedItemKeys.length,
    matchedItemKeys,
    matchedProductIds,
    usage: {
      totalConfirmed: usage.totalUsed,
      confirmedByUser: usage.usedByUser,
      usageLimit: coupon.usageLimit ?? null,
      perUserUsageLimit: coupon.perUserUsageLimit ?? null,
    },
    minimumAmount: coupon.minimumAmount ?? null,
  };
}
