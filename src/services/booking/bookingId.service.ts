// src/services/booking/bookingId.service.ts  
/* ---------------------------------
    Generate Booking Reference
  ---------------------------------- */
  // Format: HRDDMMYYYYXXXX
  // Where: DD = Day, MM = Month, YYYY = Year, XXXX = Daily counter
  // Example: HR050920230001

export function generateBookingRef(
  date: Date,
  dailyCount: number
) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();

  const counter = String(dailyCount).padStart(4, "0");

  return `HR${dd}${mm}${yyyy}${counter}`;
}
