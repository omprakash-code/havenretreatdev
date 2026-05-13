"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ADVANCE_PAYMENT_AMOUNT_KEY,
  parseAdvancePaymentAmount,
} from "@/lib/app-settings";

/* -----------------------------
 Types
------------------------------ */

export type Location = {
  id: string;
  name: string;
  city?: string;
};

export type SelectedSlot = {
  id: string;
  time: string;
  basePrice: number;
  lockExpiresAt?: string | null;
};

export type SelectedTheatre = {
  id: string;
  name: string;
  capacity: number;
  basePrice: number;
  baseGuests: number;
  extraPersonPrice: number;
  decorationPrice: number;
  decorationMandatory: boolean;
};

export type BookingPricing = {
  base: number;
  extras: number;
  products: number;
  decoration: number;
  discount: number;
  total: number;
  advancePay: number;
};

export type AppliedCoupon = {
  id: string;
  code: string;
  discountAmount: number;
  status: "RESERVED" | "CONFIRMED" | "RELEASED";
};

export type BookingItemSnapshot = {
  id: string;
  productName: string;
  productImage?: string;
  productSlug?: string;
  variantLabel: string;
  productId: string;
  variantId: string;
  category: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  ledNumber?: string;
};

type BookingState = {
  location: Location | null;
  date: Date | null;
  theatre: SelectedTheatre | null;
  slot: SelectedSlot | null;

  bookingId?: string;

  guestCount: number;
  decorationRequired: boolean;

  bookingItems: BookingItemSnapshot[];
  couponDiscount: number;
  appliedCoupons: AppliedCoupon[];

  specialSlotText?: string;

  contact?: {
    name: string;
    phone: string;
    email?: string;
  };

  occasion?: {
    key: string;
    data: Record<string, string>;
  };
};

/* -----------------------------
 Constants
------------------------------ */

const STORAGE_KEY = "ds_booking_v1";

/* -----------------------------
 Context Shape
------------------------------ */

type BookingContextType = {
  booking: BookingState & { pricing?: BookingPricing };
  hydrated: boolean;

  setLocation: (l: Location) => void;
  setDate: (d: Date) => void;
  setTheatre: (t: SelectedTheatre) => void;
  setSlot: (s: SelectedSlot) => void;
  setTheatreAndSlot: (
    theatre: SelectedTheatre,
    slot: SelectedSlot
  ) => void;
  setGuestCount: (n: number) => void;
  setDecorationRequired: (v: boolean) => void;
  setBookingId: (id: string) => void;
  setContact: (c: BookingState["contact"]) => void;
  setOccasion: (key: string, data: Record<string, string>) => void;
  setBookingItems: (items: | BookingItemSnapshot[] | ((prev: BookingItemSnapshot[]) => BookingItemSnapshot[])) => void;
  setCouponState: (input: {
    discount: number;
    coupons: AppliedCoupon[];
  }) => void;
  clearCouponState: () => void;
  itemsHydrated: boolean;
  setItemsHydrated: (v: boolean) => void;

  openCalendar: boolean;
  setOpenCalendar: (v: boolean) => void;
  openLocation: boolean;
  setOpenLocation: (v: boolean) => void;

  resetBooking: () => void;
};

const BookingContext = createContext<BookingContextType | null>(null);

/* -----------------------------
 Initial State
------------------------------ */

const INITIAL_BOOKING: BookingState = {
  location: null,
  date: null,
  theatre: null,
  slot: null,
  guestCount: 2,
  decorationRequired: true,
  bookingItems: [],
  couponDiscount: 0,
  appliedCoupons: [],
  specialSlotText: undefined,
  occasion: undefined,
};

/* -----------------------------
 Provider
------------------------------ */

