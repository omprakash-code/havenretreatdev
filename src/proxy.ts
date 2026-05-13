import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSessionToken } from "@/services/auth/adminSession.server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminPage = pathname.startsWith("/admin");
  const isPublicAdminApi =
    pathname === "/api/admin/login" ||
    pathname === "/api/admin/session" ||
    pathname === "/api/admin/logout" ||
    (pathname.startsWith("/api/admin/theatres/upload/") &&
      req.method === "GET");

  if (pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  if (isAdminApi && !isPublicAdminApi) {
    const token = req.cookies.get("ds_admin_session")?.value;
    const session = token && verifyAdminSessionToken(token);

    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }
  }

  if (isAdminPage) {
    const token = req.cookies.get("ds_admin_session")?.value;
    const session = token && verifyAdminSessionToken(token);

    if (!session || session.role !== "ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}
export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
