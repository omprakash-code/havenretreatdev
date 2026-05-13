// src/services/coupon/coupon-stack.ts

import { CouponEvaluationResult } from './coupon.types'

export function resolveStackableCoupons(
  results: CouponEvaluationResult[]
): CouponEvaluationResult[] {
  const valid = results.filter(
    r => r.valid
  ) as Extract<CouponEvaluationResult, { valid: true }>[]

  const nonStackable = valid.find(c => !c.isStackable)
  if (nonStackable) {
    return [nonStackable]
  }

  return valid
}
