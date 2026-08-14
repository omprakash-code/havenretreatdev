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
  // Package allowance snapshotted on the line at booking time. quantity below
  // includedQuantity is what credits the package price.
  includedQuantity?: number;
  includedUnitPrice?: number;
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
    additionalChargeAmount: number;
    additionalChargeReason: string | null;
    decoration: number;
    discount: number;
    total: number;
    advancePaid: number;
    remainingPayable: number;
    /** Package price AFTER any included-item reduction. */
    packageAmount?: number | null;
    /** Package price as listed, before any included-item reduction. */
    packageListAmount?: number | null;
    /** Credit for package-included items reduced below the package quantity. */
    packageAdjustmentAmount?: number | null;
    extraDurationAmount?: number | null;
    extraDurationHours?: number | null;
  };

  items: AdminBookingItem[];

  occasionLabel: string | null;
  occasionKey: string | null;
  occasionData: Record<string, unknown> | null;
  specialInstructions?: string | null;

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
    agreementHtmlSnapshot?: string | null;
    acknowledgedClauses?: number[];
    confirmationAccepted: boolean;
    paymentReference: string | null;
    pdfGeneratedAt: string | null;
    pdfFileName: string | null;
    pdfSha256: string | null;
    createdAt: string;
  } | null;

  paymentOrderId: string | null;
  paymentTransactionId: string | null;
  paymentSignature?: string | null;
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
  bookingStatusLabel?: string;
  customerConfirmationUrl?: string | null;
  /** Payment summary derived from collected amounts, independent of approval. */
  paymentLifecycle?: "UNPAID" | "PARTIAL" | "PAID";
  paymentStatusLabel?: string;

  // Admin review workflow.
  reviewSubmittedAt?: string | null;
  reviewedAt?: string | null;
  reviewedByAdminId?: string | null;
  rejectionReason?: string | null;
  approvalNotes?: string | null;
  internalNotes?: string | null;
  agreementSigned?: boolean;

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
