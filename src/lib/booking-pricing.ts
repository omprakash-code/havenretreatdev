import {
  centsToMoney,
  multiplyMoney,
  toCents,
  toNonNegativeMoney,
} from "@/lib/money";

type CalculateBookingPricingInput = {
  slotBasePrice: number;
  slotFinalPrice?: number | null;
  guestCount: number;
  theatreBaseGuests: number;
  theatreExtraPersonPrice: number;
  durationHours?: number | null;
  includedDurationHours?: number | null;
  extraHourlyRate?: number | null;
  productsAmount?: number;
  additionalChargeAmount?: number;
  /**
   * Credit for package-included items (tables/chairs) reduced below the
   * quantity the package price already paid for. Passed as a positive number
   * and subtracted from the package price BEFORE coupons, so package-only
   * coupons discount the adjusted package price.
   */
  packageAdjustmentAmount?: number;
  discountAmount?: number;
  advancePaid?: number;
};

export type BookingPricingBreakdown = {
  baseAmount: number;
  /** Package price after the included-item reduction. */
  packageBaseAmount: number;
  /** Package price as listed, before any included-item reduction. */
  packageListAmount: number;
  packageAdjustmentAmount: number;
  extraDurationHours: number;
  extraHourlyRate: number;
  extraHoursAmount: number;
  extrasAmount: number;
  productsAmount: number;
  additionalChargeAmount: number;
  decorationAmount: number;
  discountAmount: number;
  totalAmount: number;
  advancePaid: number;
  remainingPayable: number;
};

export function calculateBookingPricing(
  input: CalculateBookingPricingInput
): BookingPricingBreakdown {
  const packageListAmount = toNonNegativeMoney(
    input.slotFinalPrice ?? input.slotBasePrice
  );
  // The reduction can never exceed the package price itself.
  const packageAdjustmentAmount = centsToMoney(
    Math.min(
      toCents(toNonNegativeMoney(input.packageAdjustmentAmount ?? 0)),
      toCents(packageListAmount)
    )
  );
  const packageBaseAmount = centsToMoney(
    toCents(packageListAmount) - toCents(packageAdjustmentAmount)
  );
  const durationHours =
    typeof input.durationHours === "number" && Number.isFinite(input.durationHours)
      ? Math.max(0, input.durationHours)
      : 0;
  const includedDurationHours =
    typeof input.includedDurationHours === "number" &&
    Number.isFinite(input.includedDurationHours)
      ? Math.max(0, input.includedDurationHours)
      : 0;
  const extraDurationHours = Math.max(durationHours - includedDurationHours, 0);
  const extraHourlyRate = toNonNegativeMoney(input.extraHourlyRate ?? 0);
  const extraHoursAmount = multiplyMoney(extraHourlyRate, extraDurationHours);
  const baseAmount = centsToMoney(
    toCents(packageBaseAmount) + toCents(extraHoursAmount)
  );
  const guestCount = Math.max(0, Math.trunc(input.guestCount));
  const baseGuests = Math.max(0, Math.trunc(input.theatreBaseGuests));
  const extraGuestCount = Math.max(guestCount - baseGuests, 0);
  const extrasAmount = multiplyMoney(
    input.theatreExtraPersonPrice,
    extraGuestCount
  );

  // Decoration is offered as product add-ons now; choosing "yes" no longer adds a cost.
  const decorationAmount = 0;

  const productsAmount = toNonNegativeMoney(input.productsAmount ?? 0);
  const additionalChargeAmount = toNonNegativeMoney(
    input.additionalChargeAmount ?? 0
  );
  const grossCents =
    toCents(baseAmount) +
    toCents(extrasAmount) +
    toCents(decorationAmount) +
    toCents(productsAmount) +
    toCents(additionalChargeAmount);
  const grossAmount = centsToMoney(grossCents);
  const discountAmount = Math.min(
    toNonNegativeMoney(input.discountAmount ?? 0),
    grossAmount
  );
  const totalAmount = centsToMoney(
    Math.max(grossCents - toCents(discountAmount), 0)
  );
  const advancePaid = Math.min(
    toNonNegativeMoney(input.advancePaid ?? 0),
    totalAmount
  );
  const remainingPayable = centsToMoney(
    Math.max(toCents(totalAmount) - toCents(advancePaid), 0)
  );

  return {
    baseAmount,
    packageBaseAmount,
    packageListAmount,
    packageAdjustmentAmount,
    extraDurationHours,
    extraHourlyRate,
    extraHoursAmount,
    extrasAmount,
    productsAmount,
    additionalChargeAmount,
    decorationAmount,
    discountAmount,
    totalAmount,
    advancePaid,
    remainingPayable,
  };
}
