"use client";
import Image from "next/image";
import {
  BadgeCheck,
  Clock3,
  DollarSign,
  PartyPopper,
  Percent,
  Info,
  CircleAlert,
  Balloon,
  Tag,
  Ticket,
  UserPlus,
  X,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsApp";
import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useBooking,
  type BookingItemSnapshot,
  type SelectedTheatre,
} from "@/context/BookingContext";
import StepIndicator from "@/components/booking/steps/StepIndicator";
import type { BookingSummaryProps } from "./types";
import { formatISTDate } from "@/lib/formatters";
import { isCouponConditionMessage } from "@/lib/coupon-feedback";
import { resolveCouponIdentityGate } from "@/lib/coupon-identity-gate";
import { useLockCountdown } from "@/hooks/booking/useLockCountdown";
import { handleBookingError } from "@/utils/handleBookingError";
import { getNumberDecorationLabel } from "@/lib/product-numbering";
import {
  BOOKING_SESSION_EXPIRED_MODAL_MESSAGE,
  emitBookingSessionExpired,
} from "@/lib/booking-session-expiry";
import { trackMetaCtaClick } from "@/lib/meta/browser";
import { getCouponDisplayCode } from "@/lib/coupon-display";
import {
  getPackageIncludedProductQuantity,
  getPackageIncludedProductExtraQuantity,
} from "@/lib/package-included-products";

