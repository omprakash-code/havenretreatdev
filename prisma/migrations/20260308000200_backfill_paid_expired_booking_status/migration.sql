UPDATE "Booking"
SET "bookingStatus" = 'PAID_EXPIRED'
WHERE "bookingStatus" = 'ABANDONED'
  AND "paymentStatus" = 'PAID'
  AND "cancelledReason" IN (
    'PAYMENT_CAPTURED_SESSION_EXPIRED',
    'PAYMENT_CAPTURED_SLOT_UNAVAILABLE'
  );
