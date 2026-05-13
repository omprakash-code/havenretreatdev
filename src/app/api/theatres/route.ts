// src/app/api/theatres/route.ts
// API route to fetch theatres with available slots by location and date
// Also auto-unlocks expired slots before fetching
// Expects query parameters: locationId, date (YYYY-MM-DD)
// Returns JSON response with theatres and their available slots
// Example request: GET /api/theatres?locationId=loc123&date=2024-07-01
// Example response: { locationId: "loc123", date: "2024-07-01", theatres: [ ... ] }
// Error handling included for missing parameters and fetch failures
import { getTheatresWithSlots } from "@/services/theatre.service";
import { success, error } from "@/lib/response";
import { resolveGuestLockOwnerToken } from "./_guest-token";

export async function GET(req: Request) {
  try {
    const guestToken = await resolveGuestLockOwnerToken();

    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId");
    const date = searchParams.get("date");

    if (!locationId || !date) {
      return error("locationId and date are required", 400);
    }

    const theatres = await getTheatresWithSlots(locationId, date, guestToken);

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
