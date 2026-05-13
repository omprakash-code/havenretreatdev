import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  incrementAdminSessionVersion,
  validateAdminSessionTokenAgainstDb,
} from "@/services/auth/adminAuth.server";

async function getAuthenticatedAdminWithPassword() {
  const cookieStore = await cookies();
  const token = cookieStore.get("ds_admin_session")?.value;

  if (!token) return null;

  const session = await validateAdminSessionTokenAgainstDb(token);
  if (!session || session.role !== "ADMIN") return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      role: true,
      passwordHash: true,
    },
  });

  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function PATCH(req: Request) {
  try {
    const admin = await getAuthenticatedAdminWithPassword();
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    const currentPassword = String(body.currentPassword ?? "").trim();
    const newPassword = String(body.newPassword ?? "").trim();
    const confirmPassword = String(body.confirmPassword ?? "").trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, message: "All password fields are required." },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        {
          success: false,
          message: "New password must be at least 8 characters.",
        },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Passwords do not match." },
        { status: 400 }
      );
    }

    if (!admin.passwordHash) {
      return NextResponse.json(
        { success: false, message: "Password is not set for this account." },
        { status: 400 }
      );
    }

    const currentMatches = await bcrypt.compare(
      currentPassword,
      admin.passwordHash
    );
    if (!currentMatches) {
      return NextResponse.json(
        { success: false, message: "Current password is incorrect." },
        { status: 401 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash },
    });
    await incrementAdminSessionVersion(admin.id);

    const response = NextResponse.json({
      success: true,
      message: "Password updated successfully. Please login again.",
    });

    response.cookies.set({
      name: "ds_admin_session",
      value: "",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    console.error("PATCH /api/admin/profile/password error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update password." },
      { status: 500 }
    );
  }
}
