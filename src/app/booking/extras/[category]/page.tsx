"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useBooking } from "@/context/BookingContext";
import StepsIndicator from "@/components/booking/steps/StepIndicator";
import BookingSummary from "@/components/booking/summary/BookingSummary";
import ProductList from "@/components/booking/products/ProductList";
import { ChevronLeft } from "@/components/icons";

import { useBookingItems } from "@/hooks/booking/useBookingItems";
import { useBookingProductCategories } from "@/hooks/booking/useBookingProductCategories";
import TermsModal from "@/components/booking/terms/TermsModal";
import { BOOKING_ROUTES } from "@/constants/routes";
import { handleBookingError } from "@/utils/handleBookingError";
import MobileStickyAction from "@/components/booking/global/MobileStickyAction";
import { ensureRazorpayCheckoutLoaded } from "@/lib/razorpay/checkout-client";

/* --------------------------------
  Page
--------------------------------- */

export default function ExtrasCategoryPage() {
  const router = useRouter();
  const params = useParams();
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showInlineSummarySubmit, setShowInlineSummarySubmit] = useState(false);


  /* -----------------------------
     Resolve category (SAFE)
  ------------------------------ */
  const rawCategory = params.category as string | undefined;
  const category = rawCategory?.toLowerCase() ?? "";

  /* -----------------------------
     Hooks (ALWAYS CALLED)
  ------------------------------ */
  const {
    fetchItems,
  } = useBookingItems();

  const {
    booking,
    hydrated,
    setBookingItems,
    itemsHydrated,
    setCouponState,
    clearCouponState,
    resetBooking,
  } = useBooking();
  const bookingId = booking.bookingId;
  const { categories: bookingCategories, loading: categoriesLoading } =
    useBookingProductCategories(booking.location?.id);

  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    if (itemsHydrated) return;
    if (fetchedRef.current === bookingId) return;

    fetchedRef.current = bookingId;
    fetchItems();
  }, [bookingId, fetchItems, itemsHydrated]);

  useEffect(() => {
    if (!booking.bookingId || !itemsHydrated) return;
    if ((booking.appliedCoupons?.length ?? 0) === 0) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/bookings/items/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: booking.bookingId,
            items: booking.bookingItems,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          handleBookingError(data, router, {
            resetBooking,
            fallbackMessage: "Unable to refresh booking items.",
          });
          return;
        }

        const discount = Number(data.discountAmount ?? 0);
        const coupons = Array.isArray(data.appliedCoupons)
          ? data.appliedCoupons
          : [];

        if (coupons.length === 0 || discount <= 0) {
          clearCouponState();
          return;
        }

        const nextCoupons = coupons as Array<{
          id: string;
          code: string;
          status: "RESERVED" | "CONFIRMED" | "RELEASED";
          discountAmount: number;
        }>;

        const unchanged =
          discount === (Number(booking.couponDiscount) || 0) &&
          nextCoupons.length === (booking.appliedCoupons?.length ?? 0) &&
          nextCoupons.every((coupon, index) => {
            const current = booking.appliedCoupons?.[index];
            return (
              current?.id === coupon.id &&
              current?.status === coupon.status &&
              Number(current?.discountAmount ?? 0) ===
              Number(coupon.discountAmount ?? 0)
            );
          });

        if (unchanged) return;

        setCouponState({
          discount,
          coupons: nextCoupons,
        });
      } catch {
        // silent in background sync
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    booking.bookingId,
    booking.bookingItems,
    booking.appliedCoupons,
    booking.couponDiscount,
    itemsHydrated,
    setCouponState,
    clearCouponState,
    router,
    resetBooking,
  ]);

  useEffect(() => {
    if (!showTerms) return;
    void ensureRazorpayCheckoutLoaded();
  }, [showTerms]);


  /* -----------------------------
     Protect Direct URL Access
  ------------------------------ */

  useEffect(() => {
    if (!hydrated) return;
    if (!booking.bookingId) {
      router.replace(BOOKING_ROUTES.ROOT);
    }
  }, [hydrated, booking.bookingId, router]);

