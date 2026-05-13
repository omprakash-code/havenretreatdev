import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  resolveBookingCategoryMeta,
  type BookingProductCategory,
} from "@/lib/booking-product-categories";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId")?.trim() ?? "";

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(locationId
          ? {
              OR: [{ locationId }, { locationId: null }],
            }
          : {}),
      },
      orderBy: [{ bookingCategorySortOrder: "asc" }, { sortOrder: "asc" }],
      select: {
        category: true,
        bookingCategorySlug: true,
        bookingCategoryLabel: true,
        bookingCategoryDescription: true,
        bookingCategorySortOrder: true,
        sortOrder: true,
      },
    });

    const uniqueCategories = new Map<string, BookingProductCategory>();

    products.forEach((product) => {
      const category = resolveBookingCategoryMeta(product);
      const current = uniqueCategories.get(category.slug);

      if (!current || category.sortOrder < current.sortOrder) {
        uniqueCategories.set(category.slug, category);
      }
    });

    const data = Array.from(uniqueCategories.values()).sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }

      return a.label.localeCompare(b.label);
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("GET /api/products/categories error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to load product categories" },
      { status: 500 }
    );
  }
}
