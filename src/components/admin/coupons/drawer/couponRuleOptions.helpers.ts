import type {
  CouponRuleOptionInclude,
  CouponRuleOptions,
} from "./options.types";

export function getNeededRuleOptionIncludes(
  include: CouponRuleOptionInclude[],
  loaded: Set<CouponRuleOptionInclude>
) {
  return include.filter((item) => item === "slotDurations" || !loaded.has(item));
}

export function mergeRuleOptions(
  current: CouponRuleOptions,
  incoming: Partial<CouponRuleOptions>
): CouponRuleOptions {
  return {
    locations: incoming.locations ?? current.locations,
    theatres: incoming.theatres ?? current.theatres,
    products: incoming.products ?? current.products,
    slots: incoming.slots ?? current.slots,
    slotDurations: incoming.slotDurations ?? current.slotDurations,
    coupons: incoming.coupons ?? current.coupons,
  };
}
