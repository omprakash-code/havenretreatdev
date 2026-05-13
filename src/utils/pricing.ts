import { SelectedTheatre } from "@/context/BookingContext";

/* -----------------------------
 Types
------------------------------ */

export type PricingBreakdown = {
  base: number;        // Base slot price
  extras: number;      // Extra guests cost
  decoration: number;  // Decoration cost (0 if not selected)
  discount: number;    // Coupon / promo (future)
  total: number;       // Final payable (excluding advance logic)
};

/* -----------------------------
 Pricing Calculator
------------------------------ */
/**
 * Single source of truth for booking pricing.
 * DO NOT calculate pricing anywhere else.
 */
export function calculatePricing(params: {
  theatre: SelectedTheatre;
  guestCount: number;
  decorationSelected: boolean;
}): PricingBreakdown {
  const {
    theatre,
    guestCount,
    decorationSelected,
  } = params;

  /* -----------------------------
    Base
  ------------------------------ */
  const base = Number(theatre.basePrice) || 0;

  /* -----------------------------
    Extra Guests
  ------------------------------ */
  const includedGuests =
    Number(theatre.baseGuests) || 0;

  const extraGuestCount = Math.max(
    guestCount - includedGuests,
    0
  );

  const extras =
    extraGuestCount *
    (Number(theatre.extraPersonPrice) || 0);

  /* -----------------------------
    Decoration
  ------------------------------ */
  const decoration =
    decorationSelected
      ? Number(theatre.decorationPrice) || 0
      : 0;

  /* -----------------------------
    Discount (future)
  ------------------------------ */
  const discount = 0;

  /* -----------------------------
    Total
  ------------------------------ */
  const total =
    base + extras + decoration - discount;

  return {
    base,
    extras,
    decoration,
    discount,
    total,
  };
}
