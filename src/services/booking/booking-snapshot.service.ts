import type { EventPackage, PackageFeature, Venue } from "@prisma/client";

import { resolveBookingDurationPricingConfig } from "@/lib/booking-duration-pricing";

type PackageRecord = EventPackage & {
  venue: Venue;
  features: PackageFeature[];
};

function toMoney(value: number) {
  return Math.max(0, Math.trunc(Number(value) || 0));
}

export function buildPackageSnapshot(eventPackage: PackageRecord) {
  return {
    id: eventPackage.id,
    venueId: eventPackage.venueId,
    name: eventPackage.name,
    slug: eventPackage.slug,
    shortDescription: eventPackage.shortDescription,
    guestLimit: eventPackage.guestLimit,
    eventDurationHours: eventPackage.eventDurationHours,
    complimentarySetupHours: eventPackage.complimentarySetupHours,
    rentalAmount: eventPackage.rentalAmount,
    decorationAmount: eventPackage.decorationAmount,
    cleaningAmount: eventPackage.cleaningAmount,
    subtotalAmount: eventPackage.subtotalAmount,
    savingsAmount: 0,
    finalAmount: eventPackage.subtotalAmount,
    features: eventPackage.features.map((feature) => ({
      group: feature.group,
      label: feature.label,
      value: feature.value,
      icon: feature.icon,
      sortOrder: feature.sortOrder,
    })),
    venue: {
      id: eventPackage.venue.id,
      name: eventPackage.venue.name,
      slug: eventPackage.venue.slug,
    },
  };
}

export async function buildInitialPricingSnapshot(
  eventPackage: PackageRecord,
  durationMinutes: number,
  reader: Parameters<typeof resolveBookingDurationPricingConfig>[0]
) {
  const durationPricing = await resolveBookingDurationPricingConfig(reader);
  const durationHours = durationMinutes / 60;
  const extraDurationHours = Math.max(
    durationHours - eventPackage.eventDurationHours,
    0
  );
  const effectiveHourlyRate =
    toMoney(eventPackage.hourlyRate) || durationPricing.extraHourlyRate;
  const extraDurationAmount = Math.round(
    extraDurationHours * effectiveHourlyRate
  );
  const packageAmount = toMoney(eventPackage.subtotalAmount);
  const totalAmount = packageAmount + extraDurationAmount;

  return {
    packageAmount,
    packageGuestLimit: eventPackage.guestLimit,
    includedDurationHours: eventPackage.eventDurationHours,
    bookedDurationHours: durationHours,
    extraDurationHours,
    extraHourlyRate: effectiveHourlyRate,
    extraDurationAmount,
    extraGuestCount: 0,
    extraGuestAmount: 0,
    addonsAmount: 0,
    productsAmount: 0,
    discountAmount: 0,
    totalAmount,
    advancePaid: 0,
    remainingPayable: totalAmount,
  };
}
