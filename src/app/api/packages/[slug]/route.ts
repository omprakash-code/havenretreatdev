import { error, success } from "@/lib/response";
import { getEventPackageBySlug } from "@/services/package.service";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const eventPackage = await getEventPackageBySlug(slug);

    if (!eventPackage) {
      return error("Package not found", 404);
    }

    return success(eventPackage);
  } catch (cause) {
    console.error("GET /api/packages/[slug] error:", cause);
    return error("Failed to load package");
  }
}
