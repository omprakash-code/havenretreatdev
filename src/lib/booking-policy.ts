export const BOOKING_TIME_ZONE = "America/New_York";
export const BOOKING_INTERVAL_MINUTES = 30;
export const BOOKING_BUSINESS_OPEN_TIME = "09:00";
export const BOOKING_BUSINESS_CLOSE_TIME = "23:00";
export const BOOKING_BUFFER_MINUTES = 30;
export const BOOKING_HOLD_MINUTES = 30;
export const DEFAULT_MINIMUM_BOOKING_MINUTES = 4 * 60;

export const ACTIVE_RANGE_HOLD_STATUSES = [
  "INCOMPLETE",
  "AWAITING_PAYMENT",
  "PAYMENT_PROCESSING",
] as const;

export function getBookingHoldExpiry(now = new Date()) {
  return new Date(now.getTime() + BOOKING_HOLD_MINUTES * 60_000);
}
