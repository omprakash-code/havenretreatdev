import { prisma } from "@/lib/db";

export function findActiveVenues() {
  return prisma.venue.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

export function findVenueBySlug(slug: string) {
  return prisma.venue.findUnique({
    where: { slug },
    include: {
      packages: {
        where: {
          isActive: true,
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
      },
      addons: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}
