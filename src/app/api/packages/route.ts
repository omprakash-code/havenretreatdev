import { error, success } from "@/lib/response";
import { getEventPackages } from "@/services/package.service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId")?.trim() || undefined;
    const packages = await getEventPackages({ locationId });
    return success(packages);
  } catch (cause) {
    console.error("GET /api/packages error:", cause);
    return error("Failed to load packages");
  }
}
