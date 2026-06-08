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
    timezone?: string | null;
    locationName?: string | null;
  };
  package?: {
    id: string | null;
    name: string;
  } | null;
  locationName?: string | null;
  theatreImage?: string | null;

  eventDate?: string | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  startsAtUtc?: string | null;
  endsAtUtc?: string | null;
  timezone?: string | null;
  schedule?: {
    source: "BOOKING" | "SLOT" | "MISSING";
    date: string;
    startTime: string;
    endTime: string;
    dateLabel: string;
    timeLabel: string;
    dateTimeLabel: string;
  };

  slot: {
    id?: string | null;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    basePrice?: number | null;
    finalPrice?: number | null;
    decorationMandatory?: boolean;
  };

  guestCount: number;
  decorationRequired?: boolean;

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
  signedAgreement?: {
    id: string;
    signerName: string;
    signerEmail: string;
    signedAt: string;
    signatureImage: string;
    ipAddress: string | null;
    userAgent: string | null;
    agreementVersion: string | null;
    confirmationAccepted: boolean;
    paymentReference: string | null;
    pdfGeneratedAt: string | null;
    createdAt: string;
  } | null;

  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  razorpaySignature?: string | null;
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
