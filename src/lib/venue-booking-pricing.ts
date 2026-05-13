import { ADVANCE_PAYMENT_AMOUNT_KEY, APP_SETTING_META, parseAdvancePaymentAmount } from "@/lib/app-settings";
import type {
  VenueBookingPricingSnapshot,
  VenueBookingSelectedAddon,
} from "@/types/venue-booking";
import type { EventPackageSummary } from "@/types/venue-package";

function toMoney(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value as number));
}

export function getDefaultVenueDepositAmount() {
  return (
    parseAdvancePaymentAmount(
      APP_SETTING_META[ADVANCE_PAYMENT_AMOUNT_KEY].defaultValue
    ) ?? 0
  );
}

export function calculateVenueBookingPricing(input: {
  eventPackage: EventPackageSummary;
  selectedAddons?: VenueBookingSelectedAddon[];
  depositAmountOverride?: number | null;
}): VenueBookingPricingSnapshot {
  const packageAmount = toMoney(input.eventPackage.finalAmount);
  const addonsAmount = (input.selectedAddons ?? []).reduce(
    (total, addon) => total + toMoney(addon.unitPrice) * Math.max(0, addon.quantity),
    0
  );
  const cleaningFeeAmount = toMoney(
    input.eventPackage.cleaningAmount ?? input.eventPackage.venue.cleaningFee ?? 0
  );
  const savingsAmount = toMoney(input.eventPackage.savingsAmount);
  const subtotalAmount = packageAmount + addonsAmount;
  const depositCandidate = toMoney(
    input.depositAmountOverride ?? getDefaultVenueDepositAmount()
  );
  const depositAmount = Math.min(depositCandidate, subtotalAmount);

  return {
    packageAmount,
    addonsAmount,
    cleaningFeeAmount,
    savingsAmount,
    subtotalAmount,
    depositAmount,
    remainingAmount: Math.max(subtotalAmount - depositAmount, 0),
  };
}
