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
  DEFAULT_EXTRA_HOURLY_RATE,
  DEFAULT_MINIMUM_BOOKING_DURATION_HOURS,
  EXTRA_HOURLY_RATE_KEY,
  MINIMUM_BOOKING_DURATION_HOURS_KEY,
  parseAdvancePaymentAmount,
  parseExtraHourlyRate,
  parseMinimumBookingDurationHours,
} from "@/lib/app-settings";
import { calculateDurationHours } from "@/lib/booking-time-range";
import { formatSlotTime } from "@/lib/formatters";
import {
  PACKAGE_EXTRA_PERSON_PRICE,
  resolvePackageIncludedGuestCount,
} from "@/lib/package-guest-pricing";
import {
  BOOKING_SESSION_EXPIRED_MODAL_MESSAGE,
  emitBookingSessionExpired,
} from "@/lib/booking-session-expiry";

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
  decorationMandatory: boolean;
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
};

export type BookingPricing = {
  base: number;
  packageBase: number;
  extraDurationHours: number;
  extraHourlyRate: number;
  extraHours: number;
  extras: number;
  products: number;
  decoration: number;
  discount: number;
  total: number;
  advancePay: number;
};

export type BookingItemSnapshot = {
  id: string;
  productName: string;
  variantLabel: string;
  productId: string;
  variantId: string;
  category: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  productImage?: string;
  productSlug?: string;
  ledNumber?: string;
};

export type AppliedCoupon = {
  id: string;
  code: string;
  discountAmount: number;
  status: "RESERVED" | "CONFIRMED" | "RELEASED";
};

type SessionTypeResponse = {
  success: boolean;
  type: "booking" | "prebooking" | "none";
};

type PrebookingResponse = {
  success: boolean;
  data?: {
    locationId: string;
    locationName: string;
    city?: string;
    date: string;
    startTime?: string;
    endTime?: string;
    durationHours?: number;
  };
};

type ServerBookingItem = {
  id: string;
  productName: string;
  variantLabel: string;
  productId: string;
  variantId: string;
  category: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  ledNumber?: string | null;
  productImage?: string | null;
  productSlug?: string | null;
  product?: {
    image?: string | null;
    slug?: string | null;
  } | null;
};

function normalizeBookingItems(
  items: ServerBookingItem[] | undefined
): BookingItemSnapshot[] {
  if (!items?.length) return [];

  return items.map((item) => ({
    id: item.id,
    productName: item.productName,
    variantLabel: item.variantLabel,
    productId: item.productId,
    variantId: item.variantId,
    category: item.category,
    unitPrice: Number(item.unitPrice) || 0,
    quantity: Number(item.quantity) || 0,
    totalPrice: Number(item.totalPrice) || 0,
    ledNumber:
      typeof item.ledNumber === "string" ? item.ledNumber : undefined,
    productImage:
      item.productImage ??
      item.product?.image ??
      undefined,
    productSlug:
      item.productSlug ??
      item.product?.slug ??
      undefined,
  }));
}