export function BookingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [booking, setBooking] = useState<BookingState>(INITIAL_BOOKING);
  const [configuredAdvanceAmount, setConfiguredAdvanceAmount] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const [openCalendar, setOpenCalendar] = useState(false);
  const [openLocation, setOpenLocation] = useState(false);
  const [itemsHydrated, setItemsHydrated] = useState(false);

  /* -----------------------------
   Hydration
  ------------------------------ */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setBooking((prev) => ({
          ...prev,
          ...parsed,
          bookingId: undefined,
          location: null,
          theatre: null,
          slot: null,
          couponDiscount: 0,
          appliedCoupons: [],
          date: parsed.date ? new Date(parsed.date) : null,
        }));

      }
    } finally {
      setHydrated(true);
    }
  }, []);

  /* -----------------------------
   Persist
  ------------------------------ */
  // useEffect(() => {
  //   if (!hydrated) return;

  //   const persistableBooking = { ...booking } as BookingState;

  //   // pricing & booking id is derived, never persist
  //   delete persistableBooking.bookingId;
  //   delete (persistableBooking as { pricing?: BookingPricing }).pricing;


  //   localStorage.setItem(
  //     STORAGE_KEY,
  //     JSON.stringify({
  //       ...persistableBooking,
  //       date: booking.date?.toISOString() ?? null,
  //     })
  //   );
  // }, [booking, hydrated]);

  /* -----------------------------
   Persist (SAFE & MINIMAL)
------------------------------ */
  useEffect(() => {
    if (!hydrated) return;

    /**
     * Persist ONLY what must survive refresh
     * (never persist slot, theatre, bookingId)
     */
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        location: booking.location,
        date: booking.date ? booking.date.toISOString() : null,
        guestCount: booking.guestCount,
        decorationRequired: booking.decorationRequired,
        occasion: booking.occasion,
        contact: booking.contact,
      })
    );
  }, [
    hydrated,
    booking.location,
    booking.date,
    booking.guestCount,
    booking.decorationRequired,
    booking.occasion,
    booking.contact,
  ]);


  /* -----------------------------
   Fetch settings
  ------------------------------ */
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings");
        const json = await res.json();

        const parsedAdvance = parseAdvancePaymentAmount(
          json?.data?.[ADVANCE_PAYMENT_AMOUNT_KEY]
        );
        if (parsedAdvance !== null) {
          setConfiguredAdvanceAmount(parsedAdvance);
        }

        if (json.success && json.data?.SPECIAL_SLOT_TEXT) {
          setBooking((prev) => ({
            ...prev,
            specialSlotText: json.data.SPECIAL_SLOT_TEXT,
          }));
        }
      } catch { }
    }

    fetchSettings();
  }, []);

  /* -----------------------------
   Pricing (SINGLE SOURCE)
  ------------------------------ */
  const pricing = useMemo<BookingPricing | undefined>(() => {
    if (!booking.theatre || !booking.slot) return undefined;

    const base = booking.slot.basePrice;

    const extras =
      Math.max(
        booking.guestCount - booking.theatre.baseGuests,
        0
      ) * booking.theatre.extraPersonPrice;

    const decoration =
      booking.decorationRequired ||
        booking.theatre.decorationMandatory
        ? booking.theatre.decorationPrice
        : 0;

    const products = booking.bookingItems.reduce(
      (sum, i) => sum + i.totalPrice,
      0
    );

    const discount = Math.max(0, Number(booking.couponDiscount) || 0);
    const total = base + extras + decoration + products - discount;

    return {
      base,
      extras,
      products,
      decoration,
      discount,
      total,
      advancePay: configuredAdvanceAmount,
    };
  }, [
    booking.theatre,
    booking.slot,
    booking.guestCount,
    booking.decorationRequired,
    booking.bookingItems,
    booking.couponDiscount,
    configuredAdvanceAmount,
  ]);

  /* -----------------------------
   Setters
  ------------------------------ */

  const setLocation = (location: Location) => {
    setBooking((p) => ({
      ...p,
      location,
      date: null,
      theatre: null,
      slot: null,
      couponDiscount: 0,
      appliedCoupons: [],
    }));
  };

  const setDate = (date: Date) => {
    setBooking((p) => ({
      ...p,
      date,
      theatre: null,
      slot: null,
      couponDiscount: 0,
      appliedCoupons: [],
    }));
  };

  const setTheatre = (theatre: SelectedTheatre) => {
    setBooking((p) => ({
      ...p,
      theatre,
      slot: null,
      guestCount: theatre.baseGuests,
      decorationRequired:
        theatre.decorationMandatory || p.decorationRequired,
      couponDiscount: 0,
      appliedCoupons: [],
    }));
  };

  const setSlot = (slot: SelectedSlot) =>
    setBooking((p) => ({
      ...p,
      slot,
      couponDiscount: 0,
      appliedCoupons: [],
    }));

  const setTheatreAndSlot = (
    theatre: SelectedTheatre,
    slot: SelectedSlot
  ) =>
    setBooking((p) => ({
      ...p,
      theatre,
      slot,
      guestCount: theatre.baseGuests,
      decorationRequired:
        theatre.decorationMandatory || p.decorationRequired,
      couponDiscount: 0,
      appliedCoupons: [],
    }));

  const setGuestCount = (guestCount: number) =>
    setBooking((p) => ({
      ...p,
      guestCount,
      couponDiscount: 0,
      appliedCoupons: [],
    }));

  const setDecorationRequired = (v: boolean) =>
    setBooking((p) => ({
      ...p,
      decorationRequired: v,
      couponDiscount: 0,
      appliedCoupons: [],
    }));

  const setBookingItems = (items: | BookingItemSnapshot[] | ((prev: BookingItemSnapshot[]) => BookingItemSnapshot[])
  ) => {
    setBooking((p) => ({
      ...p,
      bookingItems:
        typeof items === "function"
          ? items(p.bookingItems)
          : items,
    }));
  };

  const setCouponState = (input: {
    discount: number;
    coupons: AppliedCoupon[];
  }) =>
    setBooking((p) => ({
      ...p,
      couponDiscount: Math.max(0, input.discount || 0),
      appliedCoupons: input.coupons,
    }));

  const clearCouponState = () =>
    setBooking((p) => ({
      ...p,
      couponDiscount: 0,
      appliedCoupons: [],
    }));


  const setBookingId = (id: string) =>
    setBooking((p) => ({ ...p, bookingId: id }));

  useEffect(() => {
    setItemsHydrated(false);
  }, [booking.bookingId]);

  const setContact = (contact: BookingState["contact"]) =>
    setBooking((p) => ({ ...p, contact }));

  const setOccasion = (key: string, data: Record<string, string>) =>
    setBooking((p) => ({
      ...p,
      occasion: { key, data },
    }));

  const resetBooking = () => {
    //console.log("[BOOKING RESET] clearing booking context"); // TEMP DEBUG
    localStorage.removeItem(STORAGE_KEY);
    setItemsHydrated(false);
    setBooking(() => ({
      ...INITIAL_BOOKING,
      bookingId: undefined,
      specialSlotText: booking.specialSlotText,
    }));

  };

  return (
    <BookingContext.Provider
      value={{
        booking: { ...booking, pricing },
        hydrated,

        setLocation,
        setDate,
        setTheatre,
        setSlot,
        setTheatreAndSlot,
        setGuestCount,
        setDecorationRequired,
        setBookingItems,
        setCouponState,
        clearCouponState,
        setBookingId,
        setContact,
        setOccasion,
        itemsHydrated,
        setItemsHydrated,

        openCalendar,
        setOpenCalendar,
        openLocation,
        setOpenLocation,

        resetBooking,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

/* -----------------------------
 Hook
------------------------------ */

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) {
    throw new Error("useBooking must be used inside BookingProvider");
  }
  return ctx;
}
