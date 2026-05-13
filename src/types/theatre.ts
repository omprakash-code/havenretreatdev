import type { TheatreCardContent } from "@/lib/theatre-card-content";

export type Slot = {
  id: string;
  startTime: string;
  endTime: string;

  status: "AVAILABLE" | "LOCKED" | "BOOKED" | "DISABLED";

  durationMin: number;

  basePrice: number;
  finalPrice: number;

  isSpecial: boolean;
  discountText?: string | null;
  decorationMandatory: boolean;

  // lock metadata (raw)
  lockExpiresAt?: string | null;

  // normalized by API (derived from status + lockOwner)
  isExpired?: boolean;
  isLockedByMe?: boolean;
  lockRemainingSec?: number | null;
};

export type TheatreMedia = {
  url: string;
  type: "image" | "video";
};

export type Theatre = {
  id: string;
  name: string;

  images: TheatreMedia[];
  capacity: number;
  baseGuests: number;
  extraPersonPrice: number;
  basePrice: number;

  hasFood: boolean;
  decorationPrice: number;
  footerMessage?: string | null;
  cardContent: TheatreCardContent;

  menuFile?: string | null;
  mapUrl?: string | null;

  slots: Slot[];
};
