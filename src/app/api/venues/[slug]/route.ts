// INACTIVE — EventAddon / Venue detail is not used in the active booking flow or admin.
// Set FEATURE_DISABLED to false to re-enable.
import { NextResponse } from "next/server";
import { getVenueBySlug } from "@/services/venue.service";

const FEATURE_DISABLED = true;
function featureDisabled() {
  return NextResponse.json({ success: false, code: "FEATURE_DISABLED" }, { status: 404 });
}

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_req: Request, context: RouteContext) {
  if (FEATURE_DISABLED) return featureDisabled();
  try {
    const { slug } = await context.params;
    const venue = await getVenueBySlug(slug);
    if (!venue) {
      return NextResponse.json({ success: false, message: "Venue not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: venue });
  } catch (cause) {
    console.error("GET /api/venues/[slug] error:", cause);
    return NextResponse.json({ success: false, message: "Failed to load venue." }, { status: 500 });
  }
}
