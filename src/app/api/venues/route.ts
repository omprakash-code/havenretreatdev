// INACTIVE — EventAddon / Venue detail is not used in the active booking flow or admin.
// Set FEATURE_DISABLED to false to re-enable.
import { NextResponse } from "next/server";
import { getVenues } from "@/services/venue.service";

const FEATURE_DISABLED = true;
function featureDisabled() {
  return NextResponse.json({ success: false, code: "FEATURE_DISABLED" }, { status: 404 });
}

export async function GET() {
  if (FEATURE_DISABLED) return featureDisabled();
  try {
    const venues = await getVenues();
    return NextResponse.json({ success: true, data: venues });
  } catch (cause) {
    console.error("GET /api/venues error:", cause);
    return NextResponse.json({ success: false, message: "Failed to load venues." }, { status: 500 });
  }
}
