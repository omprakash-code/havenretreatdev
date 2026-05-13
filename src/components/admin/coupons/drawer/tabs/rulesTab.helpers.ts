export type RestrictionOption = {
  value: string;
  label: string;
};

export function resolveLocationRestrictionSelection({
  currentLocationId,
  availableLocationIds,
}: {
  currentLocationId: string | null | undefined;
  availableLocationIds: string[];
}) {
  if (currentLocationId) {
    return {
      nextLocationId: currentLocationId,
      pending: false,
      shouldLoad: false,
    };
  }

  if (availableLocationIds.length > 0) {
    return {
      nextLocationId: availableLocationIds[0] ?? null,
      pending: false,
      shouldLoad: false,
    };
  }

  return {
    nextLocationId: null,
    pending: true,
    shouldLoad: true,
  };
}

export function buildRestrictionPickerOptions({
  restrictionTypeOptions,
  availableRestrictionOptions,
  selectedRestrictionType,
}: {
  restrictionTypeOptions: RestrictionOption[];
  availableRestrictionOptions: RestrictionOption[];
  selectedRestrictionType: string;
}) {
  const selectedRestrictionOption = selectedRestrictionType
    ? restrictionTypeOptions.find((option) => option.value === selectedRestrictionType) ?? null
    : null;

  return [
    { value: "", label: "Choose a restriction" },
    ...availableRestrictionOptions,
    ...(!selectedRestrictionOption ||
    availableRestrictionOptions.some(
      (option) => option.value === selectedRestrictionOption.value
    )
      ? []
      : [selectedRestrictionOption]),
  ];
}

export function mergeRestrictionOrder(
  previousOrder: string[],
  currentTokens: string[]
) {
  const preserved = previousOrder.filter((token) => currentTokens.includes(token));
  const missing = currentTokens.filter((token) => !preserved.includes(token));
  return [...preserved, ...missing];
}
