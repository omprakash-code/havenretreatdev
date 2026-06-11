import { NextResponse } from "next/server";

const SESSION_COOKIE_NAMES = [
  "ds_booking_session",
  "ds_lock_owner",
  "ds_prebooking",
] as const;

export async function POST() {
  const response = NextResponse.json({ success: true });

  SESSION_COOKIE_NAMES.forEach((name) => {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  });

  return response;
}
