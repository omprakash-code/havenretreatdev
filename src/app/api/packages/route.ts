import { error, success } from "@/lib/response";
import { getEventPackages } from "@/services/package.service";

export async function GET() {
  try {
    const packages = await getEventPackages();
    return success(packages);
  } catch (cause) {
    console.error("GET /api/packages error:", cause);
    return error("Failed to load packages");
  }
}
