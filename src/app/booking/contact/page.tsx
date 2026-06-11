"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBooking } from "@/context/BookingContext";
import ContactForm from "@/components/booking/contact/ContactForm";
import BookingSummary from "@/components/booking/summary/BookingSummary";
import StepIndicator from "@/components/booking/steps/StepIndicator";
import { useContactSubmit } from "@/hooks/booking/useContactSubmit";
import MobileStickyAction from "@/components/booking/global/MobileStickyAction";
import { BOOKING_ROUTES } from "@/constants/routes";
import { ensurePackageIncludedProducts } from "@/lib/package-included-products";

export default function ContactPage() {
  const router = useRouter();
  const { booking, setContact, setBookingItems, hydrated } = useBooking();
  const { submitContact } = useContactSubmit();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInlineSummarySubmit, setShowInlineSummarySubmit] = useState(false);
  const formId = "booking-contact-form";


  const [contact, setLocalContact] = useState(() => booking.contact ?? null);
  const decorationRequiredRef = useRef(
    booking.schedule?.decorationMandatory
      ? true
      : booking.decorationRequired
  );

  const hasMissingContactDetails =
    !booking.package ||
    !booking.schedule ||
    !contact;
  const isSubmitDisabled =
    hasMissingContactDetails ||
    isSubmitting;

  useEffect(() => {
    decorationRequiredRef.current = booking.schedule?.decorationMandatory
      ? true
      : booking.decorationRequired;
  }, [booking.schedule?.decorationMandatory, booking.decorationRequired]);

  const locationId = booking.location?.id ?? "";
  const selectedPackageKey = booking.package
    ? `${booking.package.id}:${booking.package.baseGuests}`
    : "";

  useEffect(() => {
    if (!hydrated || !locationId || !selectedPackageKey || !booking.package) return;
    const currentPackage = booking.package;
    let cancelled = false;

    fetch(`/api/products?bookingCategory=add-ons&locationId=${locationId}`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json.success) return;
        const products = json.data ?? [];
        setBookingItems((currentItems) =>
          ensurePackageIncludedProducts({
            currentItems,
            products,
            selectedPackage: currentPackage,
          })
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  // booking.package intentionally excluded — selectedPackageKey is the stable string proxy for it
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, locationId, selectedPackageKey, setBookingItems]);

  const handleDecorationChange = useCallback((value: boolean) => {
    decorationRequiredRef.current = value;
  }, []);

  const handleSubmit = async () => {
    if (!contact || isSubmitting) return;

    setIsSubmitting(true);
    try {
      setContact(contact);
      const submitted = await submitContact(contact, {
        decorationRequired: decorationRequiredRef.current,
      });
      if (!submitted.success) return;

      if (submitted.effectiveDecorationRequired) {
        router.push(BOOKING_ROUTES.OCCASION);
        return;
      }

      router.push(BOOKING_ROUTES.AGREEMENT);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    await handleSubmit();
  };

  const handleSummarySubmit = () => {
    const form = document.getElementById(formId) as
      | HTMLFormElement
      | null;

    if (form) {
      form.requestSubmit();
      return;
    }

    void handleSubmit();
  };

  const hasValidSession = Boolean(
    booking.bookingId &&
    booking.package &&
    booking.schedule
  );

  useEffect(() => {
    if (hydrated && !hasValidSession) {
      router.replace("/booking");
    }
  }, [hydrated, hasValidSession, router]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Loading booking…
      </div>
    );
  }

  if (!hasValidSession) {
    return null;
  }
  return (
    <div className="w-full min-h-screen overflow-x-hidden bg-[#f6f8f7]">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 pt-0 sm:pt-5 pb-5">
        <div className="grid grid-cols-1 gap-5 pt-4 lg:grid-cols-3 lg:items-stretch lg:gap-5">
          {/* LEFT */}
          <div className="min-w-0 lg:col-span-2 lg:flex lg:flex-col">
            <StepIndicator currentStep={2} className="lg:hidden !px-2 !py-2" />
            <div className="min-w-0 lg:flex lg:flex-1">
              <ContactForm
                formId={formId}
                onSubmit={handleFormSubmit}
                onContactChange={setLocalContact}
                onDecorationChange={handleDecorationChange}
              />
            </div>
          </div>

          {/* RIGHT */}
          <div className="h-fit lg:sticky lg:top-28 lg:self-start">
            <BookingSummary
              products={booking.bookingItems}
              onSubmit={handleSummarySubmit}
              isSubmitDisabled={isSubmitDisabled}
              hideSubmitOnMobile
              onMobileInlineSubmitVisibilityChange={setShowInlineSummarySubmit}
              enableInvalidSubmitFeedback={
                hasMissingContactDetails && !isSubmitting
              }
              showCouponControls={false}
              submitLabel={
                isSubmitting
                  ? "Saving..."
                  : "Save & Continue"
              }
            />
          </div>
        </div>
      </div>
      <MobileStickyAction
        label={isSubmitting ? "Saving..." : "Save & Continue"}
        onClick={handleSummarySubmit}
        disabled={isSubmitting}
        hidden={showInlineSummarySubmit}
        isInvalid={hasMissingContactDetails && !isSubmitting}
        enableInvalidSubmitFeedback
        totalPrice={booking.pricing?.total ?? booking.schedule?.basePrice ?? null}
        advancePay={booking.pricing?.advancePay ?? null}
      />
    </div>
  );
}
