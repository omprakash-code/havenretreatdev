import { describe, expect, it, vi, beforeEach } from "vitest";

const { emitBookingSessionExpiredMock } = vi.hoisted(() => ({
  emitBookingSessionExpiredMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/lib/booking-session-expiry", () => ({
  BOOKING_SESSION_EXPIRED_MODAL_TITLE: "Session Expired",
  BOOKING_SESSION_EXPIRED_MODAL_MESSAGE:
    "Your reservation has timed out. Please restart your booking to continue.",
  emitBookingSessionExpired: emitBookingSessionExpiredMock,
}));

vi.mock("@/lib/payment-capture-failure", () => ({
  PAYMENT_CAPTURED_FAILURE_MODAL_TITLE: "Payment Received",
  PAYMENT_CAPTURED_FAILURE_MODAL_MESSAGE:
    "We received your payment, but this booking could not be confirmed. Our team will process your refund shortly. You can restart booking.",
}));

import { toast } from "sonner";
import { handleBookingError } from "@/utils/handleBookingError";

function createRouter() {
  return {
    replace: vi.fn(),
  };
}

describe("handleBookingError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears state and redirects to root on BOOKING_NOT_FOUND", () => {
    const router = createRouter();
    const resetBooking = vi.fn();

    const handled = handleBookingError(
      {
        code: "BOOKING_NOT_FOUND",
        message: "Booking missing",
      },
      router,
      { resetBooking }
    );

    expect(handled).toBe(true);
    expect(resetBooking).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(
      "Booking not found. Please start again."
    );
    expect(router.replace).toHaveBeenCalledWith("/booking");
  });

  it("redirects to success on BOOKING_FINALIZED with successToken", () => {
    const router = createRouter();

    const handled = handleBookingError(
      {
        code: "BOOKING_FINALIZED",
        bookingRef: "DS/ABC 123",
        successToken: "secure-token-123",
      },
      router
    );

    expect(handled).toBe(true);
    expect(toast.success).toHaveBeenCalledWith(
      "Booking is already confirmed."
    );
    expect(router.replace).toHaveBeenCalledWith(
      "/booking/success?t=secure-token-123"
    );
  });

  it("redirects to theatre on SLOT_EXPIRED", () => {
    const router = createRouter();

    const handled = handleBookingError(
      {
        code: "SLOT_EXPIRED",
      },
      router
    );

    expect(handled).toBe(true);
    expect(toast.error).toHaveBeenCalledWith(
      "Reservation expired, please try again."
    );
    expect(router.replace).toHaveBeenCalledWith("/booking/theatre");
  });

  it("returns false and shows fallback for unknown code", () => {
    const router = createRouter();

    const handled = handleBookingError(
      {
        code: "SOMETHING_NEW",
      },
      router,
      { fallbackMessage: "Custom fallback" }
    );

    expect(handled).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Custom fallback");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("shows info toast for informational coupon guidance", () => {
    const router = createRouter();

    const handled = handleBookingError(
      {
        code: "COUPON_NOT_APPLICABLE",
        severity: "info",
        message:
          "This coupon is available only when decoration is selected for the booking.",
      },
      router
    );

    expect(handled).toBe(false);
    expect(toast.info).toHaveBeenCalledWith(
      "This coupon is available only when decoration is selected for the booking."
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("returns false without showing toast when suppressUnhandledToast is true", () => {
    const router = createRouter();

    const handled = handleBookingError(
      {
        code: "SOMETHING_NEW",
      },
      router,
      {
        fallbackMessage: "Custom fallback",
        suppressUnhandledToast: true,
      }
    );

    expect(handled).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("emits payment-received modal for SESSION_EXPIRED when payment was captured", () => {
    const router = createRouter();

    const handled = handleBookingError(
      {
        code: "SESSION_EXPIRED",
        paymentCaptured: true,
      },
      router
    );

    expect(handled).toBe(true);
    expect(emitBookingSessionExpiredMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Payment Received",
      })
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("emits payment-received modal for SLOT_ALREADY_BOOKED when payment was captured", () => {
    const router = createRouter();

    const handled = handleBookingError(
      {
        code: "SLOT_ALREADY_BOOKED",
        paymentCaptured: true,
      },
      router
    );

    expect(handled).toBe(true);
    expect(emitBookingSessionExpiredMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Payment Received",
      })
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
