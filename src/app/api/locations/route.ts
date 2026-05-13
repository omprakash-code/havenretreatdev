// src/app/api/locations/route.ts
// read-only for users to get list of active locations
// Used in booking flow to select location


import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const locations = await prisma.location.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        sortOrder: "asc",
      },
      select: {
        id: true,
        name: true,
        city: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: locations,
    });
  } catch (error) {
    console.error("GET /api/locations error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to load locations" },
      { status: 500 }
    );
  }
}
