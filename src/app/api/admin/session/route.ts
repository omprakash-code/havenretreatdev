import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validateAdminSessionTokenAgainstDb } from "@/services/auth/adminAuth.server";

function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: "ds_admin_session",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("ds_admin_session")?.value ?? "";

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const session = await validateAdminSessionTokenAgainstDb(token);
  if (!session) {
    const response = NextResponse.json(
      { authenticated: false },
      { status: 401 }
    );
    clearAdminSessionCookie(response);
    return response;
  }

  return NextResponse.json({ authenticated: true });
}
