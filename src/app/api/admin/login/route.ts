import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/db";
import { createAdminSessionToken } from "@/services/auth/adminSession.server";
import { checkRateLimit } from "@/lib/admin/auth/rateLimiter";
import { normalizePhone, isValidPhone } from "@/lib/phone";

/* --------------------------------
   CONFIG
-------------------------------- */
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours
const BRUTE_DELAY_MS = 500;

/* --------------------------------
   ERROR CODES
-------------------------------- */
const ERROR_CODES = {
  INVALID: "INV",
  LOCKED: "LOCK",
  RATE_LIMIT: "RATE",
  SYSTEM: "SYS",
} as const;

/* --------------------------------
   POST /api/admin/login
-------------------------------- */
export async function POST(req: Request) {
  try {
    /* -----------------------------
       Extract Client IP
    ------------------------------ */
    const forwarded = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");

    const ip =
      forwarded?.split(",")[0]?.trim() ||
      realIp ||
      "unknown";

    /* -----------------------------
       Rate Limit (IP Level)
    ------------------------------ */
    const rate = checkRateLimit(ip);

    if (!rate.allowed) {
      return errorResponse(ERROR_CODES.RATE_LIMIT, 429);
    }

    /* -----------------------------
       Parse Native Form
    ------------------------------ */
    const formData = await req.formData();

    const phoneRaw = String(formData.get("phone") ?? "");
    const phone = normalizePhone(phoneRaw);

    const password = String(formData.get("password") ?? "").trim();

    const scopedRate = checkRateLimit(`${ip}:${phone}`);
    if (!scopedRate.allowed) {
      return errorResponse(ERROR_CODES.RATE_LIMIT, 429);
    }

    if (!isValidPhone(phone) || !password) {
      await delay();
      return errorResponse(ERROR_CODES.INVALID, 401);
    }

    /* -----------------------------
       Find User
    ------------------------------ */
    const user = await prisma.user.findFirst({
      where: {
        phone,
        role: "ADMIN",
        isActive: true,
      },
    });

    if (!user || !user.passwordHash) {
      await delay();
      return errorResponse(ERROR_CODES.INVALID, 401);
    }

    /* -----------------------------
       Account Lock Check
    ------------------------------ */
    if (user.lockUntil && user.lockUntil > new Date()) {
      return errorResponse(ERROR_CODES.LOCKED, 403);
    }

    /* -----------------------------
       Password Verify
    ------------------------------ */
    const passwordMatch = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatch) {
      const attempts = user.failedLoginAttempts + 1;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockUntil:
            attempts >= MAX_FAILED_ATTEMPTS
              ? new Date(Date.now() + LOCK_DURATION_MS)
              : user.lockUntil,
        },
      });

      await delay();
      return errorResponse(ERROR_CODES.INVALID, 401);
    }

    /* -----------------------------
       Reset Lock & Attempts
    ------------------------------ */
    const refreshedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockUntil: null,
      },
      select: {
        id: true,
        role: true,
        sessionVersion: true,
      },
    });

    /* -----------------------------
       Create Secure Session
    ------------------------------ */
    const token = createAdminSessionToken(
      refreshedUser.id,
      refreshedUser.role,
      refreshedUser.sessionVersion
    );

    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );

    response.cookies.set({
      name: "ds_admin_session",
      value: token,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error("ADMIN_LOGIN_ERROR", error);
    return errorResponse(ERROR_CODES.SYSTEM, 500);

  }
}

/* --------------------------------
   Helpers
-------------------------------- */
function errorResponse(code: string, status = 401) {
  return NextResponse.json(
    { success: false, code },
    { status }
  );
}

function delay(ms: number = BRUTE_DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
