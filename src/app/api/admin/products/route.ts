import { NextResponse } from "next/server";
import { BookingStatus, Prisma, ProductCategory } from "@prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
import {
  productFormSchema,
  type ProductFormValues,
} from "@/components/admin/products/drawer/product.schema";

const ADMIN_SOFT_DELETE_REASON = "ADMIN_SOFT_DELETED";
type BlockedBookingRef = {
  bookingRef: string;
  bookingStatus: BookingStatus;
};

function toAdminProductResponse(
  product: Prisma.ProductGetPayload<{
    include: {
      location: { select: { id: true; name: true } };
      variants: true;
    };
  }>
) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    image: product.image || "",

    category: product.category,
    isActive: product.isActive,
    sortOrder: product.sortOrder,
    location: product.location ?? {
      id: "__ALL__",
      name: "All Locations",
    },

    variants: product.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      regularPrice: variant.regularPrice,
      salePrice:
        variant.salePrice !== null &&
        variant.salePrice !== undefined &&
        variant.salePrice > 0
          ? variant.salePrice
          : null,
      stock: variant.stock,
      isDefault: variant.isDefault,
      isActive: variant.isActive,
      sortOrder: variant.sortOrder,
    })),

    variantsCount: product.variants.length,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

function normalizeProductData(input: ProductFormValues) {
  const normalizedVariants = input.variants.map((variant, index) => ({
    id: variant.id,
    label: variant.label.trim(),
    regularPrice: variant.regularPrice,
    salePrice:
      variant.salePrice !== null &&
      variant.salePrice !== undefined &&
      Number(variant.salePrice) > 0
        ? Number(variant.salePrice)
        : null,
    isDefault: variant.isDefault,
    isActive: variant.isActive,
    stock: variant.stock,
    sortOrder: variant.sortOrder ?? index,
  }));

  const defaultIndex = Math.max(
    normalizedVariants.findIndex((variant) => variant.isDefault),
    0
  );

  const variants = normalizedVariants.map((variant, index) => ({
    ...(variant.id ? { id: variant.id } : {}),
    label: variant.label,
    regularPrice: variant.regularPrice,
    salePrice: variant.salePrice,
    stock: variant.stock,
    isDefault: index === defaultIndex,
    isActive: variant.isActive,
    sortOrder: variant.sortOrder,
  }));

  return {
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase(),
    image: input.image.trim(),
    description: input.description?.trim() || null,
    category: input.category,
    locationId:
      input.locationId.trim() === "__ALL__" ? null : input.locationId.trim(),
    isActive: input.isActive,
    sortOrder: input.sortOrder,
    variants,
  };
}

function getMutationErrorMessage(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return "A product with this slug or variant label already exists.";
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  ) {
    return "Invalid location selected.";
  }

  return "Failed to save product";
}

