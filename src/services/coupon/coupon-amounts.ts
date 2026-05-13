import { isSlotOnlyCouponScope } from "@/lib/coupon-scope";
import type { CouponEntity, CouponEvaluationContext } from "./coupon.types";

type CouponAmounts = CouponEvaluationContext["amounts"];

type CouponAmountComponents = {
  slotAmount: number;
  nonSlotAmount: number;
  productsTotal?: number;
  extrasTotal?: number;
};

function toNonNegativeNumber(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(value, 0);
}

export function buildCouponAmountsFromComponents(
  input: CouponAmountComponents
): CouponAmounts {
  const slotAmount = toNonNegativeNumber(input.slotAmount);
  const nonSlotAmount = toNonNegativeNumber(input.nonSlotAmount);
  const productsTotal = toNonNegativeNumber(input.productsTotal ?? 0);
  const extrasTotal = toNonNegativeNumber(input.extrasTotal ?? 0);
  const bookingSubtotal = slotAmount + nonSlotAmount;

  return {
    bookingSubtotal,
    bookingTotal: bookingSubtotal,
    slotAmount,
    slotTotal: slotAmount,
    nonSlotAmount,
    productsTotal,
    extrasTotal,
  };
}

export function resolveScopeBaseAmount(
  scope: CouponEntity["scope"],
  amounts: CouponAmounts
): number {
  const slotAmount = toNonNegativeNumber(
    amounts.slotAmount ?? amounts.slotTotal ?? 0
  );
  const nonSlotAmount = toNonNegativeNumber(
    amounts.nonSlotAmount ??
      (amounts.bookingSubtotal != null
        ? amounts.bookingSubtotal - slotAmount
        : amounts.bookingTotal - slotAmount)
  );
  const bookingSubtotal = toNonNegativeNumber(
    amounts.bookingSubtotal ?? slotAmount + nonSlotAmount
  );
  const productsTotal = toNonNegativeNumber(amounts.productsTotal ?? 0);

  switch (scope) {
    case "PRODUCTS_ONLY":
      // Products scope must include only catalog items (BookingItem totals),
      // never theatre decoration/extra charges.
      return productsTotal;
    default:
      if (isSlotOnlyCouponScope(scope)) {
        // Slot-only discounts are still persisted as EXTRAS_ONLY in the DB.
        return slotAmount;
      }
      return bookingSubtotal;
  }
}
