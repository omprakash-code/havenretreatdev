import { PackageFeatureGroup } from "@prisma/client";
import type {
  GroupedPackageFeatureItem,
  GroupedPackageFeatures,
} from "@/types/venue-package";

export function createEmptyGroupedPackageFeatures(): GroupedPackageFeatures {
  return {
    included: [],
    decoration: [],
    cleaning: [],
    priceBreakdown: [],
  };
}

export function groupPackageFeatures(
  features: Array<{
    id: string;
    group: PackageFeatureGroup;
    label: string;
    value?: string | null;
    icon?: string | null;
    sortOrder: number;
  }>
): GroupedPackageFeatures {
  const grouped = createEmptyGroupedPackageFeatures();

  const sortedFeatures = [...features].sort((a, b) => a.sortOrder - b.sortOrder);

  const normalized = sortedFeatures.map<GroupedPackageFeatureItem>((feature) => ({
      id: feature.id,
      label: feature.label,
      value: feature.value ?? null,
      icon: feature.icon ?? null,
      sortOrder: feature.sortOrder,
    }));

  normalized.forEach((feature, index) => {
    const source = sortedFeatures[index];
    switch (source.group) {
      case PackageFeatureGroup.INCLUDED:
        grouped.included.push(feature);
        break;
      case PackageFeatureGroup.DECORATION:
        grouped.decoration.push(feature);
        break;
      case PackageFeatureGroup.CLEANING:
        grouped.cleaning.push(feature);
        break;
      case PackageFeatureGroup.PRICE_BREAKDOWN:
        grouped.priceBreakdown.push(feature);
        break;
      default:
        break;
    }
  });

  return grouped;
}
