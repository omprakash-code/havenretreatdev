import { NextResponse } from "next/server";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

export async function GET(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    void req;

    return NextResponse.json({ success: true, data: [] });
  } catch (error) {
    console.error("[COUPON_SLOT_OPTIONS]", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch slot options" },
      { status: 500 }
    );
  }
}
