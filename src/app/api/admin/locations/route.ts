import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { locationSchema } from "@/components/admin/location/location.schema";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 40;
const MAX_PAGE_SIZE = 100;

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(Math.trunc(parsed), 1);
}

function normalizeLocationData(input: {
  name: string;
  city: string;
  sortOrder: number;
  isActive: boolean;
}) {
  return {
    name: input.name.trim(),
    city: input.city.trim(),
    sortOrder: Math.trunc(input.sortOrder),
    isActive: Boolean(input.isActive),
  };
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
    const page = parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE);
    const pageSize = Math.min(
      parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    );
    const search = searchParams.get("search")?.trim() ?? "";
    const isActiveParam = searchParams.get("isActive");
    const skip = (page - 1) * pageSize;

    const where: Prisma.LocationWhereInput = {};

    if (isActiveParam === "true" || isActiveParam === "false") {
      where.isActive = isActiveParam === "true";
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.location.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          city: true,
          isActive: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              theatres: true,
              products: true,
              coupons: true,
            },
          },
        },
      }),
      prisma.location.count({ where }),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: rows.map((row) => ({
          id: row.id,
          name: row.name,
          city: row.city,
          isActive: row.isActive,
          sortOrder: row.sortOrder,
          theatresCount: row._count.theatres,
          productsCount: row._count.products,
          couponsCount: row._count.coupons,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(Math.ceil(total / pageSize), 1),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/admin/locations error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch locations." },
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
    const parsed = locationSchema.parse(body);
    const data = normalizeLocationData(parsed);

    const exists = await prisma.location.findFirst({
      where: {
        name: {
          equals: data.name,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (exists) {
      return NextResponse.json(
        { success: false, message: "Location with this name already exists." },
        { status: 409 }
      );
    }

    const created = await prisma.location.create({
      data,
      select: { id: true },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Location created successfully.",
        data: { id: created.id },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid location payload.",
          errors: error.flatten(),
        },
        { status: 400 }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { success: false, message: "Location with this name already exists." },
        { status: 409 }
      );
    }

    console.error("POST /api/admin/locations error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create location." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const id = String(body?.id ?? "").trim();

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Location ID is required." },
        { status: 400 }
      );
    }

    const parsed = locationSchema.parse(body);
    const data = normalizeLocationData(parsed);

    const existing = await prisma.location.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Location not found." },
        { status: 404 }
      );
    }

    const duplicate = await prisma.location.findFirst({
      where: {
        id: { not: id },
        name: {
          equals: data.name,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json(
        { success: false, message: "Location with this name already exists." },
        { status: 409 }
      );
    }

    await prisma.location.update({
      where: { id },
      data,
      select: { id: true },
    });

    return NextResponse.json({
      success: true,
      message: "Location updated successfully.",
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid location payload.",
          errors: error.flatten(),
        },
        { status: 400 }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { success: false, message: "Location with this name already exists." },
        { status: 409 }
      );
    }

    console.error("PATCH /api/admin/locations error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update location." },
      { status: 500 }
    );
  }
}
