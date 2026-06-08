import { NextResponse } from "next/server";

import {
  BookingSettingsValidationError,
  bookingSettingsUpdateSchema,
  getOrCreateBookingSettings,
  updateBookingSettings,
} from "@/services/booking/booking-settings.service";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

function errorResponse(status: number, message: string) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function GET(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) return errorResponse(401, "Unauthorized");

    const theatreId = new URL(req.url).searchParams.get("theatreId")?.trim();
    if (!theatreId) return errorResponse(400, "theatreId is required.");

    const settings = await getOrCreateBookingSettings(theatreId);
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof BookingSettingsValidationError) {
      return errorResponse(400, error.message);
    }
    console.error("[GET_ADMIN_BOOKING_SETTINGS]", error);
    return errorResponse(500, "Failed to load booking settings.");
  }
}

export async function PATCH(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) return errorResponse(401, "Unauthorized");

    const body = await req.json().catch(() => null);
    const theatreId =
      typeof body?.theatreId === "string" ? body.theatreId.trim() : "";
    if (!theatreId) return errorResponse(400, "theatreId is required.");

    const parsed = bookingSettingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(400, parsed.error.issues[0]?.message ?? "Invalid settings.");
    }

    const settings = await updateBookingSettings(theatreId, parsed.data);
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof BookingSettingsValidationError) {
      return errorResponse(400, error.message);
    }
    console.error("[PATCH_ADMIN_BOOKING_SETTINGS]", error);
    return errorResponse(500, "Failed to update booking settings.");
  }
}
