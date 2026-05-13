import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  incrementAdminSessionVersion,
  validateAdminSessionTokenAgainstDb,
} from "@/services/auth/adminAuth.server";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("ds_admin_session")?.value ?? "";

    if (token) {
      const session = await validateAdminSessionTokenAgainstDb(token);
      if (session) {
        await incrementAdminSessionVersion(session.userId);
      }
    }
  } catch (error) {
    console.error("ADMIN_LOGOUT_SESSION_REVOKE_ERROR", error);
  }

  const res = NextResponse.json({
    success: true,
    message: "Logged out successfully",
  });

  res.cookies.set({
    name: "ds_admin_session",
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0), // Explicit expiration
  });

  return res;
}
