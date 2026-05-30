type PackageGuestSource = {
  capacity?: number | null;
};

export const PACKAGE_EXTRA_PERSON_PRICE = 20;

export function resolvePackageIncludedGuestCount(
  source: PackageGuestSource | null | undefined
) {
  const capacity = Number(source?.capacity ?? 0);
  return Number.isFinite(capacity) && capacity > 0 ? Math.trunc(capacity) : 1;
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
