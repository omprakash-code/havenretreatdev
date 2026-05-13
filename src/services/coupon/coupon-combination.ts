type CouponCombinationConfig = {
  id: string;
  code: string;
  isStackable: boolean;
  stackableCouponIds?: string[] | null;
};

function normalizeAllowedCouponIds(coupon: CouponCombinationConfig) {
  return Array.from(
    new Set(
      (coupon.stackableCouponIds ?? [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );
}

function allowsCoupon(coupon: CouponCombinationConfig, otherCouponId: string) {
  const allowedCouponIds = normalizeAllowedCouponIds(coupon);
  return allowedCouponIds.length === 0 || allowedCouponIds.includes(otherCouponId);
}

export function areCouponsCompatible(
  coupon: CouponCombinationConfig,
  otherCoupon: CouponCombinationConfig
) {
  if (!coupon.isStackable || !otherCoupon.isStackable) {
    return false;
  }

  return (
    allowsCoupon(coupon, otherCoupon.id) &&
    allowsCoupon(otherCoupon, coupon.id)
  );
}

export function findCouponCombinationConflict(
  coupon: CouponCombinationConfig,
  otherCoupons: CouponCombinationConfig[]
) {
  return otherCoupons.find((otherCoupon) => !areCouponsCompatible(coupon, otherCoupon)) ?? null;
}

export function findCouponCombinationPairConflict(
  coupons: CouponCombinationConfig[]
) {
  for (let index = 0; index < coupons.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < coupons.length; nextIndex += 1) {
      if (!areCouponsCompatible(coupons[index], coupons[nextIndex])) {
        return {
          coupon: coupons[index],
          otherCoupon: coupons[nextIndex],
        };
      }
    }
  }

  return null;
}

export function buildCouponCombinationConflictMessage(
  coupon: CouponCombinationConfig,
  otherCoupon?: CouponCombinationConfig | null
) {
  if (!otherCoupon) {
    return "This coupon cannot be used together with other coupons.";
  }

  if (!coupon.isStackable) {
    return "This coupon cannot be used together with other coupons.";
  }

  if (!otherCoupon.isStackable) {
    return `${otherCoupon.code} cannot be used together with other coupons.`;
  }

  return `This coupon cannot be used together with ${otherCoupon.code}.`;
}
