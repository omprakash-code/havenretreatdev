// src/services/coupon/coupon-rules.ts

import { formatInTimeZone } from "date-fns-tz"
import { isValidPhone, normalizePhone } from "@/lib/phone"
import {
  CouponEvaluationContext,
  CouponRuleEntity,
} from './coupon.types'

const IST_TIMEZONE = "Asia/Kolkata"
const PHONE_LIKE_PATTERN = /^\+?[\d\s()-]+$/

export function evaluateRule(
  rule: CouponRuleEntity,
  ctx: CouponEvaluationContext
): boolean {
  switch (rule.type) {
    case 'SLOT_DATE_RANGE': {
      const inRange = isDateInRange(ctx.slot.date, rule.value)
      return resolveRangeOperator(rule.operator, inRange)
    }

    case 'SLOT_TIME_RANGE': {
      const fitsWithinRange = doesSlotFitTimeRange(
        ctx.slot.startTime,
        ctx.slot.endTime,
        rule.value
      )
      return resolveRangeOperator(rule.operator, fitsWithinRange)
    }

    case 'SLOT_DURATION_MIN':
      return evaluateValueOperator(
        rule.operator,
        String(ctx.slot.durationMin),
        toStringList(rule.value)
      )

    case 'SLOT_ID':
      return evaluateValueOperator(
        rule.operator,
        ctx.slot.id,
        toStringList(rule.value)
      )

    case 'THEATRE_ID':
      return evaluateValueOperator(
        rule.operator,
        ctx.theatreId,
        toStringList(rule.value)
      )

    case 'CATEGORY': {
      const categories = ctx.items.map((item) => item.category)
      return evaluateCollectionOperator(
        rule.operator,
        categories,
        toStringList(rule.value)
      )
    }

    case 'PRODUCT_ID': {
      const productIds = ctx.items.map((item) => item.productId)
      return evaluateCollectionOperator(
        rule.operator,
        productIds,
        toStringList(rule.value)
      )
    }

    case 'USER_ID': {
      if (!ctx.user) return false
      const ruleValues = toStringList(rule.value)
      const normalizedRulePhones = ruleValues
        .filter((entry) => PHONE_LIKE_PATTERN.test(entry))
        .map((entry) => normalizePhone(entry))
        .filter((entry) => isValidPhone(entry))

      const candidatePhone = normalizePhone(ctx.user.phone ?? '')
      if (isValidPhone(candidatePhone) && normalizedRulePhones.length > 0) {
        return evaluateValueOperator(
          rule.operator,
          candidatePhone,
          normalizedRulePhones
        )
      }

      // Backward compatibility for old USER_ID rules stored as user ids.
      if (ctx.user.id) {
        return evaluateValueOperator(
          rule.operator,
          ctx.user.id,
          ruleValues
        )
      }

      return false
    }

    case 'DECORATION_REQUIRED': {
      // Backend support stays enabled even though the admin UI currently hides
      // this rule. That lets us re-enable it later without changing stored data
      // or reworking coupon evaluation again.
      const expected = Boolean(rule.value)
      const actual = Boolean(ctx.booking?.decorationRequired)
      return resolveRangeOperator(rule.operator, actual === expected)
    }

    case 'TARGET_CATEGORY':
    case 'TARGET_PRODUCT_ID':
      // Target rules control discount allocation, not coupon eligibility.
      return true

    default:
      return false
  }
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? '').trim())
      .filter((entry) => entry.length > 0)
  }

  const one = String(value ?? '').trim()
  return one ? [one] : []
}

function resolveRangeOperator(
  operator: CouponRuleEntity['operator'],
  matched: boolean
): boolean {
  switch (operator) {
    case 'NOT_IN':
      return !matched
    case 'IN':
    case 'BETWEEN':
    case 'EQUALS':
      return matched
    default:
      return false
  }
}

function evaluateValueOperator(
  operator: CouponRuleEntity['operator'],
  value: string,
  ruleValues: string[]
): boolean {
  if (ruleValues.length === 0) return false

  switch (operator) {
    case 'IN':
      return ruleValues.includes(value)
    case 'NOT_IN':
      return !ruleValues.includes(value)
    case 'EQUALS':
      if (ruleValues.length !== 1) return false
      return value === ruleValues[0]
    case 'BETWEEN': {
      if (ruleValues.length < 2) return false
      const [startRaw, endRaw] = ruleValues
      const start = startRaw ?? ''
      const end = endRaw ?? ''
      return value >= start && value <= end
    }
    default:
      return false
  }
}

function evaluateCollectionOperator(
  operator: CouponRuleEntity['operator'],
  values: string[],
  ruleValues: string[]
): boolean {
  if (ruleValues.length === 0) return false
  if (values.length === 0) {
    return operator === 'NOT_IN'
  }

  switch (operator) {
    case 'IN':
      return values.some((value) => ruleValues.includes(value))
    case 'NOT_IN':
      return values.every((value) => !ruleValues.includes(value))
    case 'EQUALS':
      if (ruleValues.length !== 1) return false
      return values.some((value) => value === ruleValues[0])
    case 'BETWEEN': {
      if (ruleValues.length < 2) return false
      const [startRaw, endRaw] = ruleValues
      const start = startRaw ?? ''
      const end = endRaw ?? ''
      return values.some((value) => value >= start && value <= end)
    }
    default:
      return false
  }
}

function isDateInRange(
  slotDate: Date,
  range: { from: string; to: string }
): boolean {
  const toDateKey = (input: Date | string) => {
    if (typeof input === "string") {
      const raw = input.trim()
      if (!raw) return ""
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw
      }
      const parsed = new Date(raw)
      if (Number.isNaN(parsed.getTime())) return ""
      return formatInTimeZone(parsed, IST_TIMEZONE, "yyyy-MM-dd")
    }
    return formatInTimeZone(input, IST_TIMEZONE, "yyyy-MM-dd")
  }

  const slotKey = toDateKey(slotDate)
  const fromKey = toDateKey(range.from)
  const toKey = toDateKey(range.to)
  if (!slotKey || !fromKey || !toKey) return false

  return slotKey >= fromKey && slotKey <= toKey
}

/**
 * Overnight-safe time containment check.
 * Slot must fully fit in rule range.
 */
function doesSlotFitTimeRange(
  slotStart: string,
  slotEnd: string,
  rule: { start: string; end: string }
): boolean {
  const toMinutes = (timeValue: string) => {
    const [hours, minutes] = timeValue.split(':').map(Number)
    return hours * 60 + minutes
  }

  const normalizeRange = (start: string, end: string) => {
    const normalizedStart = toMinutes(start)
    let normalizedEnd = toMinutes(end)
    if (normalizedEnd <= normalizedStart) normalizedEnd += 1440
    return { start: normalizedStart, end: normalizedEnd }
  }

  const slotRange = normalizeRange(slotStart, slotEnd)
  const ruleRange = normalizeRange(rule.start, rule.end)

  const slotCandidates = [slotRange, { start: slotRange.start + 1440, end: slotRange.end + 1440 }]
  const ruleCandidates = [ruleRange, { start: ruleRange.start + 1440, end: ruleRange.end + 1440 }]

  return slotCandidates.some((slotCandidate) =>
    ruleCandidates.some(
      (ruleCandidate) =>
        slotCandidate.start >= ruleCandidate.start &&
        slotCandidate.end <= ruleCandidate.end
    )
  )
}
