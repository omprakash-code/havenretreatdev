//src/types/admin/booking-admin.ts
import type { BookingStatus, PaymentStatus } from "@prisma/client";

export type AdminBookingItem = {
  id: string;
  productName: string;
  variantLabel: string;
  productImage: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  image: string | null;
  category: string;
  ledNumber?: string | null;
};

export type AdminBooking = {
  id: string;
  bookingRef: string;

  customer: {
    name: string;
    phone: string;
    email: string | null;
  } | null;

  theatre: {
    id: string;
    name: string;
    locationName?: string | null;
  };

  slot: {
    date: string;
    startTime: string;
    endTime: string;
    status: string;
  };

  guestCount: number;

  pricing: {
    base: number;
    extras: number;
    products: number;
    decoration: number;
    discount: number;
    total: number;
    advancePaid: number;
    remainingPayable: number;
  };

  items: AdminBookingItem[];

  occasionLabel: string | null;
  occasionKey: string | null;
  occasionData: Record<string, unknown> | null;

  confirmationEmailSent: boolean;
  abandonmentCustomerEmailSentAt: string | null;
  abandonmentAdminEmailSentAt: string | null;
  termsAcceptedAt: string | null;

  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paymentDetails: {
    provider: string;
    method: string | null;
    transactionId: string | null;
    amount: number;
    status: PaymentStatus;
    createdAt: string;
    recordedByAdminId: string | null;
  } | null;
  createdByRole: string | null;
  createdByAdminId: string | null;

  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  cancelledReason: string | null;
  appliedCouponCode?: string | null;
  appliedCoupons?: Array<{
    couponId: string;
    code: string;
    discountAmount: number;
    status: string;
  }>;

  createdAt: string;
};
