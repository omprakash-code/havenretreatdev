import {
  CouponEvaluationContext,
  CouponEvaluationResult,
  CouponRejectionReason,
  CouponRuleEntity,
  CouponEntity,
} from './coupon.types'
import { evaluateRule } from './coupon-rules'
import { calculateDiscount } from './coupon-discount'
import {
  buildCouponItemDiscounts,
  isEligibilityRule,
  resolveCouponBaseAmount,
} from "./coupon-targeting"
import { resolveCouponScheduleContext } from "@/services/coupon/coupon-evaluation-context"
import { formatCalendarDateKey } from "@/lib/formatters"
import { localBookingTimeToUtc } from "@/lib/booking-range"

export function evaluateCoupon(
  coupon: CouponEntity & { rules: CouponRuleEntity[] },
  ctx: CouponEvaluationContext,
  usage: {
    totalUsed: number
    usedByUser: number
  }
): CouponEvaluationResult {
  // 1. Active check
  if (!coupon.isActive || coupon.isDeleted) {
    return reject(CouponRejectionReason.COUPON_INACTIVE)
  }

  // 2. Validity window (booking time)
  const now = new Date()
  if (now < coupon.validFrom || (coupon.validTill && now > coupon.validTill)) {
    return reject(CouponRejectionReason.OUTSIDE_VALIDITY)
  }

  // 2b. Coupon must also be valid for the selected booking timing.
  const slotStartAt = getBookingStartInstant(ctx)
  if (
    slotStartAt &&
    (slotStartAt < coupon.validFrom ||
      (coupon.validTill != null && slotStartAt > coupon.validTill))
  ) {
    return reject(CouponRejectionReason.OUTSIDE_VALIDITY)
  }

  // 3. Usage limits
  if (coupon.usageLimit && usage.totalUsed >= coupon.usageLimit) {
    return reject(CouponRejectionReason.USAGE_LIMIT_EXCEEDED)
  }

  if (
    coupon.perUserUsageLimit &&
    usage.usedByUser >= coupon.perUserUsageLimit
  ) {
    return reject(CouponRejectionReason.PER_USER_LIMIT_EXCEEDED)
  }

  // 4. Location restriction (if configured)
  if (coupon.locationId && coupon.locationId !== ctx.locationId) {
    return reject(CouponRejectionReason.RULE_NOT_SATISFIED, {
      failedLocation: true,
    })
  }

  // 5. Rules (AND logic)
  for (const rule of coupon.rules.filter(isEligibilityRule)) {
    if (!evaluateRule(rule, ctx)) {
      return reject(CouponRejectionReason.RULE_NOT_SATISFIED, {
        failedRule: rule,
      })
    }
  }

  // 6. Base amount resolution
  const baseAmount = resolveCouponBaseAmount(coupon, ctx)

  // 7. Minimum amount eligibility checks (scope-based)
  if (
    coupon.minimumAmount != null &&
    coupon.minimumAmount > 0 &&
    baseAmount < coupon.minimumAmount
  ) {
    return reject(CouponRejectionReason.MINIMUM_AMOUNT_NOT_MET)
  }

  // 8. Discount
  const itemDiscounts = buildCouponItemDiscounts(coupon, ctx)
  const discountAmount =
    itemDiscounts.length > 0
      ? itemDiscounts.reduce((sum, item) => sum + item.discountAmount, 0)
      : calculateDiscount(coupon, baseAmount)

  return {
    valid: true,
    couponId: coupon.id,
    couponCode: coupon.code,
    discountAmount,
    scope: coupon.scope,
    isStackable: coupon.isStackable,
    itemDiscounts,
  }
}

function reject(
  reason: CouponRejectionReason,
  extra?: Pick<
    Extract<CouponEvaluationResult, { valid: false }>,
    "failedRule" | "failedLocation"
  >
): CouponEvaluationResult {
  return { valid: false, reason, ...extra }
}

function getBookingStartInstant(
  ctx: CouponEvaluationContext
): Date | null {
  const schedule = resolveCouponScheduleContext(ctx)
  if (schedule.startsAtUtc) return schedule.startsAtUtc

  // schedule.date is a midnight-pinned calendar date (venue-midnight for
  // range bookings, UTC-midnight in legacy rows), so key it as a calendar
  // date and interpret the start time as venue wall-clock time.
  const slotDateKey = formatCalendarDateKey(schedule.date)
  const [hours, minutes] = schedule.startTime.split(":").map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null

  const hourText = String(Math.trunc(hours)).padStart(2, "0")
  const minuteText = String(Math.trunc(minutes)).padStart(2, "0")
  const slotStart = localBookingTimeToUtc(slotDateKey, `${hourText}:${minuteText}`)
  if (Number.isNaN(slotStart.getTime())) return null
  return slotStart
}
