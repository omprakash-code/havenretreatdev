import { WaitlistStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

async function getAuthenticatedAdminId() {
  return getAuthenticatedAdminIdFromCookies();
}

export async function GET(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(
      Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
      1
    );
    const rawPageSize =
      Number.parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) ||
      DEFAULT_PAGE_SIZE;
    const pageSize = Math.min(Math.max(rawPageSize, 1), MAX_PAGE_SIZE);

    const statusInput = searchParams.get("status")?.trim() ?? "";
    const search = searchParams.get("search")?.trim() ?? "";

    const status = Object.values(WaitlistStatus).includes(
      statusInput as WaitlistStatus
    )
      ? (statusInput as WaitlistStatus)
      : null;

    const [total, rows] = await Promise.all([
      prisma.waitlistEntry.count({
        where: {
          ...(status ? { status } : {}),
          ...(search
            ? {
                OR: [
                  { reference: { contains: search, mode: "insensitive" } },
                  { name: { contains: search, mode: "insensitive" } },
                  { phone: { contains: search, mode: "insensitive" } },
                  { email: { contains: search, mode: "insensitive" } },
                  { city: { contains: search, mode: "insensitive" } },
                  { locationPreference: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
      }),
      prisma.waitlistEntry.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(search
            ? {
                OR: [
                  { reference: { contains: search, mode: "insensitive" } },
                  { name: { contains: search, mode: "insensitive" } },
                  { phone: { contains: search, mode: "insensitive" } },
                  { email: { contains: search, mode: "insensitive" } },
                  { city: { contains: search, mode: "insensitive" } },
                  { locationPreference: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        reference: row.reference,
        name: row.name,
        phone: row.phone,
        email: row.email,
        city: row.city,
        locationPreference: row.locationPreference,
        theatrePreference: row.theatrePreference,
        preferredDate: row.preferredDate?.toISOString() ?? null,
        preferredTime: row.preferredTime,
        peopleCount: row.peopleCount,
        occasion: row.occasion,
        notes: row.notes,
        status: row.status,
        contactedAt: row.contactedAt?.toISOString() ?? null,
        closedAt: row.closedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
      },
    });
  } catch (error) {
    console.error("GET /api/admin/waitlist error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch waiting list entries." },
      { status: 500 }
    );
  }
}
