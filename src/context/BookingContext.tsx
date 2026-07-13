"use client";

import React, {
  createContext,
  useCallback,
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
} from "@/lib/package-guest-pricing";
import {
  BOOKING_SESSION_EXPIRED_MODAL_MESSAGE,
  emitBookingSessionExpired,
} from "@/lib/booking-session-expiry";
import { repriceDurationPricedItems } from "@/lib/product-duration-pricing";

/* -----------------------------
 Types
------------------------------ */

export type Location = {
  id: string;
  name: string;
  city?: string;
};

export type SelectedSchedule = {
  id: string;
  time: string;
  basePrice: number;
  decorationMandatory: boolean;
  lockExpiresAt?: string | null;
};

export type SelectedPackage = {
  id: string;
  name: string;
  capacity: number;
  basePrice: number;
  baseGuests: number;
  extraPersonPrice: number;
  decorationPrice: number;
  hourlyRate?: number;
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
  // Live variant price without any duration overage — what duration-priced
  // items are repriced from when the booked hours change.
  baseUnitPrice?: number;
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
  baseUnitPrice?: number | null;
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
    baseUnitPrice:
      typeof item.baseUnitPrice === "number" ? item.baseUnitPrice : undefined,
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
  rangePricingSnapshot?: {
    packageAmount?: number;
    extraDurationAmount?: number;
    extraDurationHours?: number;
    extraHourlyRate?: number;
    includedDurationHours?: number;
    bookedDurationHours?: number;
    extraGuestPrice?: number;
  };
  location: Location | null;
  date: Date | null;
  selectedDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  durationHours: number | null;
  package: SelectedPackage | null;
  schedule: SelectedSchedule | null;

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

  setLocation: (l: Location) => void;
  setDate: (d: Date) => void;
  setTimeRange: (startTime: string | null, endTime: string | null) => void;
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
  package: null,
  schedule: null,
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
  setItemsHydrated(false);

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

      // Resolve location: prefer explicit locationId on the package, fall back to
      // the first active location (covers single-location setups where locationId
      // may not yet be populated on existing EventPackage rows).
      let resolvedLocation: Location | null = null;
      if (data.eventPackage?.locationId) {
        resolvedLocation = {
          id: data.eventPackage.locationId,
          name: data.eventPackage.location?.name ?? "Miami",
          city: data.eventPackage.location?.city,
        };
      } else {
        try {
          const locRes = await fetch("/api/locations", { credentials: "include" });
          const locJson = await locRes.json().catch(() => null);
          if (locJson?.success && Array.isArray(locJson.data) && locJson.data.length > 0) {
            const first = locJson.data[0] as { id: string; name: string; city?: string };
            resolvedLocation = { id: first.id, name: first.name, city: first.city };
          }
        } catch {
          // non-critical: location will be null, products will not load
        }
      }

      setBooking({
        bookingId: data.id,
        rangePricingSnapshot: data.pricingSnapshot ?? undefined,
        advancePaidSnapshot:
          Number.isFinite(Number(data.advancePaid)) && Number(data.advancePaid) > 0
            ? Number(data.advancePaid)
            : undefined,
        location: resolvedLocation,
        date: data.rangeSchedule?.eventDate
          ? new Date(data.rangeSchedule.eventDate)
          : null,
        selectedDate: data.rangeSchedule?.eventDate
          ? new Date(data.rangeSchedule.eventDate)
          : null,
        startTime: data.rangeSchedule?.startTime ?? null,
        endTime: data.rangeSchedule?.endTime ?? null,
        durationHours: calculateDurationHours(
          data.rangeSchedule?.startTime,
          data.rangeSchedule?.endTime
        ),
        package: data.rangeSchedule && data.packageSnapshot
          ? {
              id: (data.packageId ?? data.id) as string,
              name: String((data.packageSnapshot as { name?: string })?.name ?? "Package"),
              capacity: Number((data.packageSnapshot as { guestLimit?: number })?.guestLimit) || 20,
              basePrice: data.baseAmount ?? 0,
              baseGuests: Number((data.packageSnapshot as { guestLimit?: number })?.guestLimit) || 20,
              extraPersonPrice: PACKAGE_EXTRA_PERSON_PRICE,
              decorationPrice: Number((data.packageSnapshot as { decorationAddonPrice?: number })?.decorationAddonPrice) || 0,
              hourlyRate: Number((data.packageSnapshot as { hourlyRate?: number })?.hourlyRate) || undefined,
            }
          : null,
        schedule: data.rangeSchedule
          ? {
              id: `range-lock:${data.rangeSchedule.lockId}`,
              time: formatSlotTime(
                data.rangeSchedule.startTime,
                data.rangeSchedule.endTime
              ),
              basePrice: data.baseAmount ?? 0,
              decorationMandatory: false,
              lockExpiresAt: data.rangeSchedule.lockExpiresAt
                ? new Date(
                    data.rangeSchedule.lockExpiresAt
                  ).toISOString()
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
      setItemsHydrated(true);

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

  // Duration-priced add-ons (e.g. Bartender) must track the booked hours, so
  // going back and changing the time range immediately updates their totals
  // to the amount the server will save on the next commit.
  useEffect(() => {
    setBooking((p) => {
      const repriced = repriceDurationPricedItems(
        p.bookingItems,
        p.durationHours
      );
      return repriced === p.bookingItems
        ? p
        : { ...p, bookingItems: repriced };
    });
  }, [booking.durationHours]);

  /* -----------------------------
   Pricing
  ------------------------------ */

  const pricing = useMemo(() => {
    if (
      !booking.package ||
      !booking.schedule ||
      configuredAdvanceAmount === null
    )
      return undefined;

      const snapshot = booking.rangePricingSnapshot ?? {};
      const packageBase = Math.max(
        Number(snapshot.packageAmount ?? booking.schedule.basePrice) || 0,
        0
      );
      const extraHours = Math.max(
        Number(snapshot.extraDurationAmount ?? 0) || 0,
        0
      );
      // Guests above the included count (within the package maximum) are free,
      // so extra guests never add cost. Legacy snapshots may still carry a
      // non-zero extraGuestPrice; ignore it and keep this at 0.
      const extras = 0;
      const products = booking.bookingItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0
      );
      // Decoration choice is free; decoration packages are sold as product add-ons.
      const decoration = 0;
      const discount = Math.max(0, Number(booking.couponDiscount) || 0);
      const total = Math.max(
        packageBase + extraHours + extras + decoration + products - discount,
        0
      );
      const resolvedAdvance =
        booking.advancePaidSnapshot && booking.advancePaidSnapshot > 0
          ? booking.advancePaidSnapshot
          : configuredAdvanceAmount;
      // Prefer server-calculated extra hours from the pricing snapshot; fall back to
      // local context state so the display is correct even if durationHours is stale.
      const snapshotExtraDurationHours = Number(snapshot.extraDurationHours ?? 0) || 0;
      const localExtraDurationHours = Math.max(
        (booking.durationHours ?? 0) - Number(snapshot.includedDurationHours ?? 0),
        0
      );
      return {
        base: packageBase + extraHours,
        packageBase,
        extraDurationHours: snapshotExtraDurationHours > 0 ? snapshotExtraDurationHours : localExtraDurationHours,
        extraHourlyRate: Number(snapshot.extraHourlyRate ?? 0) || 0,
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
  ]);

  const setLocation = (location: Location) =>
    setBooking((p) => ({
      ...p,
      location,
      package: null,
      schedule: null,
      bookingId: undefined,
      rangePricingSnapshot: undefined,
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
      package: null,
      schedule: null,
      bookingId: undefined,
      rangePricingSnapshot: undefined,
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

  const setBookingItems = useCallback(
    (
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
      })),
    []
  );

  const setBookingId = (id: string) =>
    setBooking((p) => ({ ...p, bookingId: id }));

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
        setGuestCount,
        setDecorationRequired,
        setBookingItems,
        setBookingId,
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
