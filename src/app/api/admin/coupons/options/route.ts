import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

const BASE_OPTION_INCLUDES = ["locations"] as const;

export async function GET(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const requestedIncludes = searchParams
      .getAll("include")
      .flatMap((value) =>
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      );
    const includeSet = new Set(
      requestedIncludes.length > 0 ? requestedIncludes : BASE_OPTION_INCLUDES
    );

    const [locations, products, coupons] = await Promise.all([
      includeSet.has("locations")
        ? prisma.location.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      includeSet.has("products")
        ? prisma.product.findMany({
            where: { isActive: true },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              name: true,
              category: true,
              locationId: true,
              location: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      includeSet.has("coupons")
        ? prisma.coupon.findMany({
            where: { isDeleted: false },
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              code: true,
              isActive: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const data: Record<string, unknown> = {};

    if (includeSet.has("locations")) {
      data.locations = locations;
    }

    if (includeSet.has("theatres")) {
      data.theatres = [];
    }

    if (includeSet.has("products")) {
      data.products = products.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        locationId: item.locationId,
        locationName: item.location?.name ?? "—",
      }));
    }

    if (includeSet.has("slotDurations")) {
      data.slotDurations = [];
    }

    if (includeSet.has("coupons")) {
      data.coupons = coupons;
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[COUPON_OPTIONS]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch coupon options" },
      { status: 500 }
    );
  }
}
