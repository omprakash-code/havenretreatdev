import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { validateAdminSessionTokenAgainstDb } from "@/services/auth/adminAuth.server";
import { isValidPhone, normalizePhone } from "@/lib/phone";

const PASSWORD_MASK = "********";

type AdminUserRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: "ADMIN";
  isActive: boolean;
  failedLoginAttempts: number;
  lockUntil: Date | null;
  sessionVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

function parseIssuedAt(token: string): Date | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const parts = decoded.split(".");
    const ts =
      parts.length === 5
        ? Number(parts[3])
        : parts.length === 4
          ? Number(parts[2])
          : Number.NaN;
    if (!Number.isFinite(ts)) return null;
    return new Date(ts);
  } catch {
    return null;
  }
}

async function getAuthenticatedAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("ds_admin_session")?.value;

  if (!token) return null;

  const session = await validateAdminSessionTokenAgainstDb(token);
  if (!session || session.role !== "ADMIN") return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      failedLoginAttempts: true,
      lockUntil: true,
      sessionVersion: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user || user.role !== "ADMIN") return null;

  return {
    token,
    issuedAt: parseIssuedAt(token),
    user: user as AdminUserRecord,
  };
}

async function toProfilePayload(
  user: AdminUserRecord,
  issuedAt: Date | null
) {
  const now = new Date();
  const isLocked =
    !user.isActive || Boolean(user.lockUntil && user.lockUntil > now);

  const totalBookingsManaged = await prisma.booking.count({
    where: { createdByAdminId: user.id },
  });

  return {
    fullName: user.name,
    email: user.email ?? "",
    phone: user.phone,
    passwordMask: PASSWORD_MASK,
    role: user.role,
    status: isLocked ? "LOCKED" : "ACTIVE",
    lastLoginAt: (issuedAt ?? user.updatedAt).toISOString(),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    failedLoginAttempts: user.failedLoginAttempts,
    sessionVersion: user.sessionVersion,
    totalBookingsManaged,
  };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET() {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const data = await toProfilePayload(admin.user, admin.issuedAt);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/admin/profile error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load profile." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as {
      fullName?: string;
      email?: string;
      phone?: string;
      password?: string;
    };

    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim();
    const normalizedPhone = normalizePhone(String(body.phone ?? ""));
    const password = typeof body.password === "string" ? body.password.trim() : "";

    if (fullName.length < 2) {
      return NextResponse.json(
        { success: false, message: "Enter a valid full name." },
        { status: 400 }
      );
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, message: "Enter a valid email address." },
        { status: 400 }
      );
    }

    if (!isValidPhone(normalizedPhone)) {
      return NextResponse.json(
        { success: false, message: "Enter a valid phone number." },
        { status: 400 }
      );
    }

    const data: Prisma.UserUpdateInput = {
      name: fullName,
      email,
      phone: normalizedPhone,
    };

    if (password && password !== PASSWORD_MASK) {
      if (password.length < 8) {
        return NextResponse.json(
          { success: false, message: "Password must be at least 8 characters." },
          { status: 400 }
        );
      }
      data.passwordHash = await bcrypt.hash(password, 12);
    }

    await prisma.user.update({
      where: { id: admin.user.id },
      data,
    });

    const refreshed = await prisma.user.findUnique({
      where: { id: admin.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        failedLoginAttempts: true,
        lockUntil: true,
        sessionVersion: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!refreshed || refreshed.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Profile not found." },
        { status: 404 }
      );
    }

    const payload = await toProfilePayload(
      refreshed as AdminUserRecord,
      admin.issuedAt
    );

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { success: false, message: "Phone number already exists." },
          { status: 409 }
        );
      }
    }

    console.error("PATCH /api/admin/profile error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update profile." },
      { status: 500 }
    );
  }
}
