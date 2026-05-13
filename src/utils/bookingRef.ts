/**
 * Generates human-readable booking reference
 * Format: HRDDMMYYYYXXXX
 * Example: HR221220250001
 *
 * NOTE:
 * Counter logic can be upgraded later (per-day/per-location)
 */
export function generateBookingRef() {
  const now = new Date();

  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();

  const random = Math.floor(1000 + Math.random() * 9000);

  return `HR${dd}${mm}${yyyy}${random}`;
}