type BookingState = {
  location: Location | null;
  date: Date | null;
  selectedDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  durationHours: number | null;
  theatre: SelectedTheatre | null;
  slot: SelectedSlot | null;

  bookingId?: string;
  advancePaidSnapshot?: number;

  guestCount: number;
  decorationRequired: boolean;

  bookingItems: BookingItemSnapshot[];
  couponDiscount: number;
  appliedCoupons: AppliedCoupon[];

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
 Context Shape
------------------------------ */

type BookingContextType = {
  booking: BookingState & { pricing?: BookingPricing };
  loading: boolean;
  hydrated: boolean;
  itemsHydrated: boolean;
  minimumBookingDurationHours: number;
  extraHourlyRate: number;
  refreshBooking: () => Promise<void>;

  // Temporary setters (will be removed later phase)
  setLocation: (l: Location) => void;
  setDate: (d: Date) => void;
  setTimeRange: (startTime: string | null, endTime: string | null) => void;
  setTheatreAndSlot: (
    theatre: SelectedTheatre,
    slot: SelectedSlot
  ) => void;
  setGuestCount: (n: number) => void;
  setDecorationRequired: (v: boolean) => void;
  setBookingItems: (
    items:
      | BookingItemSnapshot[]
      | ((
        prev: BookingItemSnapshot[]
      ) => BookingItemSnapshot[])
  ) => void;
  setBookingId: (id: string) => void;
  setSlotLockExpiresAt: (value: string | null) => void;
  setContact: (c: BookingState["contact"]) => void;
  setOccasion: (key: string, data: Record<string, string>) => void;
  setItemsHydrated: (v: boolean) => void;
  setCouponState: (input: {
    discount: number;
    coupons: AppliedCoupon[];
  }) => void;
  clearCouponState: () => void;
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
  selectedDate: null,
  startTime: null,
  endTime: null,
  durationHours: null,
  theatre: null,
  slot: null,
  guestCount: 2,
  decorationRequired: true,
  bookingItems: [],
  couponDiscount: 0,
  appliedCoupons: [],
};

/* -----------------------------
 Provider
------------------------------ */

export function BookingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [booking, setBooking] =
    useState<BookingState>(INITIAL_BOOKING);

  const [loading, setLoading] = useState(true);
  const [configuredAdvanceAmount, setConfiguredAdvanceAmount] =
    useState<number | null>(null);
  const [minimumBookingDurationHours, setMinimumBookingDurationHours] =
    useState(DEFAULT_MINIMUM_BOOKING_DURATION_HOURS);
  const [extraHourlyRate, setExtraHourlyRate] =
    useState(DEFAULT_EXTRA_HOURLY_RATE);
  const [itemsHydrated, setItemsHydrated] =
    useState(false);
  const [openCalendar, setOpenCalendar] =
    useState(false);
  const [openLocation, setOpenLocation] =
    useState(false);

  /* -----------------------------
   Load Booking From Server
  ------------------------------ */
const loadBooking = async () => {
  setLoading(true);

  const loadPrebookingSnapshot = async () => {
    const pre = await fetch("/api/prebooking/current", {
      credentials: "include",
    });

    if (!pre.ok) return false;

    const preJson: PrebookingResponse =
      await pre.json();

    if (!preJson.success || !preJson.data) {
      return false;
    }

    const data = preJson.data;
    setBooking({
      ...INITIAL_BOOKING,
      location: {
        id: data.locationId,
        name: data.locationName,
        city: data.city,
      },
      date: new Date(data.date),
      selectedDate: new Date(data.date),
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      durationHours:
        calculateDurationHours(data.startTime, data.endTime) ??
        data.durationHours ??
        null,
    });

    return true;
  };

  try {
    const settingsRes = await fetch("/api/settings", {
      credentials: "include",
    });

    if (!settingsRes.ok) {
      throw new Error("ADVANCE_PAYMENT_CONFIG_UNAVAILABLE");
    }

    const settingsJson = await settingsRes.json().catch(() => null);
    const parsedAdvance = parseAdvancePaymentAmount(
      settingsJson?.data?.[ADVANCE_PAYMENT_AMOUNT_KEY]
    );
    const parsedMinimumDuration = parseMinimumBookingDurationHours(
      settingsJson?.data?.[MINIMUM_BOOKING_DURATION_HOURS_KEY]
    );
    const parsedExtraHourlyRate = parseExtraHourlyRate(
      settingsJson?.data?.[EXTRA_HOURLY_RATE_KEY]
    );

    if (
      parsedAdvance === null ||
      parsedMinimumDuration === null ||
      parsedExtraHourlyRate === null
    ) {
      throw new Error("ADVANCE_PAYMENT_CONFIG_INVALID");
    }

    setConfiguredAdvanceAmount(parsedAdvance);
    setMinimumBookingDurationHours(parsedMinimumDuration);
    setExtraHourlyRate(parsedExtraHourlyRate);

    const typeRes = await fetch("/api/session/type", {
      credentials: "include",
    });

    if (!typeRes.ok) {
      setBooking(INITIAL_BOOKING);
      return;
    }

    const typeJson: SessionTypeResponse =
      await typeRes.json();

    if (!typeJson.success) {
      setBooking(INITIAL_BOOKING);
      return;
    }

    /* ---------------- BOOKING SESSION ---------------- */
    if (typeJson.type === "booking") {
      const res = await fetch("/api/bookings/current", {
        credentials: "include",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.code === "SESSION_EXPIRED") {
          emitBookingSessionExpired({
            message: BOOKING_SESSION_EXPIRED_MODAL_MESSAGE,
          });
        }
        const hydratedFromPrebooking =
          await loadPrebookingSnapshot();
        if (!hydratedFromPrebooking) {
          setBooking(INITIAL_BOOKING);
        }
        return;
      }

      const json = await res.json();

      if (!json.success || !json.data) {
        const hydratedFromPrebooking =
          await loadPrebookingSnapshot();
        if (!hydratedFromPrebooking) {
          setBooking(INITIAL_BOOKING);
        }
        return;
      }

      const data = json.data;
      const normalizedItems = normalizeBookingItems(
        Array.isArray(data.items)
          ? (data.items as ServerBookingItem[])
          : undefined
      );

      setBooking({
        bookingId: data.id,
        advancePaidSnapshot:
          Number.isFinite(Number(data.advancePaid)) && Number(data.advancePaid) > 0
            ? Number(data.advancePaid)
            : undefined,
        location: data.theatre?.location ?? null,
        date: data.slot?.date
          ? new Date(data.slot.date)
          : null,
        selectedDate: data.slot?.date
          ? new Date(data.slot.date)
          : null,
        startTime: data.slot?.startTime ?? null,
        endTime: data.slot?.endTime ?? null,
        durationHours: calculateDurationHours(
          data.slot?.startTime,
          data.slot?.endTime
        ),
        theatre: data.theatre
          ? {
              id: data.theatre.id,
              name: data.theatre.name,
              capacity: data.theatre.capacity,
              basePrice: data.slot.basePrice,
              baseGuests: resolvePackageIncludedGuestCount(data.theatre),
              extraPersonPrice: PACKAGE_EXTRA_PERSON_PRICE,
              decorationPrice:
                data.theatre.decorationPrice,
            }
          : null,
        slot: data.slot
          ? {
              id: data.slot.id,
              time: formatSlotTime(data.slot.startTime, data.slot.endTime),
              basePrice: data.slot.basePrice,
              decorationMandatory: Boolean(data.slot.decorationMandatory),
              lockExpiresAt:
                typeof data.slot.lockExpiresAt === "string"
                  ? data.slot.lockExpiresAt
                  : data.slot.lockExpiresAt
                    ? new Date(data.slot.lockExpiresAt).toISOString()
                    : null,
            }
          : null,
        guestCount: data.guestCount ?? 2,
        decorationRequired:
          data.decorationRequired ?? true,
        bookingItems: normalizedItems,
        couponDiscount: data.discountAmount ?? 0,
        appliedCoupons: data.appliedCoupons ?? [],
        contact: data.contactName
          ? {
              name: data.contactName,
              phone: data.contactPhone,
              email: data.contactEmail ?? undefined,
            }
          : undefined,
        occasion: data.occasionKey
          ? {
              key: data.occasionKey,
              data: data.occasionData ?? {},
            }
          : undefined,
      });

      return;
    }

    /* ---------------- PREBOOKING SESSION ---------------- */
    if (typeJson.type === "prebooking") {
      const hydratedFromPrebooking =
        await loadPrebookingSnapshot();
      if (!hydratedFromPrebooking) {
        setBooking(INITIAL_BOOKING);
      }

      return;
    }

    /* ---------------- NONE ---------------- */
    setBooking(INITIAL_BOOKING);
  } catch {
    setConfiguredAdvanceAmount(null);
    setBooking(INITIAL_BOOKING);
  } finally {
    setLoading(false);
  }
};

  const hydrated = !loading;

  useEffect(() => {
    loadBooking();
  }, []);

  useEffect(() => {
    setItemsHydrated(false);
  }, [booking.bookingId]);

  /* -----------------------------
   Pricing
  ------------------------------ */

  const pricing = useMemo(() => {
    if (
      !booking.theatre ||
      !booking.slot ||
      configuredAdvanceAmount === null
    )
      return undefined;

    const base = booking.slot.basePrice;
    const extraDurationHours = Math.max(
      (booking.durationHours ?? minimumBookingDurationHours) -
        minimumBookingDurationHours,
      0
    );
    const extraHours = Math.round(extraDurationHours * extraHourlyRate);

    const extras =
      Math.max(
        booking.guestCount -
        booking.theatre.baseGuests,
        0
      ) *
      booking.theatre.extraPersonPrice;

    const decoration =
      booking.decorationRequired ||
        booking.slot.decorationMandatory
        ? booking.theatre.decorationPrice
        : 0;

    const products = booking.bookingItems.reduce(
      (sum, i) => sum + i.totalPrice,
      0
    );

    const discount = Math.max(0, Number(booking.couponDiscount) || 0);
    const total = Math.max(
      base + extraHours + extras + decoration + products - discount,
      0
    );

    const resolvedAdvance =
      booking.advancePaidSnapshot && booking.advancePaidSnapshot > 0
        ? booking.advancePaidSnapshot
        : configuredAdvanceAmount;

    return {
      base,
      packageBase: base,
      extraDurationHours,
      extraHourlyRate,
      extraHours,
      extras,
      products,
      decoration,
      discount,
      total,
      advancePay: resolvedAdvance,
    };
  }, [
    booking,
    configuredAdvanceAmount,
    extraHourlyRate,
    minimumBookingDurationHours,
  ]);

  /* -----------------------------
   Temporary Local Setters
  ------------------------------ */

  const setLocation = (location: Location) =>
    setBooking((p) => ({
      ...p,
      location,
      theatre: null,
      slot: null,
      bookingId: undefined,
      advancePaidSnapshot: undefined,
      guestCount: INITIAL_BOOKING.guestCount,
      decorationRequired:
        INITIAL_BOOKING.decorationRequired,
      bookingItems: [],
      couponDiscount: 0,
      appliedCoupons: [],
      contact: undefined,
      occasion: undefined,
    }));

  const setDate = (date: Date) =>
    setBooking((p) => ({
      ...p,
      date,
      selectedDate: date,
      theatre: null,
      slot: null,
      bookingId: undefined,
      advancePaidSnapshot: undefined,
      guestCount: INITIAL_BOOKING.guestCount,
      decorationRequired:
        INITIAL_BOOKING.decorationRequired,
      bookingItems: [],
      couponDiscount: 0,
      appliedCoupons: [],
      contact: undefined,
      occasion: undefined,
    }));

  const setTimeRange = (startTime: string | null, endTime: string | null) =>
    setBooking((p) => ({
      ...p,
      startTime,
      endTime,
      durationHours: calculateDurationHours(startTime, endTime),
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
      bookingId: undefined,
      advancePaidSnapshot: undefined,
      bookingItems: [],
      couponDiscount: 0,
      appliedCoupons: [],
      occasion: undefined,
    }));

  const setGuestCount = (guestCount: number) =>
    setBooking((p) => ({
      ...p,
      guestCount,
    }));

  const setDecorationRequired = (v: boolean) =>
    setBooking((p) => ({
      ...p,
      decorationRequired: v,
    }));

  const setBookingItems = (
    items:
      | BookingItemSnapshot[]
      | ((prev: BookingItemSnapshot[]) => BookingItemSnapshot[])
  ) =>
    setBooking((p) => ({
      ...p,
      bookingItems:
        typeof items === "function"
          ? items(p.bookingItems)
          : items,
    }));

  const setBookingId = (id: string) =>
    setBooking((p) => ({ ...p, bookingId: id }));

  const setSlotLockExpiresAt = (value: string | null) =>
    setBooking((p) => {
      if (!p.slot) return p;
      return {
        ...p,
        slot: {
          ...p.slot,
          lockExpiresAt: value,
        },
      };
    });

  const setContact = (
    contact: BookingState["contact"]
  ) =>
    setBooking((p) => ({
      ...p,
      contact,
    }));

  const setOccasion = (
    key: string,
    data: Record<string, string>
  ) =>
    setBooking((p) => ({
      ...p,
      occasion: { key, data },
    }));

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

   const resetBooking = () => {
    setBooking(INITIAL_BOOKING);
    setItemsHydrated(false);
  };

  return (
    <BookingContext.Provider
      value={{
        booking: { ...booking, pricing },
        loading,
        hydrated,
        itemsHydrated,
        minimumBookingDurationHours,
        extraHourlyRate,
        refreshBooking: loadBooking,

        setLocation,
        setDate,
        setTimeRange,
        setTheatreAndSlot,
        setGuestCount,
        setDecorationRequired,
        setBookingItems,
        setBookingId,
        setSlotLockExpiresAt,
        setContact,
        setOccasion,
        setItemsHydrated,
        setCouponState,
        clearCouponState,
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
    throw new Error(
      "useBooking must be used inside BookingProvider"
    );
  }
  return ctx;
}
