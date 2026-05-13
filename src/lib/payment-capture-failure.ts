import type { BookingStatus, PaymentStatus } from "@prisma/client";

export const PAYMENT_CAPTURED_SESSION_EXPIRED_REASON =
  "PAYMENT_CAPTURED_SESSION_EXPIRED";
export const PAYMENT_CAPTURED_SLOT_UNAVAILABLE_REASON =
  "PAYMENT_CAPTURED_SLOT_UNAVAILABLE";

export const PAYMENT_CAPTURED_FAILURE_MODAL_TITLE =
  "Payment Received - Reservation Expired";
export const PAYMENT_CAPTURED_FAILURE_MODAL_MESSAGE =
  "Your payment was successful, but the reservation expired during payment processing. Our team will review the payment and process the refund shortly. You can restart the booking to select another available slot.";

export function isPaymentCapturedBookingFailureReason(
  value: string | null | undefined
) {
  return (
    value === PAYMENT_CAPTURED_SESSION_EXPIRED_REASON ||
    value === PAYMENT_CAPTURED_SLOT_UNAVAILABLE_REASON
  );
}

export function isPaymentCapturedBookingFailure(input: {
  bookingStatus?: BookingStatus | string | null;
  paymentStatus?: PaymentStatus | string | null;
  cancelledReason?: string | null;
}) {
  return (
    (
      input.bookingStatus === "PAID_EXPIRED" &&
      input.paymentStatus === "PAID"
    ) ||
    (
      input.bookingStatus === "ABANDONED" &&
      input.paymentStatus === "PAID" &&
      isPaymentCapturedBookingFailureReason(input.cancelledReason)
    )
  );
}

export function humanizePaymentCaptureFailureReason(
  value: string | null | undefined
) {
  switch (value) {
    case PAYMENT_CAPTURED_SESSION_EXPIRED_REASON:
      return "Payment received after session expiry";
    case PAYMENT_CAPTURED_SLOT_UNAVAILABLE_REASON:
      return "Payment received but slot became unavailable";
    default:
      return value ?? "Payment received but booking failed";
  }
}
