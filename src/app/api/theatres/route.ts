// src/app/api/theatres/route.ts
// API route to fetch theatres with available slots by location and date
// Also auto-unlocks expired slots before fetching
// Expects query parameters: locationId, date (YYYY-MM-DD)
// Returns JSON response with theatres and their available slots
// Example request: GET /api/theatres?locationId=loc123&date=2024-07-01
// Example response: { locationId: "loc123", date: "2024-07-01", theatres: [ ... ] }
// Error handling included for missing parameters and fetch failures
import {
  getTheatreCatalog,
  getTheatresWithSlots,
} from "@/services/theatre.service";
import { success, error } from "@/lib/response";
import { resolveGuestLockOwnerToken } from "./_guest-token";
import { parseTimeValue } from "@/lib/booking-time-range";

export async function GET(req: Request) {
  try {
    const guestToken = await resolveGuestLockOwnerToken();

    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId");
    const date = searchParams.get("date");
    const catalog = searchParams.get("catalog") === "1";
    const startTime = searchParams.get("startTime");
    const endTime = searchParams.get("endTime");

    if (!locationId || (!date && !catalog)) {
      return error("locationId and date are required", 400);
    }
    if (catalog) {
      const theatres = await getTheatreCatalog(locationId);

      return success({
        locationId,
        theatres,
      });
    }
    if (
      (startTime || endTime) &&
      (parseTimeValue(startTime) === null || parseTimeValue(endTime) === null)
    ) {
      return error("startTime and endTime must use HH:mm format", 400);
    }

    const theatres = await getTheatresWithSlots(locationId, date!, guestToken, {
      startTime,
      endTime,
    });

    return success({
      locationId,
      date,
      theatres,
    });
  } catch (err) {
    console.error("Fetch theatres error:", err);
    return error("Failed to fetch theatres");
  }
}
