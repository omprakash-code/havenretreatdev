import { prisma } from "@/lib/db";

export function findActiveEventPackages() {
  return prisma.eventPackage.findMany({
    where: {
      isActive: true,
      venue: {
        isActive: true,
      },
    },
    include: {
      venue: true,
      features: {
        orderBy: { sortOrder: "asc" },
      },
      addons: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export function findEventPackageBySlug(slug: string) {
  return prisma.eventPackage.findUnique({
    where: { slug },
    include: {
      venue: true,
      features: {
        orderBy: { sortOrder: "asc" },
      },
      addons: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

export function findPackageFeatures(packageId: string) {
  return prisma.packageFeature.findMany({
    where: { packageId },
    orderBy: { sortOrder: "asc" },
  });
}

export function findPackageAddons(input: {
  packageId?: string;
  venueId?: string;
}) {
  return prisma.eventAddon.findMany({
    where: {
      isActive: true,
      OR: [
        ...(input.packageId ? [{ packageId: input.packageId }] : []),
        ...(input.venueId ? [{ venueId: input.venueId, packageId: null }] : []),
      ],
    },
    orderBy: { sortOrder: "asc" },
  });
}
