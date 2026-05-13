import { error, success } from "@/lib/response";
import { getTheatreAvailabilityCounts } from "@/services/theatre.service";

import { resolveGuestLockOwnerToken } from "../_guest-token";

export async function GET(req: Request) {
  try {
    const guestToken = await resolveGuestLockOwnerToken();
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId");
    const date = searchParams.get("date");

    if (!locationId || !date) {
      return error("locationId and date are required", 400);
    }

    const counts = await getTheatreAvailabilityCounts(
      locationId,
      date,
      guestToken
    );

    return success({
      locationId,
      date,
      counts,
    });
  } catch (err) {
    console.error("Fetch theatre counts error:", err);
    return error("Failed to fetch theatre slot counts");
  }
}