const APPLY_ERROR_MAP: Record<string, string> = {
  COUPON_INACTIVE: "This coupon is disabled.",
  OUTSIDE_VALIDITY: "This coupon is expired or not active yet.",
  USAGE_LIMIT_EXCEEDED: "This coupon has reached its usage limit.",
  PER_USER_LIMIT_EXCEEDED: "You’ve reached the usage limit for this coupon.",
  RULE_NOT_SATISFIED: "Invalid coupon for this booking.",
  COUPON_NOT_STACKABLE:
    "This coupon cannot be combined with existing applied coupons.",
  COUPON_ALREADY_APPLIED: "This coupon is already applied.",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDurationHours(durationInMinutes: number) {
  const hours = durationInMinutes / 60;
  if (Number.isInteger(hours)) return `${hours} hr`;
  return `${hours.toFixed(1)} hr`;
}

type CouponFeedbackTone = "help" | "error";
type CouponFeedback = {
  message: string;
  tone: CouponFeedbackTone;
};

export default function BookingSummary({
  products = [],
  onRemoveItem,
  onSubmit,
  onInvalidSubmit,
  onSkipExtras,
  isSubmitDisabled,
  enableInvalidSubmitFeedback = false,
  invalidSubmitMessage = "Please fill details to continue.",
  submitLabel,
  hideSubmitOnMobile = false,
  onMobileInlineSubmitVisibilityChange,
  occasionPreview,
  extrasProgress,
  couponIdentityOverride,
}: BookingSummaryProps) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    booking,
    setCouponState,
    clearCouponState,
    resetBooking,
  } = useBooking();
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState<CouponFeedback | null>(null);

  const theatre = booking.theatre;
  const slot = booking.slot;
  const pricing = booking.pricing;
  const appliedCoupons = booking.appliedCoupons ?? [];
  const isFinalExtrasPage = pathname === "/booking/extras/gift";
  const canApplyCoupon = Boolean(booking.bookingId);
  const couponIdentityGate = resolveCouponIdentityGate({
    phone: couponIdentityOverride?.phone ?? booking.contact?.phone,
    email: couponIdentityOverride?.email ?? booking.contact?.email,
    userId: couponIdentityOverride?.userId,
  });
  const couponInputLocked = canApplyCoupon && couponIdentityGate.locked;
  const couponInputDisabled = couponLoading;
  const couponInputReadOnly = couponInputLocked;
  const triggerCouponLockHint = useCallback(() => {
    if (!couponInputLocked) return;
    setShowCouponLockHint(true);
    if (couponLockHintTimerRef.current) {
      clearTimeout(couponLockHintTimerRef.current);
    }
    couponLockHintTimerRef.current = setTimeout(() => {
      setShowCouponLockHint(false);
      couponLockHintTimerRef.current = null;
    }, 5000);
  }, [couponInputLocked]);
  const detailsScrollRef = useRef<HTMLDivElement | null>(null);
  const detailsContentRef = useRef<HTMLDivElement | null>(null);
  const payConfirmRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const middleRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [canScrollDetails, setCanScrollDetails] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [constrainToViewport, setConstrainToViewport] = useState(false);
  const [showInvalidSubmitError, setShowInvalidSubmitError] = useState(false);
  const [isSubmitShaking, setIsSubmitShaking] = useState(false);
  const [showInlineMobileSubmit, setShowInlineMobileSubmit] = useState(false);
  const [showCouponLockHint, setShowCouponLockHint] = useState(false);
  const couponLockHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionExpiryHandledRef = useRef(false);

  const updateScrollFades = useCallback(() => {
    if (!constrainToViewport) {
      setShowTopFade(false);
      setCanScrollDetails(false);
      setIsAtBottom(false);
      return;
    }

    const container = detailsScrollRef.current;
    if (!container) return;

    const { scrollTop, clientHeight, scrollHeight } = container;
    const atTop = scrollTop <= 4;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 4;
    const scrollable = scrollHeight > clientHeight + 4;

    setShowTopFade(!atTop);
    setCanScrollDetails(scrollable);
    setIsAtBottom(atBottom);
  }, [constrainToViewport]);

  const recomputeConstraint = useCallback(() => {
    const headerEl = headerRef.current;
    const middleEl = middleRef.current;
    const footerEl = footerRef.current;
    const detailsEl = detailsContentRef.current;

    if (!headerEl || !middleEl || !footerEl || !detailsEl) return;

    if (window.innerWidth < 1024) {
      setConstrainToViewport(false);
      return;
    }

    const rootFontSize = Number(
      getComputedStyle(document.documentElement).fontSize.replace("px", "")
    ) || 16;
    const maxHeight = window.innerHeight - rootFontSize * 8;

    const middleStyles = getComputedStyle(middleEl);
    const middlePaddingY =
      Number.parseFloat(middleStyles.paddingTop || "0") +
      Number.parseFloat(middleStyles.paddingBottom || "0");

    const totalNaturalHeight =
      headerEl.offsetHeight +
      footerEl.offsetHeight +
      middlePaddingY +
      detailsEl.scrollHeight;

    // Prevent flicker when content sits near the threshold.
    // This avoids fast height bumps while products are added/removed.
    const enableAt = maxHeight + 8;
    const disableAt = maxHeight - 12;

    setConstrainToViewport((prev) => {
      if (prev) return totalNaturalHeight > disableAt;
      return totalNaturalHeight > enableAt;
    });
  }, []);

  useEffect(() => {
    recomputeConstraint();
    updateScrollFades();

    const raf = window.requestAnimationFrame(updateScrollFades);
    const onResize = () => {
      recomputeConstraint();
      updateScrollFades();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [
    recomputeConstraint,
    updateScrollFades,
    products.length,
    appliedCoupons.length,
    canApplyCoupon,
    couponCode,
    couponLoading,
    showCouponInput,
    extrasProgress?.length,
  ]);

  useEffect(() => {
    if (!canApplyCoupon) return;
    if (appliedCoupons.length > 0) {
      setShowCouponInput(false);
    }
  }, [appliedCoupons.length, canApplyCoupon]);

  useEffect(() => {
    if (!couponInputLocked) {
      if (couponLockHintTimerRef.current) {
        clearTimeout(couponLockHintTimerRef.current);
        couponLockHintTimerRef.current = null;
      }
      if (!showCouponLockHint) return;
      const rafId = window.requestAnimationFrame(() => {
        setShowCouponLockHint(false);
      });
      return () => window.cancelAnimationFrame(rafId);
    }
  }, [couponInputLocked, showCouponLockHint]);

  useEffect(() => {
    return () => {
      if (couponLockHintTimerRef.current) {
        clearTimeout(couponLockHintTimerRef.current);
      }
    };
  }, []);

  const resolvedSubmitLabel =
    submitLabel ?? (isFinalExtrasPage ? "Continue to Payment" : "Save & Continue");
  const resolvedSubmitLabelText =
    typeof resolvedSubmitLabel === "string" ||
    typeof resolvedSubmitLabel === "number" ||
    typeof resolvedSubmitLabel === "bigint"
      ? String(resolvedSubmitLabel)
      : null;
  const showSubmitArrow = !isFinalExtrasPage;
  const isTrulySubmitDisabled =
    Boolean(isSubmitDisabled) && !enableInvalidSubmitFeedback;

  const triggerInvalidSubmitFeedback = useCallback(() => {
    setShowInvalidSubmitError(true);
    setIsSubmitShaking(false);
    window.requestAnimationFrame(() => {
      setIsSubmitShaking(true);
    });
  }, []);

  useEffect(() => {
    if (!showInvalidSubmitError) return;
    const timeoutId = window.setTimeout(() => {
      setIsSubmitShaking(false);
    }, 380);
    return () => window.clearTimeout(timeoutId);
  }, [showInvalidSubmitError]);

  useEffect(() => {
    if (!isSubmitDisabled) {
      setShowInvalidSubmitError(false);
      setIsSubmitShaking(false);
    }
  }, [isSubmitDisabled]);

  useEffect(() => {
    if (!hideSubmitOnMobile) return;
    if (typeof window === "undefined") return;

    const target = payConfirmRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const nextVisible =
          entries.some((entry) => entry.isIntersecting) &&
          window.innerWidth < 1024;
        setShowInlineMobileSubmit(nextVisible);
      },
      {
        root: null,
        threshold: 0.35,
        rootMargin: "0px 0px -20% 0px",
      }
    );

    observer.observe(target);

    const syncOnResize = () => {
      if (window.innerWidth >= 1024) {
        setShowInlineMobileSubmit(false);
      }
    };
    window.addEventListener("resize", syncOnResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncOnResize);
    };
  }, [hideSubmitOnMobile]);

  useEffect(() => {
    onMobileInlineSubmitVisibilityChange?.(showInlineMobileSubmit);
  }, [showInlineMobileSubmit, onMobileInlineSubmitVisibilityChange]);

  const handleSubmitClick = () => {
    if (isSubmitDisabled) {
      if (enableInvalidSubmitFeedback) {
        triggerInvalidSubmitFeedback();
        onInvalidSubmit?.();
      }
      return;
    }
    setShowInvalidSubmitError(false);
    if (
      isFinalExtrasPage ||
      resolvedSubmitLabelText?.toLowerCase().includes("payment")
    ) {
      trackMetaCtaClick({
        ctaName: resolvedSubmitLabelText ?? "Continue to Payment",
        ctaLocation: "Booking Summary",
        destination: "/booking/payment",
      });
    }
    onSubmit?.();
  };
  const handleSessionExpiry = useCallback(async () => {
    if (sessionExpiryHandledRef.current) return;
    sessionExpiryHandledRef.current = true;

    try {
      await fetch("/api/bookings/release", {
        method: "POST",
        keepalive: true,
      });
    } catch {
      // Best-effort release. Server-side expiry guards still handle stale sessions.
    } finally {
      clearCouponState();
      emitBookingSessionExpired({
        message: BOOKING_SESSION_EXPIRED_MODAL_MESSAGE,
      });
    }
  }, [clearCouponState]);
  const lockExpiresAt =
    booking.slot && "lockExpiresAt" in booking.slot
      ? (booking.slot as { lockExpiresAt?: string | null }).lockExpiresAt ?? null
      : null;
  useLockCountdown({
    lockExpiresAt: booking.bookingId ? lockExpiresAt : null,
    warningThresholdSec: 60,
    onExpire: () => {
      void handleSessionExpiry();
    },
  });

  /* -----------------------------
     HARD GUARD (no broken UI)
  ------------------------------ */
  if (!theatre || !slot || !pricing) {
    return (
      <div className="bg-white rounded-2xl border border-gray-300 p-6 shadow-sm w-full">
        <h3 className="text-lg font-bold mb-4 text-black">
          Your Booking Summary
        </h3>
        <p className="text-sm text-gray-400">
          Select a slot to see pricing details.
        </p>
      </div>
    );
  }

  /* -----------------------------
     NORMALIZED DISPLAY VALUES
     (never NaN / undefined)
  ------------------------------ */
  const basePrice = Number(pricing.base) || 0;
  const extraHoursPrice = Number(pricing.extraHours) || 0;
  const extraDurationHours = Number(pricing.extraDurationHours) || 0;
  const extraHourlyRate = Number(pricing.extraHourlyRate) || 0;
  const rentalDurationHours = Number(booking.durationHours) || 0;
  const includedRentalHours = Math.max(rentalDurationHours - extraDurationHours, 0);
  const extrasPrice = Number(pricing.extras) || 0;
  const decorationPrice = Number(pricing.decoration) || 0;
  const productsPrice = Number(pricing?.products ?? 0);
  const discountPrice = Number(pricing.discount) || 0;
  const totalPrice = Number(pricing.total) || 0;
  const advancePay = Number(pricing.advancePay) || 0;
  const remainingAtTheatre = Math.max(totalPrice - advancePay, 0);
  const subtotalBeforeDiscount =
    basePrice + extraHoursPrice + extrasPrice + decorationPrice + productsPrice;
  const displayedGuestCount = Math.max(
    booking.guestCount ?? theatre.baseGuests,
    theatre.baseGuests
  );
  const extraGuestCount = Math.max(displayedGuestCount - theatre.baseGuests, 0);
  const fallbackOccasionLabel = booking.occasion?.key
    ? booking.occasion.key
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
    : undefined;
  const occasionLabel = occasionPreview?.label ?? fallbackOccasionLabel;
  const occasionRawData = occasionPreview?.data ?? booking.occasion?.data ?? {};
  const occasionEntries = Object.entries(occasionRawData)
    .map(([key, value]) => ({
      label: key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()),
      value: String(value ?? "").trim(),
    }))
    .filter((item) => item.value.length > 0);
  const showApplyAction = couponLoading || Boolean(couponCode.trim());
  const isExtrasFlowPage = pathname.startsWith("/booking/extras/");
  const headerStepText = (() => {
    if (pathname.startsWith("/booking/payment")) return "Review and payment";
    if (pathname.startsWith("/booking/agreement")) return "Review and signature";
    return undefined;
  })();
  const summaryStepNumber = (() => {
    if (pathname.startsWith("/booking/contact")) return 2;
    if (pathname.startsWith("/booking/occasion")) return 3;
    if (pathname.startsWith("/booking/extras/")) return 4;
    if (pathname.startsWith("/booking/agreement")) return 5;
    if (pathname.startsWith("/booking/payment")) return 6;
    return null;
  })();
  const extrasSubProgress =
    pathname.startsWith("/booking/extras/") && extrasProgress?.length
      ? {
          current: Math.max(
            1,
            (extrasProgress.findIndex((step) => step.active) ?? -1) + 1
          ),
          total: extrasProgress.length,
        }
      : undefined;
  async function syncBookingItemsBeforeCoupon() {
    if (!booking.bookingId) return;
    const res = await fetch("/api/bookings/items/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: booking.bookingId,
        items: booking.bookingItems,
        guestCount: booking.guestCount,
        decorationRequired: booking.slot?.decorationMandatory
          ? true
          : booking.decorationRequired,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      handleBookingError(json, router, {
        resetBooking,
        fallbackMessage: "Unable to save selected add-ons.",
      });
      return false;
    }
    return true;
  }

  async function handleApplyCoupon() {
    if (!booking.bookingId) {
      setCouponFeedback({ message: "Booking is not ready yet.", tone: "error" });
      return;
    }
    if (couponInputLocked) {
      triggerCouponLockHint();
      return;
    }
    if (!couponCode.trim()) {
      setCouponFeedback({ message: "Enter coupon code.", tone: "help" });
      return;
    }

    setCouponFeedback(null);
    setCouponLoading(true);
    try {
      const committed = await syncBookingItemsBeforeCoupon();
      if (!committed) return;

      const res = await fetch("/api/bookings/apply-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          couponCode: couponCode.trim().toUpperCase(),
          contactPhone:
            couponIdentityOverride?.phone?.trim() || booking.contact?.phone || null,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        const handled = handleBookingError(data, router, {
          resetBooking,
          fallbackMessage: "Unable to apply coupon.",
          suppressUnhandledToast: true,
        });
        if (handled) return;

        const reason = data?.reason as string | undefined;
        const severity = data?.severity as "error" | "info" | "warning" | undefined;
        const message =
          data?.message ||
          (reason ? APPLY_ERROR_MAP[reason] : undefined) ||
          "Unable to apply coupon.";
        setCouponFeedback({
          message,
          tone: isCouponConditionMessage({ reason, message, severity }) ? "help" : "error",
        });
        return;
      }

      const discountAmount = Number(data.discountAmount ?? 0);
      const coupons = Array.isArray(data.appliedCoupons)
        ? data.appliedCoupons
        : [];
      if (discountAmount <= 0 || coupons.length === 0) {
        setCouponFeedback({
          message: "Invalid coupon for this booking.",
          tone: "error",
        });
        return;
      }

      setCouponState({
        discount: discountAmount,
        coupons,
      });
      setCouponCode("");
      setShowCouponInput(false);
      setCouponFeedback(null);
    } catch {
      setCouponFeedback({ message: "Failed to apply coupon.", tone: "error" });
    } finally {
      setCouponLoading(false);
    }
  }

  async function handleRemoveCoupon(couponId: string) {
    if (!booking.bookingId) return;

    setCouponFeedback(null);
    setCouponLoading(true);
    try {
      const committed = await syncBookingItemsBeforeCoupon();
      if (!committed) return;

      const res = await fetch("/api/bookings/remove-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          couponId,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        const handled = handleBookingError(data, router, {
          resetBooking,
          fallbackMessage: "Failed to remove coupon.",
          suppressUnhandledToast: true,
        });
        if (handled) return;
        setCouponFeedback({
          message: data?.message || "Failed to remove coupon.",
          tone: isCouponConditionMessage({
            reason: data?.reason as string | undefined,
            message: data?.message as string | undefined,
            severity: data?.severity as "error" | "info" | "warning" | undefined,
          })
            ? "help"
            : "error",
        });
        return;
      }

      setCouponState({
        discount: Number(data.discountAmount ?? 0),
        coupons: Array.isArray(data.appliedCoupons) ? data.appliedCoupons : [],
      });

      if (Number(data.discountAmount ?? 0) <= 0) {
        clearCouponState();
        setShowCouponInput(true);
      }

      setCouponFeedback(null);
    } catch {
      setCouponFeedback({ message: "Failed to remove coupon.", tone: "error" });
    } finally {
      setCouponLoading(false);
    }
  }

  return (
    <div
      className="w-full border border-[#2f7e7a]/20 bg-[#f6f8f7] lg:flex lg:flex-col lg:h-auto"
    >

      <div ref={headerRef} className="shrink-0 border-b border-[#d7e4e1] bg-white">
        <div className="relative px-4 py-3">
          {isExtrasFlowPage && onSkipExtras && (
            <button
              type="button"
              onClick={onSkipExtras}
              className="absolute right-4 top-3 inline-flex h-8 items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 transition-colors hover:border-gray-300 hover:text-black cursor-pointer"
            >
              Skip
            </button>
          )}
          <div className="px-12 text-center">
            <h3 className="text-lg font-bold text-black">
              Your Booking Summary
            </h3>

            {headerStepText && (
              <p className="mt-1 truncate text-xs font-medium text-gray-600">
                {headerStepText}
              </p>
            )}
          </div>

          {summaryStepNumber && (
            <StepIndicator
              currentStep={summaryStepNumber}
              extrasSubProgress={extrasSubProgress}
              className="mt-2 hidden lg:block !max-w-none !px-0 !py-0"
            />
          )}

        </div>
      </div>

      <div
        ref={middleRef}
        className="relative min-h-0 flex-1 overflow-visible bg-[#f6f8f7] px-2 pt-2 md:px-4 md:pt-3"
      >
        <div
          ref={detailsScrollRef}
          onScroll={updateScrollFades}
          className="h-auto overflow-visible pb-3.5"
        >
          <div ref={detailsContentRef} className="space-y-3">
            <section className="border border-[#d7e4e1] bg-white p-3.5 [&>div:last-child]:mb-0 [&>div:last-child]:border-b-0 [&>div:last-child]:pb-0">
              <SummaryRow
                label="Package"
                value={theatre.name}
                labelClassName="text-gray-500 text-sm font-normal"
                icon={Ticket}
                customLabel={
                  <span className="inline-flex items-start gap-1.5">
                    <Ticket size={14} className="mt-0.5 text-gray-400" />
                    <span>
                      <span className="block">Package</span>
                      <span className="mt-0.5 block text-xs font-normal text-gray-400">
                        {formatCurrency(basePrice)} · {formatDurationHours(includedRentalHours * 60)} included
                      </span>
                    </span>
                  </span>
                }
              />

              <SummaryRow
                label="Date & Slot"
                value={`${booking.date ? formatISTDate(booking.date) : "—"}, ${slot.time}`}
                labelClassName="text-gray-500 text-sm font-normal"
                customLabel={
                  <span className="inline-flex items-center gap-1.5">                    
                    <Clock3 size={14} className="text-gray-400" /> Slot
                  </span>
                }
              />

              {extraHoursPrice > 0 && (
                <SummaryRow
                  label={`Extra Hours (${formatDurationHours(extraDurationHours * 60)})`}
                  value={formatCurrency(extraHoursPrice)}
                  labelClassName="text-gray-500 text-sm font-normal"
                  customLabel={
                    <span className="inline-flex items-start gap-1.5">
                      <DollarSign size={14} className="mt-0.5 text-gray-400" />
                      <span>
                        <span className="block">
                          Extra Hours ({formatDurationHours(extraDurationHours * 60)})
                        </span>
                        <span className="mt-0.5 block text-xs font-normal text-gray-400">
                          {formatDurationHours(extraDurationHours * 60)} × {formatCurrency(extraHourlyRate)}/hr
                        </span>
                      </span>
                    </span>
                  }
                />
              )}

              <SummaryRow
                label="People"
                value={`${displayedGuestCount}`}
                labelClassName="text-gray-500 text-sm font-normal"
                customLabel={
                  <span className="inline-flex items-start gap-1.5">
                    <UserPlus size={14} className="mt-0.5 text-gray-400" />
                    <span>
                      <span className="block">People</span>
                      <span className="mt-0.5 block text-xs font-normal text-gray-400">
                        {theatre.baseGuests} included with package
                        {extraGuestCount > 0
                          ? ` · ${extraGuestCount} extra × ${formatCurrency(
                              theatre.extraPersonPrice
                            )}`
                          : ""}
                      </span>
                    </span>
                  </span>
                }
              />

              {extrasPrice > 0 && (
                <SummaryRow
                  label={`Extra Guests (${extraGuestCount})`}
                  value={formatCurrency(extrasPrice)}
                  labelClassName="text-gray-500 text-sm font-normal"
                  icon={UserPlus}
                />
              )}

              {decorationPrice > 0 && (
                <SummaryRow
                  label="Decoration"
                  value={formatCurrency(decorationPrice)}
                  labelClassName="text-gray-500 text-sm font-normal"
                  icon={Balloon}
                />
              )}
            </section>

            {(occasionLabel || occasionEntries.length > 0) && (
              <section className="border border-[#d7e4e1] bg-white p-3.5">
                {occasionLabel && (
                  <SummaryRow
                    label="Occasion"
                    value={occasionLabel}
                    labelClassName="text-gray-500 text-sm font-normal"
                    icon={PartyPopper}
                  />
                )}

                {occasionEntries.length > 0 && (
                  <div className="space-y-2">
                    {occasionEntries.map((entry) => (
                      <div
                        key={`${entry.label}-${entry.value}`}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <p className="text-gray-500">{entry.label}</p>
                        <p className="truncate font-semibold text-gray-900">{entry.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {(products.length > 0 || productsPrice > 0) && (
              <section className="border border-[#d7e4e1] bg-white p-3.5">
                <p className="mb-2 text-sm font-semibold text-gray-700">Add-ons</p>

                <div className="space-y-2">
                  {products.map((item) => (
                    <SummaryProductRow
                      key={item.id}
                      item={item}
                      theatre={theatre}
                      onRemoveItem={onRemoveItem}
                    />
                  ))}
                </div>

                {productsPrice > 0 && (
                  <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-3">
                    <p className="text-sm font-semibold text-gray-700">Add-ons Total</p>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(productsPrice)}</p>
                  </div>
                )}
              </section>
            )}

            {(canApplyCoupon || appliedCoupons.length > 0) && (
              <section className="border border-[#d7e4e1] bg-white p-3.5">
                {canApplyCoupon && (
                  <div className="space-y-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-700">Coupon</p>
                      <button
                        type="button"
                        onClick={() => setShowCouponInput((prev) => !prev)}
                        className="cursor-pointer text-xs font-medium text-gray-500 underline underline-offset-2 transition-colors hover:text-gray-800"
                      >
                        {showCouponInput
                          ? "Enter coupon code"
                          : appliedCoupons.length > 0
                            ? "Add another coupon"
                            : "Do you have a coupon?"}
                      </button>
                    </div>

                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        showCouponInput
                          ? "mt-2.5 max-h-32 translate-y-0 opacity-100"
                          : "mt-0 max-h-0 -translate-y-1 opacity-0 pointer-events-none"
                      }`}
                      aria-hidden={!showCouponInput}
                    >
                      <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-green-600">
                          <Percent size={12} />
                        </div>

                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => {
                            if (couponInputReadOnly) return;
                            setCouponCode(e.target.value.toUpperCase());
                            if (couponFeedback) {
                              setCouponFeedback(null);
                            }
                          }}
                          onClick={couponInputReadOnly ? triggerCouponLockHint : undefined}
                          onFocus={couponInputReadOnly ? triggerCouponLockHint : undefined}
                          placeholder="Enter coupon code"
                          disabled={couponInputDisabled}
                          readOnly={couponInputReadOnly}
                          aria-disabled={couponInputReadOnly}
                          className="h-8 min-w-0 flex-1 rounded-md border border-dashed border-green-500 bg-white px-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-black no-underline outline-none placeholder:tracking-[0.06em] placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-70 read-only:cursor-not-allowed read-only:bg-gray-50"
                        />

                        {showApplyAction && (
                          <button
                            type="button"
                            disabled={couponInputDisabled || couponInputReadOnly || !couponCode.trim()}
                            onClick={handleApplyCoupon}
                            className="shrink-0 cursor-pointer text-xs font-semibold text-green-700 disabled:text-gray-400"
                          >
                            {couponLoading ? "Applying..." : "Apply"}
                          </button>
                        )}
                      </div>
                    </div>
                    {couponInputLocked ? (
                      <p
                        className={`overflow-hidden text-xs font-medium text-sky-700 transition-all duration-200 ${
                          showCouponLockHint
                            ? "mt-1 max-h-10 translate-y-0 opacity-100"
                            : "mt-0 max-h-0 -translate-y-1 opacity-0"
                        }`}
                      >
                        {couponIdentityGate.message}
                      </p>
                    ) : null}

                    {couponFeedback ? (
                      <div
                        className={`mt-1 flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                          couponFeedback.tone === "help"
                            ? "border-sky-200 bg-sky-50 text-sky-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}
                      >
                        {couponFeedback.tone === "help" ? (
                          <Info size={13} className="mt-[1px] shrink-0" />
                        ) : (
                          <CircleAlert size={13} className="mt-[1px] shrink-0" />
                        )}
                        <span>{couponFeedback.message}</span>
                      </div>
                    ) : null}
                  </div>
                )}

                {appliedCoupons.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {appliedCoupons.map((coupon) => (
                      <div
                        key={coupon.id}
                        className="relative overflow-hidden border border-dashed border-[#d7e4e1] bg-white px-4 py-2.5"
                      >
                        <span className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-[#d7e4e1] bg-[#f6f8f7]" />
                        <span className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-[#d7e4e1] bg-[#f6f8f7]" />

                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex items-center gap-2">
                            <Tag size={14} className="text-green-700" />
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {getCouponDisplayCode(coupon.code)}
                            </p>
                            <p className="shrink-0 text-sm font-semibold text-green-700">
                              (Saved {formatCurrency(Number(coupon.discountAmount || 0))})
                            </p>
                          </div>
                          {canApplyCoupon && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCoupon(coupon.id)}
                              className="shrink-0 cursor-pointer text-xs font-medium text-gray-500 hover:text-red-700"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="border border-[#d7e4e1] bg-white p-3.5">
              {discountPrice > 0 && (
                <SummaryRow
                  label="Subtotal Before Discount"
                  value={formatCurrency(subtotalBeforeDiscount)}
                  labelClassName="text-gray-500 text-sm font-normal"
                />
              )}

              {discountPrice > 0 && (
                <SummaryRow
                  label="Coupon Discount"
                  value={`-${formatCurrency(discountPrice)}`}
                  labelClassName="text-gray-500 text-sm font-normal"
                />
              )}

              <div
                ref={payConfirmRef}
                className="border border-[#2f7e7a]/20 bg-[#edf3f1] px-4 py-2 text-center"
              >
                <p className="text-sm font-semibold text-[#245e5b]">
                  Pay {formatCurrency(advancePay)} only to confirm
                </p>
                <p className="text-xs text-[#347f7c]">
                  Remaining at venue: {formatCurrency(remainingAtTheatre)}
                </p>
              </div>
            </section>

          </div>
        </div>

        {constrainToViewport && canScrollDetails && !isAtBottom && (
          <button
            type="button"
            onClick={() => {
              const container = detailsScrollRef.current;
              if (!container) return;
              container.scrollTo({
                top: container.scrollHeight,
                behavior: "smooth",
              });
            }}
            className="summary-scroll-indicator absolute bottom-3 left-1/2 z-20 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 transition cursor-pointer"
            aria-label="Scroll to bottom"
          >
            <span className="summary-scroll-indicator__arrow" aria-hidden="true" />
          </button>
        )}

        <div
          className={`pointer-events-none absolute left-0 right-0 top-0 h-7 bg-gradient-to-b from-[#f6f8f7] via-[#f6f8f7]/92 to-transparent transition-opacity duration-200 ${
            constrainToViewport && showTopFade ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      <div
        ref={footerRef}
        className="shrink-0 border-t border-[#d7e4e1] bg-white p-4"
      >
        <div
          className={`mb-2 flex justify-between text-lg font-bold ${
            hideSubmitOnMobile && !showInlineMobileSubmit ? "hidden lg:flex" : ""
          }`}
        >
          <span>Total Amount</span>
          <span>{formatCurrency(totalPrice)}</span>
        </div>

        <div className={hideSubmitOnMobile && !showInlineMobileSubmit ? "hidden lg:block" : ""}>
          <button
            type="button"
            onClick={handleSubmitClick}
            disabled={isTrulySubmitDisabled}
            className={`summary-submit-btn w-full ${
              isTrulySubmitDisabled
                ? "is-disabled cursor-not-allowed"
                : "cursor-pointer"
              } ${isSubmitShaking ? "is-shaking" : ""}`}
          >
            <div className="summary-submit-btn__surface">
              <span className="summary-submit-btn__content">
                {resolvedSubmitLabel}
                {showSubmitArrow && <span className="summary-submit-btn__arrow" aria-hidden="true" />}
              </span>
            </div>
          </button>
          {showInvalidSubmitError && (
            <p className="mt-2 text-center text-xs text-red-600">
              {invalidSubmitMessage}
            </p>
          )}
        </div>

        <p className="mt-4 flex items-center justify-center gap-2 border-t border-black/10 px-4 pt-2 text-xs text-gray-500">
          <BadgeCheck size={16} className="text-[#347f7c]" />
          Instant confirmation after successful payment.
        </p>

        <p className="mt-2 flex items-center justify-center gap-2 px-4 text-xs text-gray-500">
          <WhatsAppIcon size={14} className="text-green-500" />
          Tickets will be delivered via WhatsApp and email.
        </p>
      </div>

      <style jsx>{`
        .summary-submit-btn {
          position: relative;
          border: 1px solid #347f7c;
          background-color: #347f7c;
        }

        .summary-submit-btn:focus-visible {
          outline: 2px solid rgba(52, 127, 124, 0.3);
          outline-offset: 4px;
        }

        .summary-submit-btn__surface {
          width: 100%;
          background-color: #347f7c;
        }

        .summary-submit-btn__content {
          display: inline-flex;
          width: 100%;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          padding: 0.95rem 1.25rem;
          color: #ffffff;
          font-weight: 700;
          line-height: 1;
        }

        .summary-submit-btn__arrow {
          position: relative;
          width: 0;
          height: 0.12rem;
          background: #ffffff;
          opacity: 0;
          transform: translateX(-6px);
          transition:
            width 220ms cubic-bezier(0.22, 0.61, 0.36, 1),
            opacity 220ms cubic-bezier(0.22, 0.61, 0.36, 1),
            transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1);
        }

        .summary-submit-btn__arrow::before {
          content: "";
          position: absolute;
          right: 0;
          top: 50%;
          width: 0.45rem;
          height: 0.45rem;
          border-top: 0.12rem solid #ffffff;
          border-right: 0.12rem solid #ffffff;
          transform: translateY(-50%) rotate(45deg);
        }

        .summary-submit-btn:not(.is-disabled):hover .summary-submit-btn__arrow {
          width: 1rem;
          opacity: 1;
          transform: translateX(0);
        }

        .summary-submit-btn:not(.is-disabled):active .summary-submit-btn__content {
          transform: translateY(2px);
        }

        .summary-submit-btn.is-disabled {
          border-color: #d1d5db;
          background: #d1d5db;
        }

        .summary-submit-btn.is-disabled .summary-submit-btn__surface {
          background: #e5e7eb;
        }

        .summary-submit-btn.is-disabled .summary-submit-btn__content {
          color: #9ca3af;
        }

        .summary-submit-btn.is-shaking {
          animation: submitShake 0.35s ease-in-out;
        }

        @keyframes submitShake {
          0%,
          100% {
            transform: translateX(0);
          }
          20% {
            transform: translateX(-4px);
          }
          40% {
            transform: translateX(4px);
          }
          60% {
            transform: translateX(-3px);
          }
          80% {
            transform: translateX(3px);
          }
        }

        .summary-scroll-indicator {
          box-shadow: 0 6px 14px -12px rgba(17, 24, 39, 0.35);
        }

        .summary-scroll-indicator__arrow {
          position: relative;
          top: -1px;
          width: 0.12rem;
          height: 0.66rem;
          background: currentColor;
          border-radius: 9999px;
          opacity: 0.9;
          animation: summaryScrollArrowBob 1.15s ease-in-out infinite;
        }

        .summary-scroll-indicator__arrow::before {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -0.04rem;
          width: 0.38rem;
          height: 0.38rem;
          border-right: 0.12rem solid currentColor;
          border-bottom: 0.12rem solid currentColor;
          transform: translateX(-50%) rotate(45deg);
        }

        @keyframes summaryScrollArrowBob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(2px);
          }
        }
      `}</style>
    </div>
  );
}

/* -----------------------------
   Small helper
------------------------------ */
function SummaryProductRow({
  item,
  theatre,
  onRemoveItem,
}: {
  item: BookingItemSnapshot;
  theatre: SelectedTheatre | null;
  onRemoveItem?: (id: string) => void;
}) {
  const includedQuantity = getPackageIncludedProductQuantity(theatre, {
    productSlug: item.productSlug,
    name: item.productName,
  });
  const extraQuantity = getPackageIncludedProductExtraQuantity(
    theatre,
    {
      productSlug: item.productSlug,
      name: item.productName,
    },
    item.quantity
  );
  const isPackageIncluded = includedQuantity > 0;
  const canRemove = Boolean(onRemoveItem) && !isPackageIncluded;
  const lineItems = [`${item.variantLabel} x ${item.quantity}`];

  if (isPackageIncluded) {
    lineItems.push(`${includedQuantity} included`);
  }

  if (extraQuantity > 0) {
    lineItems.push(`${extraQuantity} extra charged`);
  }

  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        {item.productImage && (
          <div className="relative h-9 w-9 shrink-0 overflow-hidden border border-[#d7e4e1] bg-white">
            <Image
              src={item.productImage}
              alt={item.productName}
              fill
              className="object-cover"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate pr-2 font-semibold text-gray-900">
            {item.productName}
          </p>
          <p className="text-xs font-medium text-gray-600">
            {lineItems.join(" • ")}
          </p>
          {item.ledNumber ? (
            <p className="text-[11px] text-gray-500">
              {getNumberDecorationLabel({
                slug: item.productSlug,
                name: item.productName,
              })}
              : {item.ledNumber}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pl-2">
        <p className="font-bold text-gray-900">
          {item.totalPrice > 0 ? formatCurrency(item.totalPrice) : "Included"}
        </p>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemoveItem?.(item.id)}
            className="cursor-pointer text-gray-400 transition hover:text-red-500"
            aria-label={`Remove ${item.productName}`}
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  labelClassName,
  icon: Icon,
  customLabel,
}: {
  label: string;
  value: string;
  labelClassName?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  customLabel?: ReactNode;
}) {
  return (
    <div className="flex justify-between pb-3 border-b border-black/10 mb-3">
      <span className={labelClassName ?? "text-gray-700 text-sm font-semibold"}>
        {customLabel ? customLabel : Icon ? (
          <span className="inline-flex items-center gap-1.5">
            <Icon size={14} className="text-gray-400" />
            {label}
          </span>
        ) : label}
      </span>
      <span className="text-gray-900 text-sm font-bold">
        {value}
      </span>
    </div>
  );
}
