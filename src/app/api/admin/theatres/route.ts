import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { theatreSchema } from "@/components/admin/theatres/theatre.schema";
import { ZodError } from "zod";
import { formatIST } from "@/lib/formatters";
import { normalizeTheatreCardContent } from "@/lib/theatre-card-content";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

const THEATRE_SOFT_DELETE_PREFIX = "__DELETED__";

function isSoftDeletedTheatreName(name: string) {
  return name.startsWith(THEATRE_SOFT_DELETE_PREFIX);
}

function buildSoftDeletedTheatreName(id: string, name: string) {
  const trimmed = name.trim() || "Theatre";
  return `${THEATRE_SOFT_DELETE_PREFIX}${id}__${trimmed}`;
}
/* ====================
   GET — List theatres 
 =======================*/
export async function GET() {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const theatres = await prisma.theatre.findMany({
      where: {
        name: {
          not: {
            startsWith: THEATRE_SOFT_DELETE_PREFIX,
          },
        },
      },
      orderBy: { sortOrder: "asc" },
      include: {
        location: {
          select: { id: true, name: true },
        },
        slots: {
          where: {
            status: "AVAILABLE",
            date: { gte: new Date() },
          },
          orderBy: { finalPrice: "asc" },
          take: 1,
          select: { finalPrice: true },
        },
      },
    });

    const data = theatres.map((t, index) => ({
      srNo: index + 1,

      id: t.id,
      name: t.name,
      images: t.images.map((url) => ({
        url,
        type: url.endsWith(".mp4") || url.endsWith(".webm")
          ? "video"
          : "image",
      })),

      locationId: t.locationId,

      location: {
        id: t.location.id,
        name: t.location.name,
      },

      capacity: t.capacity,
      baseGuests: t.baseGuests,
      extraPersonPrice: t.extraPersonPrice,

      hasFood: t.hasFood,
      decorationPrice: t.decorationPrice,

      sortOrder: t.sortOrder,

      startingPrice: t.slots[0]?.finalPrice ?? null,

      footerMessage: t.footerMessage ?? null,
      mapUrl: t.mapUrl ?? null,
      menuFile: t.menuFile ?? null,
      cardContent: normalizeTheatreCardContent(t.cardContent),

      isActive: t.isActive,
      createdAt: t.createdAt.toISOString(),
      createdAtFormatted: formatIST(t.createdAt),
      updatedAt: t.updatedAt.toISOString(),
      updatedAtFormatted: formatIST(t.updatedAt),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("ADMIN_THEATRES_ERROR");
    console.error(
      error instanceof Error
        ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        }
        : error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch theatres",
        debug:
          process.env.NODE_ENV === "development"
            ? String(error)
            : undefined,
      },
      { status: 500 }
    );
  }

}

/* =====================================================
   POST — Create new theatre
 ===================================================== */
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

    // Validate using Zod
    const data = theatreSchema.parse(body);

    // Prevent duplicate theatre per location
    const exists = await prisma.theatre.findFirst({
      where: {
        name: data.name,
        locationId: data.locationId,
        NOT: {
          name: {
            startsWith: THEATRE_SOFT_DELETE_PREFIX,
          },
        },
      },
    });

    if (exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Theatre already exists for this location",
        },
        { status: 409 }
      );
    }

    const imageUrls = data.images?.map((img) => img.url) ?? [];
    const theatre = await prisma.theatre.create({
      data: {
        name: data.name,
        location: {
          connect: { id: data.locationId },
        },
        capacity: data.capacity,
        baseGuests: data.baseGuests,
        extraPersonPrice: data.extraPersonPrice,
        decorationPrice: data.decorationPrice,
        hasFood: data.hasFood,
        isActive: data.isActive,
        sortOrder: data.sortOrder ?? 0,
        images: imageUrls,

        footerMessage: data.footerMessage ?? null,
        mapUrl: data.mapUrl ?? null,
        menuFile: data.menuFile ?? null,
        cardContent: normalizeTheatreCardContent(data.cardContent),
      },
    });

    return NextResponse.json(
      { success: true, data: theatre },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("CREATE_THEATRE_ERROR", error);

    // Zod error handling
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid input",
          errors: error.flatten(),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to create theatre" },
      { status: 500 }
    );
  }
}

/* ==================================================
   PATCH — Update theatre
 ===================================================== */
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

    const { id, ...rest } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Theatre ID is required" },
        { status: 400 }
      );
    }

    const data = theatreSchema.parse(rest);

    const existing = await prisma.theatre.findFirst({
      where: {
        id,
        NOT: {
          name: {
            startsWith: THEATRE_SOFT_DELETE_PREFIX,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Theatre not found" },
        { status: 404 }
      );
    }

    // Check for unique constraint violation only if name or locationId is changing
    if (data.name || data.locationId) {
      const existingTheatre = await prisma.theatre.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { name: data.name },
            { locationId: data.locationId },
            {
              NOT: {
                name: {
                  startsWith: THEATRE_SOFT_DELETE_PREFIX,
                },
              },
            },
          ].filter(Boolean),
        },
      });

      if (existingTheatre) {
        return NextResponse.json(
          { success: false, message: "A theatre with this name already exists in the selected location" },
          { status: 400 }
        );
      }
    }

    const imageUrls = data.images?.map((img) => img.url) ?? [];
    const theatre = await prisma.theatre.update({
      where: { id },
      data: {
        name: data.name,
        location: {
          connect: { id: data.locationId },
        },
        capacity: data.capacity,
        baseGuests: data.baseGuests,
        extraPersonPrice: data.extraPersonPrice,
        decorationPrice: data.decorationPrice,
        hasFood: data.hasFood,
        isActive: data.isActive,
        sortOrder: data.sortOrder ?? 0,
        images: imageUrls,
        footerMessage: data.footerMessage ?? null,
        mapUrl: data.mapUrl ?? null,
        menuFile: data.menuFile ?? null,
        cardContent: normalizeTheatreCardContent(data.cardContent),
      },
    });

    // console.log("IMAGES BEFORE SAVE:", imageUrls);
    return NextResponse.json({ success: true, data: theatre });
  } catch (error: unknown) {
    console.error("UPDATE_THEATRE_ERROR", error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid input",
          errors: error.flatten(),
        },
        { status: 400 }
      );
    }

    // Handle Prisma unique constraint error
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { success: false, message: "A theatre with this name already exists in the selected location" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to update theatre" },
      { status: 500 }
    );
  }
}



/* =====================================================
  DELETE — Delete theatre
 ===================================================== */
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
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Theatre ID is required" },
        { status: 400 }
      );
    }

    const theatre = await prisma.theatre.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
      },
    });

    if (!theatre) {
      return NextResponse.json(
        {
          success: false,
          message: "Theatre not found",
        },
        { status: 404 }
      );
    }

    if (isSoftDeletedTheatreName(theatre.name)) {
      return NextResponse.json({
        success: true,
        message: "Theatre already deleted",
      });
    }

    await prisma.theatre.update({
      where: { id },
      data: {
        name: buildSoftDeletedTheatreName(theatre.id, theatre.name),
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Theatre deleted successfully",
    });
  } catch (error) {
    console.error("DELETE_THEATRE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete theatre" },
      { status: 500 }
    );
  }
}
