import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";
//src/app/api/admin/theatres/toggle/route.ts
const THEATRE_SOFT_DELETE_PREFIX = "__DELETED__";

/* =====================================================
   PATCH — Toggle theatre active status
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

    const { id, isActive } = await req.json();

    if (!id || typeof isActive !== "boolean") {
      return NextResponse.json(
        { success: false, message: "Invalid payload" },
        { status: 400 }
      );
    }

    const result = await prisma.theatre.updateMany({
      where: {
        id,
        NOT: {
          name: {
            startsWith: THEATRE_SOFT_DELETE_PREFIX,
          },
        },
      },
      data: { isActive },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, message: "Theatre not found" },
        { status: 404 }
      );
    }

    const theatre = await prisma.theatre.findUnique({
      where: { id },
    });

    return NextResponse.json({ success: true, data: theatre });
  } catch (error) {
    console.error("TOGGLE_THEATRE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to update status" },
      { status: 500 }
    );
  }
}
