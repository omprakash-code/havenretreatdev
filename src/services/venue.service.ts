import { findActiveVenues, findVenueBySlug } from "@/repos/venue.repo";
import {
  getPackageAddons,
  mapPackageSummary,
  mapVenueSummary,
} from "@/services/package.service";

export async function getVenues() {
  const venues = await findActiveVenues();
  return venues.map(mapVenueSummary);
}

export async function getVenueBySlug(slug: string) {
  const venue = await findVenueBySlug(slug);
  if (!venue || !venue.isActive) {
    return null;
  }

  const venueAddons = await getPackageAddons({ venueId: venue.id });
  const packages = await Promise.all(
    venue.packages.map((eventPackage) => mapPackageSummary(eventPackage))
  );

  return {
    ...mapVenueSummary(venue),
    packages,
    addons: venueAddons,
  };
}
