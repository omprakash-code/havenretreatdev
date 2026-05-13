import type { EventPackageSummary } from "@/types/venue-package";

export type VenueBookingContact = {
  fullName: string;
  email: string;
  phone: string;
};

export type VenueBookingSelectedAddon = {
  addonId: string;
  name: string;
  category: string;
  unitPrice: number;
  quantity: number;
  image?: string | null;
};

export type VenueBookingPricingSnapshot = {
  packageAmount: number;
  addonsAmount: number;
  cleaningFeeAmount: number;
  savingsAmount: number;
  subtotalAmount: number;
  depositAmount: number;
  remainingAmount: number;
};

export type VenueBookingPersistedDraft = {
  bookingId: string;
  bookingRef: string;
  bookingStatus: string;
  paymentStatus: string | null;
  venueId: string | null;
  packageId: string | null;
  eventDate: string | null;
  eventStartTime: string;
  eventEndTime: string;
  guestCount: number;
  contact: VenueBookingContact;
  occasionType: string | null;
  occasionData: Record<string, string>;
  selectedAddons: VenueBookingSelectedAddon[];
  agreementAccepted: boolean;
  signatureImage: string | null;
  signerName: string;
  specialInstructions: string;
  pricingSnapshot: VenueBookingPricingSnapshot | null;
};

export type VenueBookingState = {
  bookingId: string | null;
  bookingRef: string | null;
  bookingStatus: string | null;
  paymentStatus: string | null;
  venueId: string | null;
  packageId: string | null;
  packageSnapshot: EventPackageSummary | null;
  eventDate: string | null;
  eventStartTime: string;
  eventEndTime: string;
  guestCount: number;
  contact: VenueBookingContact;
  occasionType: string | null;
  occasionData: Record<string, string>;
  selectedAddons: VenueBookingSelectedAddon[];
  agreementAccepted: boolean;
  signatureImage: string | null;
  signerName: string;
  specialInstructions: string;
  pricingSnapshot: VenueBookingPricingSnapshot | null;
};
