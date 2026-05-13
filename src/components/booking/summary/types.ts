// src/components/booking/summary/types.ts
import type { BookingItemSnapshot } from "@/context/BookingContext";

import type React from "react";

/* -----------------------------
   Summary Item (READ-ONLY)
   Used on Contact / Occasion / Payment pages
------------------------------ */
export type SummaryItem = {
  id: string;              // bookingItem.id
  name: string;            // product name
  variantLabel: string;    // e.g. "500g", "Premium"
  unitPrice: number;
  quantity: number;
  totalPrice: number;
};

/* -----------------------------
   Booking Summary Props
------------------------------ */
export type BookingSummaryProps = {
  products?: BookingItemSnapshot[];
  onRemoveItem?: (id: string) => void;
  onSubmit?: () => void;
  onSkipExtras?: () => void;
  isSubmitDisabled?: boolean;
  enableInvalidSubmitFeedback?: boolean;
  invalidSubmitMessage?: string;
  submitLabel?: React.ReactNode;
  hideSubmitOnMobile?: boolean;
  onMobileInlineSubmitVisibilityChange?: (visible: boolean) => void;
  occasionPreview?: {
    label: string;
    data: Record<string, string>;
  };
  extrasProgress?: Array<{
    label: string;
    active: boolean;
    completed: boolean;
  }>;
  couponIdentityOverride?: {
    phone?: string;
    email?: string;
    userId?: string;
  };
};
