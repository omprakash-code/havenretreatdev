export type BookingErrorCode =
  | "BOOKING_NOT_FOUND"
  | "BOOKING_FINALIZED"
  | "BOOKING_INVALID_STATE"
  | "UNAUTHORIZED"
  | "SLOT_EXPIRED"
  | "SESSION_EXPIRED"
  | "INVALID_TOKEN"
  | "TOKEN_EXPIRED"
  | "DUPLICATE_PAYMENT_ATTEMPT"
  | "SLOT_ALREADY_BOOKED"
  | "PAYMENT_ALREADY_PROCESSED"
  | "INVALID_REQUEST"
  | "PAYMENT_VERIFICATION_FAILED"
  | "PAYMENT_ORDER_FAILED"
  | "COUPON_INVALID"
  | "COUPON_NOT_APPLICABLE"
  | "INVALID_PRODUCT_SELECTION"
  | "PRODUCT_LIMIT_EXCEEDED"
  | "PRODUCT_OUT_OF_STOCK"
  | "INTERNAL_ERROR";

export type BookingErrorResponse = {
  success?: boolean;
  code?: BookingErrorCode | string;
  message?: string;
  severity?: "error" | "info" | "warning";
  title?: string;
  paymentCaptured?: boolean;
  cancelledReason?: string;
  bookingRef?: string;
  successToken?: string;
};
