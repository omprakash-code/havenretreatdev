"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { User, Mail, Minus, Plus, Lock, Balloon, ChevronLeft } from "@/components/icons";
import { useBooking } from "@/context/BookingContext";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { BOOKING_ROUTES } from "@/constants/routes";
import type { Theatre } from "@/types/theatre";
import {
  PACKAGE_EXTRA_PERSON_PRICE,
  resolvePackageGuestLimit,
} from "@/lib/package-guest-pricing";

const IST_TIMEZONE = "Asia/Kolkata";
const DECORATION_FORCED_HINT = "Selected slots come with a decorated setup.";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ContactForm({
  onContactChange,
  onDecorationChange,
  onCouponIdentityPhoneChange,
  formId = "booking-contact-form",
  onSubmit,
}: {
  onContactChange: (
    contact: {
      name: string;
      phone: string;
      email?: string;
    } | null
  ) => void;
  onDecorationChange?: (value: boolean) => void;
  onCouponIdentityPhoneChange?: (phone: string) => void;
  formId?: string;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
}) {

  /* -----------------------------
     Context
  ------------------------------ */
  const {
    booking,
    setGuestCount,
    setDecorationRequired,
  } = useBooking();
  const router = useRouter();

  const theatre = booking.theatre;

  /* -----------------------------
     Refs
  ------------------------------ */
  const nameRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const initializedDecorationSlotRef = useRef<string | null>(null);

  /* -----------------------------
     Local state
  ------------------------------ */
  const [form, setForm] = useState(() => ({
    name: booking.contact?.name ?? "",
    mobile: booking.contact?.phone ?? "",
    email: booking.contact?.email ?? "",
  }));


  const [errors, setErrors] = useState<{
    name?: string;
    mobile?: string;
    email?: string;
  }>({});

  const [largerTheatreOptions, setLargerTheatreOptions] = useState<
    Array<Pick<Theatre, "id" | "name" | "capacity">>
  >([]);
  const [decorationOptionalTheatreOptions, setDecorationOptionalTheatreOptions] =
    useState<Array<{ id: string; name: string; slotDurationLabel: string }>>(
      []
    );
  const [loadingLargerTheatres, setLoadingLargerTheatres] = useState(false);
  const [showForcedDecorationMobileHint, setShowForcedDecorationMobileHint] =
    useState(false);

  /* -----------------------------
     Validation helpers
  ------------------------------ */
  const validateName = (v: string) =>
    v.trim().length < 2 ? "Enter full name" : "";

  const validateMobile = (v: string) => {
    if (!/^\d+$/.test(v)) return "Enter Mobile numbers";
    if (v.length !== 10) return "Mobile must be 10 digits";
    return "";
  };

  const normalizeIndianMobile = (input: string) => {
    const digits = input.replace(/\D/g, "");

    if (digits.length === 0) return "";
    if (digits.length <= 10) return digits;

    // Handle values like +91XXXXXXXXXX, 0XXXXXXXXXX, or long pasted/autofill strings.
    if (digits.length === 11 && digits.startsWith("0")) {
      return digits.slice(1);
    }

    return digits.slice(-10);
  };

  const validateEmail = (v: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
      ? ""
      : "Invalid email address";

  const isFormValid =
    !errors.name &&
    !errors.mobile &&
    !errors.email &&
    form.name &&
    form.mobile &&
    form.email;


  useEffect(() => {
    if (isFormValid) {
      onContactChange({
        name: form.name,
        phone: form.mobile,
        email: form.email,
      });
    } else {
      onContactChange(null);
    }
  }, [isFormValid, form, onContactChange]);

  useEffect(() => {
    onCouponIdentityPhoneChange?.(form.mobile);
  }, [form.mobile, onCouponIdentityPhoneChange]);

  /* -----------------------------
     Autofocus first error
  ------------------------------ */
  useEffect(() => {
    if (errors.name) nameRef.current?.focus();
    else if (errors.mobile) mobileRef.current?.focus();
    else if (errors.email) emailRef.current?.focus();
  }, [errors]);

  useEffect(() => {
    const locationId = booking.location?.id;
    const bookingDate = booking.date;

    if (!theatre?.id || !locationId || !bookingDate) {
      setLargerTheatreOptions([]);
      setDecorationOptionalTheatreOptions([]);
      return;
    }

    let cancelled = false;

    const fetchLargerTheatres = async () => {
      setLoadingLargerTheatres(true);

      try {
        const dateStr = formatInTimeZone(
          bookingDate,
          IST_TIMEZONE,
          "yyyy-MM-dd"
        );

        const res = await fetch(
          `/api/theatres?locationId=${encodeURIComponent(
            locationId
          )}&date=${encodeURIComponent(dateStr)}`,
          { credentials: "include" }
        );

        const json = await res.json();
        const theatres: Theatre[] = Array.isArray(json?.data?.theatres)
          ? (json.data.theatres as Theatre[])
          : [];

        const options = theatres
          .filter(
            (item) =>
              item.id !== theatre.id &&
              Number(item.capacity) > Number(theatre.capacity)
          )
          .sort((a, b) => a.capacity - b.capacity)
          .map((item) => ({
            id: item.id,
            name: item.name,
            capacity: item.capacity,
          }));

        const optionalDecorationOptions = theatres
          .filter((item) => {
            if (item.id === theatre.id) return false;
            return item.slots.some(
              (slot) =>
                slot.decorationMandatory === false &&
                (slot.status === "AVAILABLE" ||
                  (slot.status === "LOCKED" && slot.isLockedByMe))
            );
          })
          .sort((a, b) => a.capacity - b.capacity)
          .map((item) => {
            const optionalSlots = item.slots.filter(
              (slot) =>
                slot.decorationMandatory === false &&
                (slot.status === "AVAILABLE" ||
                  (slot.status === "LOCKED" && slot.isLockedByMe))
            );
            const uniqueDurations = Array.from(
              new Set(
                optionalSlots
                  .map((slot) => Number(slot.durationMin))
                  .filter((duration) => Number.isFinite(duration) && duration > 0)
              )
            ).sort((a, b) => a - b);

            return {
              id: item.id,
              name: item.name,
              slotDurationLabel: getSlotDurationLabel(uniqueDurations),
            };
          });

        if (!cancelled) {
          setLargerTheatreOptions(options);
          setDecorationOptionalTheatreOptions(optionalDecorationOptions);
        }
      } catch {
        if (!cancelled) {
          setLargerTheatreOptions([]);
          setDecorationOptionalTheatreOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingLargerTheatres(false);
        }
      }
    };

    void fetchLargerTheatres();

    return () => {
      cancelled = true;
    };
  }, [booking.date, booking.location?.id, theatre?.capacity, theatre?.id]);

  /* -----------------------------
     Package logic
  ------------------------------ */
  const decorationForced = booking.slot?.decorationMandatory ?? false;
  const decorationSelected = decorationForced
    ? true
    : booking.decorationRequired;

  useEffect(() => {
    const slotId = booking.slot?.id ?? null;
    if (!slotId) return;

    if (initializedDecorationSlotRef.current === slotId) return;
    initializedDecorationSlotRef.current = slotId;

    if (!decorationForced && !booking.decorationRequired) {
      onDecorationChange?.(true);
      setDecorationRequired(true);
    }
  }, [
    booking.slot?.id,
    booking.decorationRequired,
    decorationForced,
    onDecorationChange,
    setDecorationRequired,
  ]);

  useEffect(() => {
    onDecorationChange?.(decorationSelected);
  }, [decorationSelected, onDecorationChange]);

  useEffect(() => {
    if (!showForcedDecorationMobileHint) return;
    const timeoutId = window.setTimeout(() => {
      setShowForcedDecorationMobileHint(false);
    }, 3000);
    return () => window.clearTimeout(timeoutId);
  }, [showForcedDecorationMobileHint]);

  useEffect(() => {
    setShowForcedDecorationMobileHint(false);
  }, [booking.slot?.id]);

  const venueGuestLimit = useMemo(
    () => resolvePackageGuestLimit(theatre, largerTheatreOptions),
    [largerTheatreOptions, theatre]
  );

  useEffect(() => {
    if (!theatre || booking.guestCount >= theatre.baseGuests) return;
    setGuestCount(theatre.baseGuests);
  }, [booking.guestCount, setGuestCount, theatre]);

  /* -----------------------------
     Guarded render
  ------------------------------ */
  if (!theatre) {
    return null;
  }

  const { baseGuests } = theatre;

  const guests = Math.min(
    Math.max(booking.guestCount, baseGuests),
    venueGuestLimit
  );

  const canDecrease = guests > baseGuests;
  const canIncrease = guests < venueGuestLimit;

  /* -----------------------------
     Render
  ------------------------------ */
  return (
    <form
      id={formId}
      autoComplete="on"
      onSubmit={onSubmit}
      className="h-auto w-full min-w-0 border border-[#2f7e7a]/30 bg-white p-4 shadow-sm sm:p-6 md:p-8 lg:h-full"
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-1xl font-bold text-[#1f2937]">
          <span className="shrink-0 border border-[#2f7e7a]/35 bg-[#edf3f1] p-1.5 text-[#347f7c]">
            <User size={16} />
          </span>
          <span className="truncate">Contact Information</span>
        </h2>

        <button
          type="button"
          onClick={() => router.push(BOOKING_ROUTES.PACKAGE)}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 border border-[#2f7e7a]/35 bg-[#edf3f1] px-3 py-1.5 text-xs font-medium text-[#245e5b] transition hover:bg-[#e3efec]"
        >
          <ChevronLeft size={14} />
          Back
        </button>
      </div>

      <div className="mb-5 md:mb-6">
        <Field
          ref={nameRef}
          label="Full Name"
          required
          name="full_name"
          type="text"
          autoComplete="name"
          icon={<User size={16} className="text-gray-400" />}
          placeholder="Enter your full name"
          value={form.name}
          error={errors.name}
          onChange={(v) => {
            setForm({ ...form, name: v });
            setErrors({ ...errors, name: validateName(v) });
          }}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 md:mb-8 md:grid-cols-2 md:gap-6">
        <div className="relative">
          <Field
            ref={mobileRef}
            label="Mobile Number"
            required
            name="mobile_number"
            type="tel"
            autoComplete="tel-national"
            prefix={
              <span className="text-sm font-medium text-gray-400">+91</span>
            }
            placeholder="Enter 10-digit mobile number"
            value={form.mobile}
            inputMode="numeric"
            error={errors.mobile}
            onChange={(v) => {
              const digits = normalizeIndianMobile(v);
              setForm({ ...form, mobile: digits });
              setErrors({
                ...errors,
                mobile: validateMobile(digits),
              });
            }}
          />
          <p
            className={`absolute right-0 top-0 text-xs ${form.mobile.length === 10
              ? "text-green-600"
              : "text-gray-400"
              }`}
          >
            {form.mobile.length}/10 digits
          </p>
        </div>


        <Field
          ref={emailRef}
          label="Email Address"
          required
          name="email"
          type="email"
          autoComplete="email"
          icon={<Mail size={16} className="text-gray-400" />}
          placeholder="you@example.com"
          value={form.email}
          error={errors.email}
          onChange={(v) => {
            setForm({ ...form, email: v });
            setErrors({
              ...errors,
              email: validateEmail(v),
            });
          }}
        />
      </div>

      {/* People + Decoration */}
      <div className="grid grid-cols-1 gap-6 border-t border-black/10 pt-5 md:grid-cols-2 md:gap-8 md:pt-6">
        {/* People */}
        <div>
          <label className="flex min-h-[24px] items-center text-sm font-medium">
            Number of People
          </label>

          <p className="text-xs text-gray-500 mb-2">
            {baseGuests} included with package · Extra people {formatCurrency(PACKAGE_EXTRA_PERSON_PRICE)}/person
          </p>

          <div className="flex h-12 items-center justify-between border border-[#d7e4e1] bg-[#f8fbfa] px-1 sm:px-2">
            <button
              type="button"
              disabled={!canDecrease}
              onClick={() => setGuestCount(guests - 1)}
              className={`w-9 h-9 flex items-center justify-center border border-[#d7e4e1] bg-white text-[#245e5b] cursor-pointer transition-all duration-150 active:scale-90 hover:bg-[#edf3f1] disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-100`}>
              <Minus size={16} strokeWidth={2.5} />
            </button>

            <span
              key={guests}
              className="min-w-[32px] text-center font-semibold text-black tabular-nums animate-[pop_0.2s_ease-out]">
              {guests}
            </span>

            <div className="relative group">
              <button
                type="button"
                disabled={!canIncrease}
                onClick={() => setGuestCount(guests + 1)}
                className={`w-9 h-9 flex items-center justify-center border border-[#d7e4e1] bg-white text-[#245e5b] transition-all duration-150 active:scale-90 cursor-pointer hover:bg-[#edf3f1] disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed`}>
                <Plus size={16} strokeWidth={2.5} />
              </button>

              {/* Tooltip */}
              {!canIncrease && (
                <div className=" absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap rounded-md bg-black text-white text-xs px-3 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-10">
                  Venue guest limit reached
                </div>
              )}
            </div>

          </div>

          {loadingLargerTheatres && (
            <p className="mt-2 text-xs text-gray-400">
              Checking larger package options...
            </p>
          )}

          {!loadingLargerTheatres && largerTheatreOptions.length > 0 && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-xs font-semibold text-slate-900">
                Need more space?
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                {largerTheatreOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => router.push(BOOKING_ROUTES.PACKAGE)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    {option.name}
                    <span className="text-slate-600">
                      Up to {option.capacity}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Decoration */}
        <div
          key={`decoration-${booking.slot?.id ?? "none"}-${decorationForced ? "included" : "optional"}`}
          className={`${decorationForced ? "animate-fade-in" : ""}`}
        >
          <div className="flex min-h-[24px] items-center gap-2 text-sm font-medium">
            <span>Decoration</span>
            {decorationForced ? (
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                <Balloon size={10} />
                Included
              </span>
            ) : (
              <span className="text-xs font-medium text-gray-500">
                {`(Just ${formatCurrency(Math.max(theatre?.decorationPrice ?? 0, 0))})`}
              </span>
            )}
          </div>

          {/* Price hint */}
          {!decorationForced && decorationSelected && theatre.decorationPrice > 0 && (
            <p className="text-xs text-gray-500 mb-2"> Make your experience more special.
            </p>
          )}
          {decorationForced && (
            <p className="mb-2 text-xs text-gray-500">
              Decor setup included for this package slot.
            </p>
          )}

          {/* Decoration Toggle – matches Quantity style */}
          <div
            className={`relative grid h-12 grid-cols-2 items-center border px-1 py-1 sm:px-2
              ${decorationForced
                ? "border-[#2f7e7a]/30 bg-[#edf3f1]"
                : "border-[#d7e4e1] bg-[#f8fbfa]"
              }`}
            aria-disabled={decorationForced}
          >
            {/* Sliding indicator */}
            <div
              className="absolute top-1 left-1 h-[calc(100%-8px)] w-[calc(50%-4px)] bg-white shadow-sm transition-transform duration-300 ease-out"
              style={{
                transform: decorationSelected
                  ? "translateX(0%)"
                  : "translateX(100%)",
              }}
            />

            {/* YES */}
            <button
              type="button"
              onClick={() => {
                onDecorationChange?.(true);
                setDecorationRequired(true);
              }}
              className={`relative z-10 flex h-full min-w-0 items-center justify-center px-1 text-[11px] font-semibold transition sm:text-sm cursor-pointer
        ${decorationSelected
                  ? "text-[#1f2937]"
                  : "text-gray-500 hover:text-[#245e5b]"
                }
        ${decorationForced ? "cursor-default" : ""}
      `}
            >
              <span className="truncate">Yes, add decoration</span>
            </button>

            {/* NO */}
            <div className="relative z-10 h-full min-w-0 group/no-option">
              <button
                type="button"
                onClick={() => {
                  if (decorationForced) {
                    setShowForcedDecorationMobileHint(true);
                    return;
                  }
                  onDecorationChange?.(false);
                  setDecorationRequired(false);
                }}
                aria-disabled={decorationForced}
                className={`relative flex h-full w-full min-w-0 items-center justify-center gap-0.5 px-1 text-[11px] font-semibold transition sm:text-sm cursor-pointer
        ${decorationForced
                    ? "cursor-not-allowed text-gray-400 opacity-60"
                    : !decorationSelected
                      ? "text-[#1f2937]"
                      : "text-gray-500 hover:text-[#245e5b]"
                  }
      `}
              >
                <span className="truncate">No, thanks</span>
                {decorationForced && <Lock size={12} className="shrink-0" />}
              </button>

              {decorationForced && (
                <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-900 opacity-0 transition-opacity duration-150 group-hover/no-option:opacity-100">
                  {DECORATION_FORCED_HINT}
                </span>
              )}
            </div>
          </div>

          {decorationForced && showForcedDecorationMobileHint && (
            <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] font-medium text-amber-900 lg:hidden">
              {DECORATION_FORCED_HINT}
            </p>
          )}

          {decorationForced && loadingLargerTheatres && (
            <p className="mt-2 text-xs text-gray-400">
              Checking packages with optional decoration slots...
            </p>
          )}

          {decorationForced &&
            !loadingLargerTheatres &&
            decorationOptionalTheatreOptions.length > 0 && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-xs font-semibold text-slate-900">
                  Prefer optional decoration?
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {decorationOptionalTheatreOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => router.push(BOOKING_ROUTES.PACKAGE)}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-slate-100"
                    >
                      {option.name}
                      <span className="text-slate-600">
                        {option.slotDurationLabel}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

        </div>
      </div>
      <button type="submit" className="hidden" aria-hidden="true" />
    </form>
  );
}

/* -----------------------------
   Reusable Input Field
------------------------------ */
const Field = React.forwardRef<
  HTMLInputElement,
  {
    label: string;
    required?: boolean;
    name?: string;
    type?: React.HTMLInputTypeAttribute;
    autoComplete?: string;
    value: string;
    placeholder?: string;
    onChange: (v: string) => void;
    error?: string;
    inputMode?: "numeric";
    maxLength?: number;
    icon?: React.ReactNode;
    prefix?: React.ReactNode;
  }
>(function Field(
  {
    label,
    required = false,
    name,
    type = "text",
    autoComplete,
    value,
    placeholder,
    onChange,
    error,
    inputMode,
    maxLength,
    icon,
    prefix,
  },
  ref
) {
  const hasPrefix = Boolean(prefix);
  const hasIcon = Boolean(icon);
  const leftPaddingClass = hasPrefix
    ? "pl-14"
    : hasIcon
      ? "pl-10"
      : "pl-3";

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-[#1f2937]">
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="relative">
        {hasPrefix && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3">
            {prefix}
          </div>
        )}
        {!hasPrefix && hasIcon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          name={name}
          type={type}
          autoComplete={autoComplete}
          required={required}
          value={value}
          placeholder={placeholder}
          inputMode={inputMode}
          maxLength={maxLength}
          aria-invalid={!!error}
          aria-describedby={error ? `${label}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full border py-2.5 pr-3 text-sm transition sm:py-3 ${leftPaddingClass}
    ${error
              ? "border-red-300 bg-red-50 outline-none"
              : "border-[#d7e4e1] bg-[#fcfdfd] outline-none focus:border-[#347f7c] focus:ring-2 focus:ring-[#347f7c]/10"
            }`}
        />
      </div>

      {error && (
        <p
          id={`${label}-error`}
          className="text-xs text-red-500 mt-1"
        >
          {error}
        </p>
      )}

    </div>
  );
});

function getSlotDurationLabel(durationsInMinutes: number[]) {
  if (durationsInMinutes.length === 0) {
    return "Optional decoration slots";
  }
  if (durationsInMinutes.length === 1) {
    const durationText = formatDurationHours(durationsInMinutes[0]);
    return `${durationText} slot`;
  }
  return durationsInMinutes
    .map((duration) => formatDurationHours(duration))
    .join(" / ");
}

function formatDurationHours(durationInMinutes: number) {
  const hours = durationInMinutes / 60;
  if (Number.isInteger(hours)) {
    return `${hours} hr`;
  }
  return `${hours.toFixed(1)} hr`;
}
