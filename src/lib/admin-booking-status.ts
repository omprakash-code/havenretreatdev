import type { BookingStatus, PaymentStatus } from "@prisma/client";
import { isPaymentCapturedBookingFailure } from "@/lib/payment-capture-failure";

export const PAYMENT_STEP_ABANDONED_REASON = "PAYMENT_STEP_ABANDONED";
export const PAYMENT_CHECKOUT_ABANDONED_REASON = "PAYMENT_CHECKOUT_ABANDONED";

export function isPaymentStageAbandoned(input: {
  bookingStatus?: BookingStatus | string | null;
  cancelledReason?: string | null;
}) {
  return (
    input.bookingStatus === "ABANDONED" &&
    (input.cancelledReason === PAYMENT_STEP_ABANDONED_REASON ||
      input.cancelledReason === PAYMENT_CHECKOUT_ABANDONED_REASON)
  );
}

export function getAdminBookingStatusDisplay(input: {
  bookingStatus?: BookingStatus | string | null;
  paymentStatus?: PaymentStatus | string | null;
  cancelledReason?: string | null;
}) {
  if (
    isPaymentCapturedBookingFailure({
      bookingStatus: input.bookingStatus,
      paymentStatus: input.paymentStatus,
      cancelledReason: input.cancelledReason,
    })
  ) {
    return {
      label: "PAID - EXPIRED",
      title: "PAID - EXPIRED",
      className: "bg-amber-50 text-amber-900 border border-amber-300",
    };
  }

  if (
    isPaymentStageAbandoned({
      bookingStatus: input.bookingStatus,
      cancelledReason: input.cancelledReason,
    })
  ) {
    return {
      label: "PAY ABANDONED",
      title: "PAY ABANDONED",
      className: "bg-orange-50 text-orange-800 border border-orange-300",
    };
  }

  return null;
}
