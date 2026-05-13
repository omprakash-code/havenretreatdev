// src/services/coupon/coupon.types.ts
import type { CouponScopeDb } from "@/lib/coupon-scope";

/* ======================================================
   Core Evaluation Context (runtime booking snapshot)
====================================================== */

export type CouponEvaluationContext = {
  slot: {
    id: string
    date: Date              // Slot date (Timestamptz, IST-safe)
    startTime: string       // "22:00"
    endTime: string         // "02:00"
    durationMin: number
  }

  theatreId: string
  locationId: string

  user?: {
    id?: string
    phone?: string
  }

  booking?: {
    decorationRequired?: boolean
  }

  items: Array<{
    itemKey?: string
    productId: string
    category: 'CAKE' | 'DECORATION' | 'GIFT'
    totalPrice: number
  }>

  amounts: {
    bookingSubtotal: number
    bookingTotal: number
    slotAmount: number
    slotTotal: number
    nonSlotAmount: number
    productsTotal: number
    extrasTotal: number
  }
}

/* ======================================================
   Coupon Domain Entity
====================================================== */

export type CouponEntity = {
  id: string
  code: string

  discountType: 'FLAT' | 'PERCENTAGE'
  discountValue: number
  maxDiscount?: number | null

  isStackable: boolean
  stackableCouponIds: string[]

  validFrom: Date
  validTill: Date | null

  // Stored DB scope. Slot-only discounts are persisted as EXTRAS_ONLY.
  scope: CouponScopeDb

  usageLimit?: number | null
  perUserUsageLimit?: number | null
  minimumAmount?: number | null

  locationId?: string | null

  isActive: boolean
  isDeleted: boolean
}

/* ======================================================
   Coupon Rule Types (NO any — STRICT)
====================================================== */

export type CouponRuleValue =
  | {
      type: 'SLOT_DATE_RANGE'
      value: { from: string; to: string }
    }
  | {
      type: 'SLOT_TIME_RANGE'
      value: { start: string; end: string }
    }
  | {
      type: 'SLOT_DURATION_MIN'
      value: string[] | string
    }
  | {
      type: 'SLOT_ID'
      value: string[] | string
    }
  | {
      type: 'THEATRE_ID'
      value: string[] | string
    }
  | {
      type: 'CATEGORY'
      value: Array<'CAKE' | 'DECORATION' | 'GIFT'> | 'CAKE' | 'DECORATION' | 'GIFT'
    }
  | {
      type: 'PRODUCT_ID'
      value: string[] | string
    }
  | {
      type: 'USER_ID'
      value: string[] | string
    }
  | {
      type: 'TARGET_CATEGORY'
      value:
        | Array<'CAKE' | 'DECORATION' | 'GIFT'>
        | 'CAKE'
        | 'DECORATION'
        | 'GIFT'
    }
  | {
      type: 'TARGET_PRODUCT_ID'
      value: string[] | string
    }
  | {
      type: 'DECORATION_REQUIRED'
      value: boolean
    }

export type CouponRuleEntity = {
  id: string
  couponId: string
  operator: 'IN' | 'NOT_IN' | 'BETWEEN' | 'EQUALS'
} & CouponRuleValue

export type CouponItemDiscount = {
  itemKey: string
  productId: string
  category: 'CAKE' | 'DECORATION' | 'GIFT'
  discountAmount: number
}

/* ======================================================
   Evaluation Result
====================================================== */

export type CouponEvaluationResult =
  | {
      valid: true
      couponId: string
      couponCode: string
      discountAmount: number
      scope: CouponScopeDb
      isStackable: boolean
      itemDiscounts: CouponItemDiscount[]
    }
  | {
      valid: false
      reason: CouponRejectionReason
      failedRule?: CouponRuleEntity
      failedLocation?: boolean
    }

/* ======================================================
   Rejection Reasons
====================================================== */

export enum CouponRejectionReason {
  COUPON_INACTIVE = 'COUPON_INACTIVE',
  OUTSIDE_VALIDITY = 'OUTSIDE_VALIDITY',
  USAGE_LIMIT_EXCEEDED = 'USAGE_LIMIT_EXCEEDED',
  PER_USER_LIMIT_EXCEEDED = 'PER_USER_LIMIT_EXCEEDED',
  RULE_NOT_SATISFIED = 'RULE_NOT_SATISFIED',
  MINIMUM_AMOUNT_NOT_MET = 'MINIMUM_AMOUNT_NOT_MET',
  MINIMUM_PAYABLE_VIOLATION = 'MINIMUM_PAYABLE_VIOLATION',
}