/* -----------------------------
     Redirect invalid category
  ------------------------------ */

  useEffect(() => {
    if (!hydrated) return;
    if (categoriesLoading) return;
    if (!booking.bookingId) return;

    if (bookingCategories.length === 0) {
      router.replace(BOOKING_ROUTES.PAYMENT);
      return;
    }

    const categoryExists = bookingCategories.some(
      (item) => item.slug === category
    );

    if (!categoryExists) {
      router.replace(BOOKING_ROUTES.EXTRAS(bookingCategories[0].slug));
    }
  }, [
    booking.bookingId,
    bookingCategories,
    categoriesLoading,
    category,
    hydrated,
    router,
  ]);

  /* -----------------------------
     Navigation helpers
  ------------------------------ */
  const currentIndex = bookingCategories.findIndex(
    (item) => item.slug === category
  );
  const activeCategory = currentIndex >= 0 ? bookingCategories[currentIndex] : null;
  const extrasSubProgress =
    currentIndex >= 0
      ? {
          current: currentIndex + 1,
          total: bookingCategories.length,
        }
      : undefined;

  const nextCategory =
    currentIndex >= 0 ? bookingCategories[currentIndex + 1] ?? null : null;
  const prevCategory =
    currentIndex > 0 ? bookingCategories[currentIndex - 1] ?? null : null;

  const isLastCategory = !nextCategory;
  const submitLabel = nextCategory
    ? `Continue to ${nextCategory.label}`
    : "Continue to Payment";

  const handleContinue = async () => {
    if (!booking.bookingId) return;

    // COMMIT ONLY ON LAST CATEGORY
    if (isLastCategory) {
      const res = await fetch("/api/bookings/items/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          items: booking.bookingItems,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        handleBookingError(data, router, {
          resetBooking,
          fallbackMessage: "Unable to save add-ons.",
        });
        return;
      }

      setShowTerms(true);
      return;
    }

    // ➡ Move forward without DB write
    if (nextCategory) {
      router.push(BOOKING_ROUTES.EXTRAS(nextCategory.slug));
    }
  };



  /* -----------------------------
     Breadcrumbs
  ------------------------------ */
  const breadcrumbs = useMemo(() => {
    return bookingCategories.map((item, index) => ({
      label: item.label,
      active: item.slug === category,
      completed: index < currentIndex,
    }));
  }, [bookingCategories, category, currentIndex]);

  /* -----------------------------
     Render guard (visual only)
  ------------------------------ */
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Loading booking…
      </div>
    );
  }

  if (categoriesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Loading add-ons…
      </div>
    );
  }

  if (
    !category ||
    (bookingCategories.length > 0 && !activeCategory)
  ) {
    return null;
  }

  /* -----------------------------
     Render
  ------------------------------ */
  return (
    <div className="w-full min-h-screen flow-root bg-[#f6f8f7]">

      <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-0 sm:pt-5 pb-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-4">
          {/* LEFT */}
          <div className="lg:col-span-2 border border-[#2f7e7a]/20 bg-white p-4 md:p-5">
            <StepsIndicator
              currentStep={4}
              extrasSubProgress={extrasSubProgress}
              className="lg:hidden !px-2 !py-2"
            />
            <div className="mb-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  if (prevCategory) {
                    router.push(BOOKING_ROUTES.EXTRAS(prevCategory.slug));
                    return;
                  }
                  router.push(BOOKING_ROUTES.OCCASION);
                }}
                className="inline-flex cursor-pointer items-center gap-1 border border-[#2f7e7a]/35 bg-[#edf3f1] px-3 py-1.5 text-xs font-medium text-[#245e5b] transition hover:bg-[#e3efec]"
              >
                <ChevronLeft size={14} />
                Back
              </button>

              <button
                type="button"
                onClick={handleContinue}
                className="inline-flex cursor-pointer items-center border border-[#2f7e7a]/35 bg-[#edf3f1] px-3 py-1.5 text-xs font-medium text-[#245e5b] transition hover:bg-[#e3efec]"
              >
                Skip
              </button>
            </div>

            <h2 className="mb-1 text-xl font-semibold text-[#1f2937]">
              Choose {activeCategory?.label ?? "Add-ons"}
            </h2>
            <p className="mb-5 text-sm text-gray-500">
              {activeCategory?.description ?? "Choose any optional add-ons for your event."}
            </p>

            {activeCategory ? (
              <ProductList
                bookingCategorySlug={activeCategory.slug}
                selectedProducts={booking.bookingItems}
              />
            ) : null}
            {activeCategory?.slug === "add-ons" && (
              <p className="mt-3 border border-[#d7e4e1] bg-[#f8fbfa] px-3 py-2 text-xs font-normal text-[#1f2937] sm:text-sm">
                Add-ons are optional and availability may vary based on your event date and venue setup.
              </p>
            )}

          </div>

          {/* RIGHT */}
          <div className="lg:sticky lg:top-28 h-fit">
            <BookingSummary
              extrasProgress={breadcrumbs}
              products={booking.bookingItems}
              onRemoveItem={(id) =>
                setBookingItems((prev) =>
                  prev.filter((item) => item.id !== id)
                )
              }
              onSubmit={handleContinue}
              hideSubmitOnMobile
              onMobileInlineSubmitVisibilityChange={setShowInlineSummarySubmit}
              submitLabel={submitLabel}
            />
          </div>
        </div>
      </div>
      <MobileStickyAction
        label={submitLabel}
        onClick={handleContinue}
        hidden={showInlineSummarySubmit}
        totalPrice={booking.pricing?.total ?? booking.slot?.basePrice ?? null}
        advancePay={booking.pricing?.advancePay ?? null}
      />

      {/* TERMS POPUP */}
      <TermsModal
        open={showTerms}
        onClose={() => setShowTerms(false)}
        checked={termsAccepted}
        setChecked={setTermsAccepted}
        advancePay={booking.pricing?.advancePay ?? null}
        onConfirm={async () => {
          if (!termsAccepted || !booking.bookingId) return;

          const res = await fetch("/api/bookings/accept-terms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookingId: booking.bookingId,
            }),
          });

          const json = await res.json().catch(() => null);
          if (!res.ok || !json?.success) {
            handleBookingError(json, router, {
              resetBooking,
              fallbackMessage: "Unable to continue to payment.",
            });
            return;
          }

          void ensureRazorpayCheckoutLoaded();
          router.push(BOOKING_ROUTES.PAYMENT);
        }}
      />
    </div>
  );
}