function getMutationStatusCode(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return 409;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  ) {
    return 400;
  }

  return 500;
}

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
    const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
    const limit = Math.max(Number(searchParams.get("limit") ?? 1000), 1);
    const skip = (page - 1) * limit;

    const locationId = searchParams.get("locationId");
    const categoryParam = searchParams.get("category");
    const isActiveParam = searchParams.get("isActive");
    const search = searchParams.get("search");

    const category =
      categoryParam && Object.values(ProductCategory).includes(categoryParam as ProductCategory)
        ? (categoryParam as ProductCategory)
        : null;

    if (categoryParam && !category) {
      return NextResponse.json(
        { success: false, message: "Invalid category filter" },
        { status: 400 }
      );
    }

    const where: Prisma.ProductWhereInput = {};
    if (locationId === "__ALL__") {
      where.locationId = null;
    } else if (locationId) {
      where.locationId = locationId;
    }
    if (category) where.category = category;
    if (isActiveParam === "true" || isActiveParam === "false") {
      where.isActive = isActiveParam === "true";
    }

    if (search?.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { slug: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: {
          location: {
            select: { id: true, name: true },
          },
          variants: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: products.map((product) => toAdminProductResponse(product)),
      meta: {
        page,
        limit,
        total,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/products error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load products" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = productFormSchema.parse(body);
    const data = normalizeProductData(parsed);

    const created = await prisma.product.create({
      data: {
        name: data.name,
        slug: data.slug,
        image: data.image,
        description: data.description,
        category: data.category,
        locationId: data.locationId,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
        variants: {
          create: data.variants.map((variant) => ({
            ...(variant.id ? { id: variant.id } : {}),
            label: variant.label,
            regularPrice: variant.regularPrice,
            salePrice: variant.salePrice,
            stock: variant.stock,
            isDefault: variant.isDefault,
            isActive: variant.isActive,
            sortOrder: variant.sortOrder,
          })),
        },
      },
      include: {
        location: {
          select: { id: true, name: true },
        },
        variants: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: toAdminProductResponse(created),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid product payload",
          errors: error.flatten(),
        },
        { status: 400 }
      );
    }

    console.error("POST /api/admin/products error:", error);
    return NextResponse.json(
      { success: false, message: getMutationErrorMessage(error) },
      { status: getMutationStatusCode(error) }
    );
  }
}

type UpdateBody = ProductFormValues & { id?: string };

export async function PATCH(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as UpdateBody;
    const id = body.id?.trim();

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Product id is required" },
        { status: 400 }
      );
    }

    const rest = { ...body };
    delete rest.id;
    const parsed = productFormSchema.parse(rest);
    const data = normalizeProductData(parsed);

    const existing = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        image: data.image,
        description: data.description,
        category: data.category,
        locationId: data.locationId,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
        variants: {
          deleteMany: {},
          create: data.variants.map((variant) => ({
            ...(variant.id ? { id: variant.id } : {}),
            label: variant.label,
            regularPrice: variant.regularPrice,
            salePrice: variant.salePrice,
            stock: variant.stock,
            isDefault: variant.isDefault,
            isActive: variant.isActive,
            sortOrder: variant.sortOrder,
          })),
        },
      },
      include: {
        location: {
          select: { id: true, name: true },
        },
        variants: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: toAdminProductResponse(updated),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid product payload",
          errors: error.flatten(),
        },
        { status: 400 }
      );
    }

    console.error("PATCH /api/admin/products error:", error);
    return NextResponse.json(
      { success: false, message: getMutationErrorMessage(error) },
      { status: getMutationStatusCode(error) }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id")?.trim();

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Product id is required" },
        { status: 400 }
      );
    }

    const linkedBookingItems = await prisma.bookingItem.findMany({
      where: {
        productId: id,
        booking: {
          OR: [
            { cancelledReason: null },
            { cancelledReason: { not: ADMIN_SOFT_DELETE_REASON } },
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        booking: {
          select: {
            bookingRef: true,
            bookingStatus: true,
          },
        },
      },
    });

    if (linkedBookingItems.length > 0) {
      const blockedBookingsByRef = new Map<string, BlockedBookingRef>();
      linkedBookingItems.forEach((item) => {
        const bookingRef = item.booking?.bookingRef?.trim() ?? "";
        const bookingStatus = item.booking?.bookingStatus;
        if (!bookingRef || !bookingStatus) return;
        if (!blockedBookingsByRef.has(bookingRef)) {
          blockedBookingsByRef.set(bookingRef, {
            bookingRef,
            bookingStatus,
          });
        }
      });

      const blockedBookings = Array.from(blockedBookingsByRef.values());
      const bookingRefs = blockedBookings.map((booking) => booking.bookingRef);

      return NextResponse.json(
        {
          success: false,
          message:
            bookingRefs.length > 0
              ? `Cannot delete this product because it is used in bookings ${bookingRefs.join(", ")}.`
            : "Cannot delete this product because it is already used in a booking.",
          bookingRefs,
          blockedBookings,
        },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Booking items from admin-soft-deleted bookings should not block product deletion.
      // We keep active/non-deleted booking protections above.
      await tx.bookingItem.deleteMany({
        where: {
          productId: id,
          booking: {
            cancelledReason: ADMIN_SOFT_DELETE_REASON,
          },
        },
      });

      await tx.product.delete({
        where: { id },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Cannot delete this product because it is still linked to active booking data.",
        },
        { status: 409 }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    console.error("DELETE /api/admin/products error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete product" },
      { status: 500 }
    );
  }
}
