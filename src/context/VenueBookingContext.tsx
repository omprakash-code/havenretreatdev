"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { calculateVenueBookingPricing } from "@/lib/venue-booking-pricing";
import type {
  VenueBookingContact,
  VenueBookingPersistedDraft,
  VenueBookingState,
} from "@/types/venue-booking";
import type { EventAddonSummary, EventPackageSummary } from "@/types/venue-package";

const STORAGE_KEY = "venue-booking-state-v1";

const INITIAL_CONTACT: VenueBookingContact = {
  fullName: "",
  email: "",
  phone: "",
};

const INITIAL_STATE: VenueBookingState = {
  bookingId: null,
  bookingRef: null,
  bookingStatus: null,
  paymentStatus: null,
  venueId: null,
  packageId: null,
  packageSnapshot: null,
  eventDate: null,
  eventStartTime: "",
  eventEndTime: "",
  guestCount: 2,
  contact: INITIAL_CONTACT,
  occasionType: null,
  occasionData: {},
  selectedAddons: [],
  agreementAccepted: false,
  signatureImage: null,
  signerName: "",
  specialInstructions: "",
  pricingSnapshot: null,
};

type VenueBookingContextValue = {
  booking: VenueBookingState;
  hydrated: boolean;
  selectPackage: (eventPackage: EventPackageSummary) => void;
  updateDetails: (input: {
    contact: VenueBookingContact;
    eventDate: string;
    eventStartTime: string;
    eventEndTime: string;
    guestCount: number;
    specialInstructions: string;
  }) => void;
  setOccasion: (occasionType: string, occasionData: Record<string, string>) => void;
  setAddonQuantity: (addon: EventAddonSummary, quantity: number) => void;
  setAgreement: (input: {
    agreementAccepted?: boolean;
    signerName?: string;
    signatureImage?: string | null;
  }) => void;
  applyPersistedDraft: (draft: VenueBookingPersistedDraft) => void;
  resetVenueBooking: () => void;
};

const VenueBookingContext = createContext<VenueBookingContextValue | null>(null);

function recomputePricing(state: VenueBookingState): VenueBookingState {
  if (!state.packageSnapshot) {
    return { ...state, pricingSnapshot: null };
  }

  return {
    ...state,
    pricingSnapshot: calculateVenueBookingPricing({
      eventPackage: state.packageSnapshot,
      selectedAddons: state.selectedAddons,
    }),
  };
}

function sanitizeState(value: unknown): VenueBookingState {
  if (!value || typeof value !== "object") {
    return INITIAL_STATE;
  }

  const raw = value as Partial<VenueBookingState>;
  const nextState: VenueBookingState = {
    ...INITIAL_STATE,
    ...raw,
    contact: {
      ...INITIAL_CONTACT,
      ...(raw.contact ?? {}),
    },
    occasionData:
      raw.occasionData && typeof raw.occasionData === "object"
        ? raw.occasionData
        : {},
    selectedAddons: Array.isArray(raw.selectedAddons) ? raw.selectedAddons : [],
  };

  return recomputePricing(nextState);
}

export function VenueBookingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [booking, setBooking] = useState<VenueBookingState>(INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setBooking(sanitizeState(JSON.parse(raw)));
      }
    } catch {
      setBooking(INITIAL_STATE);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(booking));
  }, [booking, hydrated]);

  const value = useMemo<VenueBookingContextValue>(
    () => ({
      booking,
      hydrated,
      selectPackage(eventPackage) {
        setBooking((current) =>
          recomputePricing({
            ...INITIAL_STATE,
            venueId: eventPackage.venueId,
            packageId: eventPackage.id,
            packageSnapshot: eventPackage,
            guestCount: Math.min(current.guestCount || 2, eventPackage.guestLimit),
            contact: current.contact,
            signerName: current.contact.fullName || "",
          })
        );
      },
      updateDetails(input) {
        setBooking((current) =>
          recomputePricing({
            ...current,
            eventDate: input.eventDate,
            eventStartTime: input.eventStartTime,
            eventEndTime: input.eventEndTime,
            guestCount: input.guestCount,
            specialInstructions: input.specialInstructions,
            contact: input.contact,
            signerName: current.signerName || input.contact.fullName,
          })
        );
      },
      setOccasion(occasionType, occasionData) {
        setBooking((current) => ({
          ...current,
          occasionType,
          occasionData,
        }));
      },
      setAddonQuantity(addon, quantity) {
        setBooking((current) => {
          const nextAddons = current.selectedAddons.filter(
            (item) => item.addonId !== addon.id
          );

          if (quantity > 0) {
            nextAddons.push({
              addonId: addon.id,
              name: addon.name,
              category: addon.category,
              unitPrice: addon.price,
              quantity,
              image: addon.image,
            });
          }

          nextAddons.sort((a, b) => a.name.localeCompare(b.name));

          return recomputePricing({
            ...current,
            selectedAddons: nextAddons,
          });
        });
      },
      setAgreement(input) {
        setBooking((current) => ({
          ...current,
          agreementAccepted:
            input.agreementAccepted ?? current.agreementAccepted,
          signerName: input.signerName ?? current.signerName,
          signatureImage:
            input.signatureImage === undefined
              ? current.signatureImage
              : input.signatureImage,
        }));
      },
      applyPersistedDraft(draft) {
        setBooking((current) => ({
          ...current,
          bookingId: draft.bookingId,
          bookingRef: draft.bookingRef,
          bookingStatus: draft.bookingStatus,
          paymentStatus: draft.paymentStatus,
          venueId: draft.venueId,
          packageId: draft.packageId,
          eventDate: draft.eventDate,
          eventStartTime: draft.eventStartTime,
          eventEndTime: draft.eventEndTime,
          guestCount: draft.guestCount,
          contact: draft.contact,
          occasionType: draft.occasionType,
          occasionData: draft.occasionData,
          selectedAddons: draft.selectedAddons,
          agreementAccepted: draft.agreementAccepted,
          signatureImage: draft.signatureImage,
          signerName: draft.signerName,
          specialInstructions: draft.specialInstructions,
          pricingSnapshot: draft.pricingSnapshot,
        }));
      },
      resetVenueBooking() {
        window.localStorage.removeItem(STORAGE_KEY);
        setBooking(INITIAL_STATE);
      },
    }),
    [booking, hydrated]
  );

  return (
    <VenueBookingContext.Provider value={value}>
      {children}
    </VenueBookingContext.Provider>
  );
}

export function useVenueBooking() {
  const context = useContext(VenueBookingContext);
  if (!context) {
    throw new Error("useVenueBooking must be used inside VenueBookingProvider");
  }
  return context;
}
