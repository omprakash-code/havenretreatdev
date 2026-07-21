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
  discountAmount?: number;
  advancePaid?: number;
};

export type BookingPricingBreakdown = {
  baseAmount: number;
  packageBaseAmount: number;
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

function toMoney(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value as number));
}

export function calculateBookingPricing(
  input: CalculateBookingPricingInput
): BookingPricingBreakdown {
  const packageBaseAmount = toMoney(input.slotFinalPrice ?? input.slotBasePrice);
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
  const extraHourlyRate = toMoney(input.extraHourlyRate ?? 0);
  const extraHoursAmount = Math.round(extraDurationHours * extraHourlyRate);
  const baseAmount = packageBaseAmount + extraHoursAmount;
  const guestCount = Math.max(0, Math.trunc(input.guestCount));
  const baseGuests = Math.max(0, Math.trunc(input.theatreBaseGuests));
  const extraGuestCount = Math.max(guestCount - baseGuests, 0);
  const extrasAmount = extraGuestCount * toMoney(input.theatreExtraPersonPrice);

  // Decoration is offered as product add-ons now; choosing "yes" no longer adds a cost.
  const decorationAmount = 0;

  const productsAmount = toMoney(input.productsAmount ?? 0);
  const additionalChargeAmount = toMoney(input.additionalChargeAmount ?? 0);
  const grossAmount =
    baseAmount +
    extrasAmount +
    decorationAmount +
    productsAmount +
    additionalChargeAmount;
  const discountAmount = Math.min(toMoney(input.discountAmount ?? 0), grossAmount);
  const totalAmount = Math.max(grossAmount - discountAmount, 0);
  const advancePaid = Math.min(toMoney(input.advancePaid ?? 0), totalAmount);
  const remainingPayable = Math.max(totalAmount - advancePaid, 0);

  return {
    baseAmount,
    packageBaseAmount,
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
