"use client";

import { toast } from "sonner";
import { BOOKING_ROUTES } from "@/constants/routes";
import type { BookingErrorResponse } from "@/types/booking-error";
import {
  BOOKING_SESSION_EXPIRED_MODAL_TITLE,
  BOOKING_SESSION_EXPIRED_MODAL_MESSAGE,
  emitBookingSessionExpired,
} from "@/lib/booking-session-expiry";
import {
  PAYMENT_CAPTURED_FAILURE_MODAL_MESSAGE,
  PAYMENT_CAPTURED_FAILURE_MODAL_TITLE,
} from "@/lib/payment-capture-failure";

type RouterLike = {
  replace: (href: string) => void;
};

type HandleBookingErrorOptions = {
  resetBooking?: () => void;
  fallbackMessage?: string;
  suppressUnhandledToast?: boolean;
};

export function handleBookingError(
  errorJson: BookingErrorResponse | null | undefined,
  router: RouterLike,
  options: HandleBookingErrorOptions = {}
) {
  const {
    resetBooking,
    fallbackMessage,
    suppressUnhandledToast = false,
  } = options;
  const code = errorJson?.code;
  const message = errorJson?.message;
  const severity = errorJson?.severity;
  const bookingRef = errorJson?.bookingRef;
  const successToken = errorJson?.successToken;
  const showToast = (
    level: "error" | "info" | "warning" | "success",
    toastMessage: string
  ) => {
    if (level === "info") {
      toast.info(toastMessage);
      return;
    }
    if (level === "warning") {
      toast.warning(toastMessage);
      return;
    }
    if (level === "success") {
      toast.success(toastMessage);
      return;
    }
    toast.error(toastMessage);
  };
  const startRedirectCountdown = ({
    prefix,
    destination,
    nextPath,
    toastId,
  }: {
    prefix: string;
    destination: string;
    nextPath: string;
    toastId: string;
  }) => {
    let seconds = 5;

    toast.error(`${prefix} Redirecting to the ${destination} in ${seconds}s.`, {
      id: toastId,
      duration: 1100,
    });

    const timer = window.setInterval(() => {
      seconds -= 1;

      if (seconds <= 0) {
        window.clearInterval(timer);
        router.replace(nextPath);
        return;
      }

      toast.error(
        `${prefix} Redirecting to the ${destination} in ${seconds}s.`,
        { id: toastId, duration: 1100 }
      );
    }, 1000);
  };

  const clearAndGoToRoot = (toastMessage: string) => {
    resetBooking?.();
    showToast("error", toastMessage);
    router.replace(BOOKING_ROUTES.ROOT);
  };

  switch (code) {
    case "BOOKING_FINALIZED": {
      toast.success("Booking is already confirmed.");
      if (successToken) {
        router.replace(
          `/booking/success?t=${encodeURIComponent(successToken)}`
        );
      } else {
        router.replace(BOOKING_ROUTES.ROOT);
      }
      return true;
    }
    case "BOOKING_NOT_FOUND": {
      clearAndGoToRoot("Booking not found. Please start again.");
      return true;
    }
    case "UNAUTHORIZED": {
      clearAndGoToRoot("This booking session is no longer valid.");
      return true;
    }
    case "SESSION_EXPIRED": {
      emitBookingSessionExpired({
        title:
          errorJson?.paymentCaptured
            ? PAYMENT_CAPTURED_FAILURE_MODAL_TITLE
            : errorJson?.title || BOOKING_SESSION_EXPIRED_MODAL_TITLE,
        message:
          message ||
          (errorJson?.paymentCaptured
            ? PAYMENT_CAPTURED_FAILURE_MODAL_MESSAGE
            : BOOKING_SESSION_EXPIRED_MODAL_MESSAGE),
      });
      return true;
    }
    case "SLOT_EXPIRED": {
      toast.error("Reservation expired, please try again.");
      router.replace(BOOKING_ROUTES.THEATRE);
      return true;
    }
    case "SLOT_ALREADY_BOOKED": {
      if (errorJson?.paymentCaptured) {
        emitBookingSessionExpired({
          title:
            errorJson.title || PAYMENT_CAPTURED_FAILURE_MODAL_TITLE,
          message:
            message || PAYMENT_CAPTURED_FAILURE_MODAL_MESSAGE,
        });
        return true;
      }
      toast.error(
        message || "This slot is already booked. Please choose another slot."
      );
      router.replace(BOOKING_ROUTES.ROOT);
      return true;
    }
    case "DUPLICATE_PAYMENT_ATTEMPT": {
      const nextPath = successToken
        ? `/booking/success?t=${encodeURIComponent(successToken)}`
        : BOOKING_ROUTES.ROOT;
      const prefix = successToken
        ? "This booking has already been confirmed."
        : "This payment has already been processed.";
      const destination = successToken
        ? "order success page"
        : "booking page";
      const toastId = successToken
        ? `duplicate-payment-${bookingRef ?? "confirmed"}`
        : "duplicate-payment-root";

      startRedirectCountdown({
        prefix,
        destination,
        nextPath,
        toastId,
      });
      return true;
    }
    case "PAYMENT_ALREADY_PROCESSED": {
      toast.error(message || "Payment is already processed.");
      router.replace(BOOKING_ROUTES.ROOT);
      return true;
    }
    case "BOOKING_INVALID_STATE": {
      const lowerMessage = (message ?? "").toLowerCase();
      const looksLikeExpiredSession =
        lowerMessage.includes("session") &&
        (lowerMessage.includes("expired") ||
          lowerMessage.includes("restart your booking"));

      if (looksLikeExpiredSession) {
        emitBookingSessionExpired({
          message: BOOKING_SESSION_EXPIRED_MODAL_MESSAGE,
        });
        return true;
      }

      toast.error(message || "Booking is not ready in its current state.");
      return true;
    }
    case "INVALID_PRODUCT_SELECTION":
    case "PRODUCT_LIMIT_EXCEEDED":
    case "PRODUCT_OUT_OF_STOCK": {
      toast.error(
        message || "Some selected add-ons are no longer available."
      );
      router.replace("/booking/extras/cake");
      return true;
    }
    default: {
      if (!suppressUnhandledToast) {
        showToast(
          severity === "info" || severity === "warning" ? severity : "error",
          message || fallbackMessage || "Something went wrong."
        );
      }
      return false;
    }
  }
}
