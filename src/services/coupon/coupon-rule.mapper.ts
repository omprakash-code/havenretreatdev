import { Prisma, CouponRuleType, RuleOperator } from '@prisma/client'
import { CouponRuleEntity } from './coupon.types'

type PrismaCouponRule = {
  id: string
  couponId: string
  type: CouponRuleType
  operator: RuleOperator
  value: Prisma.JsonValue
}

export function mapPrismaRuleToDomain(
  rule: PrismaCouponRule
): CouponRuleEntity {
  switch (rule.type) {
    case 'SLOT_DATE_RANGE': {
      const value = rule.value as { from: string; to: string }

      return {
        id: rule.id,
        couponId: rule.couponId,
        operator: rule.operator,
        type: 'SLOT_DATE_RANGE',
        value,
      }
    }

    case 'SLOT_TIME_RANGE': {
      const value = rule.value as { start: string; end: string }

      return {
        id: rule.id,
        couponId: rule.couponId,
        operator: rule.operator,
        type: 'SLOT_TIME_RANGE',
        value,
      }
    }

    case 'SLOT_DURATION_MIN': {
      const value = rule.value as string[]

      return {
        id: rule.id,
        couponId: rule.couponId,
        operator: rule.operator,
        type: 'SLOT_DURATION_MIN',
        value,
      }
    }

    case 'SLOT_ID': {
      const value = rule.value as string[]

      return {
        id: rule.id,
        couponId: rule.couponId,
        operator: rule.operator,
        type: 'SLOT_ID',
        value,
      }
    }

    case 'THEATRE_ID': {
      const value = rule.value as string[]

      return {
        id: rule.id,
        couponId: rule.couponId,
        operator: rule.operator,
        type: 'THEATRE_ID',
        value,
      }
    }

    case 'CATEGORY': {
      const value = rule.value as Array<
        'CAKE' | 'DECORATION' | 'GIFT'
      >

      return {
        id: rule.id,
        couponId: rule.couponId,
        operator: rule.operator,
        type: 'CATEGORY',
        value,
      }
    }

    case 'PRODUCT_ID': {
      const value = rule.value as string[]

      return {
        id: rule.id,
        couponId: rule.couponId,
        operator: rule.operator,
        type: 'PRODUCT_ID',
        value,
      }
    }

    case 'USER_ID': {
      const value = rule.value as string[]

      return {
        id: rule.id,
        couponId: rule.couponId,
        operator: rule.operator,
        type: 'USER_ID',
        value,
      }
    }

    case 'TARGET_CATEGORY': {
      const value = rule.value as Array<
        'CAKE' | 'DECORATION' | 'GIFT'
      >

      return {
        id: rule.id,
        couponId: rule.couponId,
        operator: rule.operator,
        type: 'TARGET_CATEGORY',
        value,
      }
    }

    case 'TARGET_PRODUCT_ID': {
      const value = rule.value as string[]

      return {
        id: rule.id,
        couponId: rule.couponId,
        operator: rule.operator,
        type: 'TARGET_PRODUCT_ID',
        value,
      }
    }

    case 'DECORATION_REQUIRED': {
      const value =
        typeof rule.value === "boolean"
          ? rule.value
          : String(rule.value).trim().toLowerCase() === "true"

      return {
        id: rule.id,
        couponId: rule.couponId,
        operator: rule.operator,
        type: 'DECORATION_REQUIRED',
        value,
      }
    }

    default: {
      const _exhaustive: never = rule.type
      throw new Error(`Unsupported coupon rule type: ${_exhaustive}`)
    }
  }
}
