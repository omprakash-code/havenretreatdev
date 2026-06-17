type PackageGuestSource = {
  capacity?: number | null;
};

// Additional guests above the included count are free, so there is no longer a
// per-person fee. The constant is kept (and exported) so existing callers keep
// compiling; it now resolves to 0 everywhere extra-guest pricing was applied.
export const PACKAGE_EXTRA_PERSON_PRICE = 0;

// Guests may exceed the included package guest count by up to this many people,
// at no extra charge. The venue can never hold more than the absolute maximum.
export const PACKAGE_GUEST_HEADROOM = 3;
export const VENUE_ABSOLUTE_MAX_GUESTS = 55;

export function resolvePackageIncludedGuestCount(
  source: PackageGuestSource | null | undefined
) {
  const capacity = Number(source?.capacity ?? 0);
  return Number.isFinite(capacity) && capacity > 0 ? Math.trunc(capacity) : 1;
}

// Maximum bookable guests for a package, derived from its included guest count:
// included + free headroom, never above the absolute venue maximum.
export function maxGuestsForIncluded(includedGuests: number) {
  const included = Number.isFinite(includedGuests)
    ? Math.max(1, Math.trunc(includedGuests))
    : 1;
  return Math.min(included + PACKAGE_GUEST_HEADROOM, VENUE_ABSOLUTE_MAX_GUESTS);
}

export function resolvePackageMaxGuestCount(
  source: PackageGuestSource | null | undefined
) {
  return maxGuestsForIncluded(resolvePackageIncludedGuestCount(source));
}

export function resolvePackageGuestLimit(
  selectedPackage: PackageGuestSource | null | undefined,
  packageOptions: PackageGuestSource[] = []
) {
  const selectedIncluded = resolvePackageIncludedGuestCount(selectedPackage);
  return Math.max(
    selectedIncluded,
    ...packageOptions.map(resolvePackageIncludedGuestCount)
  );
}
