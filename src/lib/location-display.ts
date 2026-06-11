export const DEFAULT_LOCATION_NAME = "Miami";

export function resolveLocationDisplayName(
  locationName?: string | null,
  venueCity?: string | null
) {
  const location = locationName?.trim();
  if (location) return location;

  const city = venueCity?.trim();
  if (city) return city;

  return DEFAULT_LOCATION_NAME;
}
