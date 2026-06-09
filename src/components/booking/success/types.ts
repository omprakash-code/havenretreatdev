export type BookingSuccessItem = {
  id: string;
  productName: string;
  productSlug?: string | null;
  variantLabel: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  includedQuantity?: number | null;
  extraQuantity?: number | null;
  image?: string | null;
  numberLabel?: string | null;
  numberValue?: string | null;
};

export type BookingSuccessDetail = {
  label: string;
  value: string;
};

export type BookingSuccessData = {
  bookingRef: string;
  bookingStatus?: string | null;
  paymentStatus?: string | null;
  createdByRole?: string | null;
  payment?: {
    provider?: string | null;
    method?: string | null;
    transactionId?: string | null;
    status?: string | null;
    amount?: number | null;
    createdAt?: string | null;
  } | null;
  contact: {
    name: string;
    phone: string;
    email?: string;
  };
  theatreName: string;
  theatreImage?: string | null;
  date: string;
  timeSlot: string;
  durationHours?: number | null;
  includedDurationHours?: number | null;
  extraDurationHours?: number | null;
  locationName: string;
  dateTime: string;
  occasionLabel?: string;
  occasionDetails: BookingSuccessDetail[];
  guestCount: number;
  includedGuestCount?: number | null;
  extraGuestCount?: number | null;
  extraPersonPrice?: number | null;
  decorationRequired?: boolean;
  extrasAmount?: number | null;
  totalAmount: number;
  advancePaid: number;
  remainingPayable: number;
  discountAmount?: number;
  appliedCoupons?: {
    id: string;
    code: string;
    discountAmount: number;
  }[];
  items: BookingSuccessItem[];
};
