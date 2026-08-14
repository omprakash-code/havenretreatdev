import type { EventPackage, PackageFeature, Prisma, Venue } from "@prisma/client";

import { resolveBookingDurationPricingConfig } from "@/lib/booking-duration-pricing";
import { centsToMoney, multiplyMoney, toCents, toNonNegativeMoney } from "@/lib/money";
import {
  buildPackageIncludedAllowances,
  resolvePackageIncludedProducts,
  type PackageIncludedAllowance,
} from "@/lib/package-included-products";

type PackageRecord = EventPackage & {
  venue: Venue;
  features: PackageFeature[];
};

function snapshotMoney(value: number) {
  return toNonNegativeMoney(value);
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
    decorationAddonPrice: eventPackage.decorationAddonPrice,
    decorationDefault: eventPackage.decorationDefault,
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

type ProductAllowanceReader = Pick<Prisma.TransactionClient, "product">;

/**
 * Snapshots the package's included tables/chairs — quantity AND unit price — at
 * the moment the customer picks a package. Everything downstream (reductions,
 * extras, edits) prices against this frozen snapshot, so a later product price
 * change can never move an existing booking's total.
 */
export async function buildPackageIncludedSnapshot(
  eventPackage: Pick<EventPackage, "name" | "guestLimit" | "locationId">,
  reader: ProductAllowanceReader
): Promise<PackageIncludedAllowance[]> {
  const source = {
    name: eventPackage.name,
    baseGuests: eventPackage.guestLimit,
  };
  const products = await loadIncludedProductCatalogue(
    reader,
    source,
    eventPackage.locationId
  );

  return buildPackageIncludedAllowances({ source, products });
}

/**
 * The catalogue rows behind a package's included lines, for the package's
 * location. Shared by the snapshot builder and by the admin read/write paths so
 * every caller resolves allowances against the same set of products; a
 * mismatched query is how a line ends up "included" on one path and billable on
 * the other.
 */
export async function loadIncludedProductCatalogue(
  reader: ProductAllowanceReader,
  source: Parameters<typeof resolvePackageIncludedProducts>[0],
  locationId: string | null
) {
  const slugs = Object.keys(resolvePackageIncludedProducts(source));
  if (slugs.length === 0) return [];

  return reader.product.findMany({
    where: {
      slug: { in: slugs },
      isActive: true,
      OR: [{ locationId }, { locationId: null }],
    },
    include: {
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
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
    snapshotMoney(eventPackage.hourlyRate) || durationPricing.extraHourlyRate;
  const extraDurationAmount = multiplyMoney(
    effectiveHourlyRate,
    extraDurationHours
  );
  const packageAmount = snapshotMoney(eventPackage.subtotalAmount);
  const totalAmount = centsToMoney(
    toCents(packageAmount) + toCents(extraDurationAmount)
  );

  return {
    packageAmount,
    // A fresh session has no included-item reduction yet. packageListAmount is
    // the immutable basis every later adjustment is subtracted from, so it must
    // never be overwritten with an already-adjusted figure.
    packageListAmount: packageAmount,
    packageAdjustmentAmount: 0,
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
