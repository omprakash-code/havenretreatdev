export const RESERVATION_TIMED_OUT_MESSAGE =
  "Your reservation timed out. Please select the slot again.";
export const BOOKING_SESSION_EXPIRED_MODAL_TITLE = "Session Expired";
export const BOOKING_SESSION_EXPIRED_MODAL_MESSAGE =
  "Your reservation has timed out. Please restart your booking to continue.";

export const BOOKING_SESSION_EXPIRED_EVENT = "booking:session-expired";
const BOOKING_SESSION_EXPIRED_STORAGE_KEY = "ds_booking_session_expired_notice";
const PAYMENT_PAGE_BLOCKED_NOTICE_STORAGE_KEY =
  "ds_payment_page_blocked_notice";

type BookingSessionExpiredDetail = {
  title?: string;
  message?: string;
};

type PaymentPageBlockedNotice = {
  bookingId: string;
  title?: string;
  message: string;
};

export function emitBookingSessionExpired(detail?: BookingSessionExpiredDetail) {
  if (typeof window === "undefined") return;
  const payload = {
    title: detail?.title || BOOKING_SESSION_EXPIRED_MODAL_TITLE,
    message: detail?.message || BOOKING_SESSION_EXPIRED_MODAL_MESSAGE,
  };
  window.sessionStorage.setItem(
    BOOKING_SESSION_EXPIRED_STORAGE_KEY,
    JSON.stringify(payload)
  );
  window.dispatchEvent(
    new CustomEvent<BookingSessionExpiredDetail>(BOOKING_SESSION_EXPIRED_EVENT, {
      detail: payload,
    })
  );
}

export function consumeBookingSessionExpiredNotice() {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(
    BOOKING_SESSION_EXPIRED_STORAGE_KEY
  );
  if (!raw) return null;
  window.sessionStorage.removeItem(BOOKING_SESSION_EXPIRED_STORAGE_KEY);
  try {
    const parsed = JSON.parse(raw) as BookingSessionExpiredDetail | null;
    if (!parsed?.message) return null;
    return {
      title: parsed.title || BOOKING_SESSION_EXPIRED_MODAL_TITLE,
      message: parsed.message,
    };
  } catch {
    return {
      title: BOOKING_SESSION_EXPIRED_MODAL_TITLE,
      message: raw,
    };
  }
}

export function persistPaymentPageBlockedNotice(
  detail: PaymentPageBlockedNotice
) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    PAYMENT_PAGE_BLOCKED_NOTICE_STORAGE_KEY,
    JSON.stringify(detail)
  );
}

export function getPaymentPageBlockedNotice(bookingId?: string | null) {
  if (typeof window === "undefined" || !bookingId) return null;
  const raw = window.sessionStorage.getItem(
    PAYMENT_PAGE_BLOCKED_NOTICE_STORAGE_KEY
  );
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PaymentPageBlockedNotice | null;
    if (!parsed?.message || parsed.bookingId !== bookingId) return null;
    return {
      bookingId: parsed.bookingId,
      title: parsed.title || BOOKING_SESSION_EXPIRED_MODAL_TITLE,
      message: parsed.message,
    };
  } catch {
    return null;
  }
}

export function clearPaymentPageBlockedNotice() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PAYMENT_PAGE_BLOCKED_NOTICE_STORAGE_KEY);
}
