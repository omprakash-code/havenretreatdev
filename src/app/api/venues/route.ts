import { error, success } from "@/lib/response";
import { getVenues } from "@/services/venue.service";

export async function GET() {
  try {
    const venues = await getVenues();
    return success(venues);
  } catch (cause) {
    console.error("GET /api/venues error:", cause);
    return error("Failed to load venues");
  }
}
