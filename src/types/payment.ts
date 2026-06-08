import type { PaymentStatus } from "@prisma/client";

export type AdminPaymentRecord = {
  id: string;
  bookingRef: string;
  customerName: string | null;
  contactPhone: string | null;
  theatreName: string;
  locationName: string;
  schedule?: {
    source: "BOOKING" | "SLOT" | "MISSING";
    date: string;
    startTime: string;
    endTime: string;
    dateLabel: string;
    timeLabel: string;
    dateTimeLabel: string;
  };
  slotDate: string;
  slotStartTime: string;
  slotEndTime: string;
  totalAmount: number;
  payableAmount: number;
  status: PaymentStatus;
  provider: string;
  transactionId: string | null;
  attemptReason: string | null;
  createdAt: string;
};

export type AdminPaymentsResponse = {
  success: boolean;
  data: AdminPaymentRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
