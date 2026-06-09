import type { EventAddon, EventPackage, PackageFeature, Venue } from "@prisma/client";
import { groupPackageFeatures } from "@/lib/package-features";
import {
  findActiveEventPackages,
  findEventPackageBySlug,
  findPackageAddons,
  findPackageFeatures,
} from "@/repos/package.repo";
import type {
  EventAddonSummary,
  EventPackageSummary,
  GroupedPackageFeatureItem,
  VenueSummary,
} from "@/types/venue-package";

function mapVenueSummary(venue: Venue): VenueSummary {
  return {
    id: venue.id,
    name: venue.name,
    slug: venue.slug,
    description: venue.description,
    address: venue.address,
    city: venue.city,
    state: venue.state,
    zipCode: venue.zipCode,
    country: venue.country,
    phone: venue.phone,
    email: venue.email,
    images: venue.images,
    maxGuests: venue.maxGuests,
    cleaningFee: venue.cleaningFee,
    setupBufferMinutes: venue.setupBufferMinutes,
    isActive: venue.isActive,
  };
}

function mapAddonSummary(addon: EventAddon): EventAddonSummary {
  return {
    id: addon.id,
    name: addon.name,
    slug: addon.slug,
    description: addon.description,
    price: addon.price,
    category: addon.category,
    image: addon.image,
    isActive: addon.isActive,
    sortOrder: addon.sortOrder,
  };
}

function mapFeatureSummary(feature: PackageFeature): GroupedPackageFeatureItem {
  return {
    id: feature.id,
    label: feature.label,
    value: feature.value,
    icon: feature.icon,
    sortOrder: feature.sortOrder,
  };
}

async function mapPackageSummary(
  record: EventPackage & {
    venue: Venue;
    features: PackageFeature[];
    addons: EventAddon[];
  }
) : Promise<EventPackageSummary> {
  const resolvedAddons = await findPackageAddons({
    packageId: record.id,
    venueId: record.venueId,
  });

  return {
    id: record.id,
    venueId: record.venueId,
    name: record.name,
    slug: record.slug,
    shortDescription: record.shortDescription,
    guestLimit: record.guestLimit,
    eventDurationHours: record.eventDurationHours,
    complimentarySetupHours: record.complimentarySetupHours,
    hourlyRate: record.hourlyRate,
    rentalAmount: record.rentalAmount,
    decorationAmount: record.decorationAmount,
    cleaningAmount: record.cleaningAmount,
    subtotalAmount: record.subtotalAmount,
    savingsAmount: record.savingsAmount,
    finalAmount: record.finalAmount,
    isPopular: record.isPopular,
    sortOrder: record.sortOrder,
    isActive: record.isActive,
    venue: mapVenueSummary(record.venue),
    features: record.features.map(mapFeatureSummary),
    featureGroups: groupPackageFeatures(record.features),
    addons: resolvedAddons.map(mapAddonSummary),
  };
}

export async function getEventPackages() {
  const packages = await findActiveEventPackages();
  return Promise.all(packages.map((eventPackage) => mapPackageSummary(eventPackage)));
}

export async function getEventPackageBySlug(slug: string) {
  const eventPackage = await findEventPackageBySlug(slug);
  if (!eventPackage || !eventPackage.isActive || !eventPackage.venue.isActive) {
    return null;
  }

  return mapPackageSummary(eventPackage);
}

export async function getPackageFeatures(packageId: string) {
  const features = await findPackageFeatures(packageId);
  return {
    features: features.map(mapFeatureSummary),
    groups: groupPackageFeatures(features),
  };
}

export async function getPackageAddons(input: {
  packageId?: string;
  venueId?: string;
}) {
  const addons = await findPackageAddons(input);
  return addons.map(mapAddonSummary);
}

export { mapPackageSummary, mapVenueSummary };
