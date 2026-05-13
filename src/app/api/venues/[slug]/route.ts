import { error, success } from "@/lib/response";
import { getVenueBySlug } from "@/services/venue.service";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const venue = await getVenueBySlug(slug);

    if (!venue) {
      return error("Venue not found", 404);
    }

    return success(venue);
  } catch (cause) {
    console.error("GET /api/venues/[slug] error:", cause);
    return error("Failed to load venue");
  }
}
