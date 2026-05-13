import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

function slugifyLocationSuffix(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const locations = await prisma.location.findMany({
    select: { id: true, name: true },
  });

  const suffixByLocationId = new Map(
    locations.map((location) => [location.id, slugifyLocationSuffix(location.name)])
  );

  const products = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      variants: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  for (const product of products) {
    if (!product.locationId) continue;

    const suffix = suffixByLocationId.get(product.locationId);
    if (!suffix) continue;

    const suffixMarker = `--${suffix}`;
    if (!product.slug.endsWith(suffixMarker)) continue;

    const canonicalSlug = product.slug.slice(0, -suffixMarker.length);
    const canonicalProduct = await prisma.product.findUnique({
      where: { slug: canonicalSlug },
      include: {
        variants: true,
      },
    });

    if (!canonicalProduct || canonicalProduct.id === product.id) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          slug: canonicalSlug,
          locationId: null,
        },
      });
      continue;
    }

    const duplicateBookingItems = await prisma.bookingItem.findMany({
      where: { productId: product.id },
      orderBy: { createdAt: "asc" },
    });

    for (const item of duplicateBookingItems) {
      const matchingVariant =
        canonicalProduct.variants.find(
          (variant) => variant.label === item.variantLabel
        ) ?? null;

      if (!matchingVariant) {
        throw new Error(
          `No matching canonical variant found for ${canonicalProduct.slug} / ${item.variantLabel}`
        );
      }

      await prisma.bookingItem.update({
        where: { id: item.id },
        data: {
          productId: canonicalProduct.id,
          variantId: matchingVariant.id,
        },
      });
    }

    await prisma.productVariant.deleteMany({
      where: { productId: product.id },
    });

    await prisma.product.delete({
      where: { id: product.id },
    });
  }

  await prisma.product.updateMany({
    where: {
      locationId: { not: null },
    },
    data: {
      locationId: null,
    },
  });

  console.log("Products normalized to global scope successfully.");
}

main()
  .catch((error) => {
    console.error("Failed to normalize products:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
