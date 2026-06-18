// src/app/api/products/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ProductCategory } from "@prisma/client";
import {
  resolveBookingCategoryMeta,
  slugifyBookingCategory,
} from "@/lib/booking-product-categories";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const bookingCategory = searchParams.get("bookingCategory")?.trim() ?? "";
    const locationId = searchParams.get("locationId")?.trim() ?? "";

    if (!category && !bookingCategory) {
      return NextResponse.json(
        { success: false, message: "Category is required" },
        { status: 400 }
      );
    }

    if (
      category &&
      !Object.values(ProductCategory).includes(category as ProductCategory)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid category" },
        { status: 400 }
      );
    }

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(category
          ? {
              category: category as ProductCategory,
            }
          : {}),
        ...(locationId
          ? {
              OR: [{ locationId }, { locationId: null }],
            }
          : {}),
      },
      orderBy: { sortOrder: "asc" },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    const filteredProducts = bookingCategory
      ? products.filter((product) => {
          const resolved = resolveBookingCategoryMeta(product);
          return (
            resolved.slug === bookingCategory ||
            slugifyBookingCategory(product.name) === bookingCategory
          );
        })
      : products;

    // IMPORTANT: map Prisma → UI-safe response
    const normalized = filteredProducts.map((p) => ({
      ...resolveBookingCategoryMeta(p),
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      category: p.category,
      image: p.image,
      variants: p.variants.map((v) => {
        const validSalePrice =
          v.salePrice !== null && v.salePrice !== undefined && v.salePrice > 0
            ? v.salePrice
            : null;

        return {
          id: v.id,
          label: v.label,
          regularPrice: v.regularPrice,
          salePrice: validSalePrice,
          stock: v.stock,
          maxPerBooking: v.maxPerBooking,
          price: validSalePrice ?? v.regularPrice,
          isDefault: v.isDefault,
        };
      }),

    }));

    return NextResponse.json({
      success: true,
      data: normalized,
    });
  } catch (error) {
    console.error("GET /api/products error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to load products" },
      { status: 500 }
    );
  }
}
