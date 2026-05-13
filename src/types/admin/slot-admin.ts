import { SlotStatus } from "@prisma/client";

export interface AdminSlot {
  id: string;

  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  durationMin: number;

  theatre: {
    id: string;
    name: string;
  };

   template: {
    id: string;
    startTime: string;
    endTime: string;
    durationMin: number;
    regularPrice: number;
    salePrice: number | null;
    isCustomTemplate?: boolean;
  };

  pricing: {
    regular: number;
    sale: number | null;
    final: number;
    discountText?: string | null;
    isSpecial: boolean;
  };

  status: SlotStatus;
  bookingCount: number;

    bookings?: {
    id: string;
    bookingRef: string;
    bookingStatus: string;
  }[];

  isOverridden?: boolean;
  isCustomSlot?: boolean;
  canDelete?: boolean;
  deleteDisabledReason?: string | null;
  isTimingOverridden?: boolean;
  isPricingOverridden?: boolean;
  isStatusOverridden?: boolean;
  overrideReason?: string | null;
  slotModifiedAt?: string | null;
  slotModifiedBy?: string | null;

  createdAt: string;
  updatedAt: string;
}
