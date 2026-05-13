// src/types/booking.ts

export type BookingStatus =
  | "INCOMPLETE"
  | "AWAITING_PAYMENT"
  | "PAYMENT_PROCESSING"
  | "CONFIRMED"
  | "ABANDONED"
  | "PAID_EXPIRED"
  | "CANCELLED";

export type PaymentStatus =
  | "INITIALIZED"
  | "AWAITING_PAYMENT"
  | "PAID"
  | "FAILED"
  | "EXPIRED"
  | "OFFLINE";

export type Booking = {
  id: string;
  bookingRef: string;

  user?: {
    name: string;
    phone: string;
  };

  theatre: {
    id: string;
    name: string;
  };

  slot: {
    date: string;
    startTime: string;
    endTime: string;
  };

  guestCount: number;
  extrasCount: number;

  amount: number;
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;

  createdAt: string;
};
