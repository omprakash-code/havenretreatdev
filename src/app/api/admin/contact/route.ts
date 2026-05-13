import { ContactInquiryStatus } from "@prisma/client";
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

    const status = Object.values(ContactInquiryStatus).includes(
      statusInput as ContactInquiryStatus
    )
      ? (statusInput as ContactInquiryStatus)
      : null;

    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { id: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
              { mobile: { contains: search, mode: "insensitive" as const } },
              { message: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.contactInquiry.count({ where }),
      prisma.contactInquiry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        mobile: row.mobile,
        message: row.message,
        status: row.status,
        isRead: row.isRead,
        respondedAt: row.respondedAt?.toISOString() ?? null,
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
    console.error("GET /api/admin/contact error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch contact inquiries." },
      { status: 500 }
    );
  }
}
