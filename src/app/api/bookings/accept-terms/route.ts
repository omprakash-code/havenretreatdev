// src/app/api/bookings/accept-terms/route.ts
//
// Legacy alias for the public agreement step, which now submits the booking for
// admin review instead of handing off to payment. The booking client posts to
// /api/bookings/submit; this route stays so an already-loaded tab cannot move a
// booking to AWAITING_PAYMENT after the payment step was retired.
//
// The response is a superset of the old `{ success: true }` payload.
export { POST } from "@/app/api/bookings/submit/route";
