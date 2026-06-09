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

export default function ContactPage() {
  const router = useRouter();
  const { booking, setContact, hydrated } = useBooking();
  const { submitContact } = useContactSubmit();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInlineSummarySubmit, setShowInlineSummarySubmit] = useState(false);
  const formId = "booking-contact-form";


  const [contact, setLocalContact] = useState(() => booking.contact ?? null);
  const [couponIdentityPhone, setCouponIdentityPhone] = useState(
    () => booking.contact?.phone ?? ""
  );
  const decorationRequiredRef = useRef(
    booking.slot?.decorationMandatory
      ? true
      : booking.decorationRequired
  );

  const hasMissingContactDetails =
    !booking.theatre ||
    !booking.slot ||
    !contact;
  const isSubmitDisabled =
    hasMissingContactDetails ||
    isSubmitting;

  useEffect(() => {
    decorationRequiredRef.current = booking.slot?.decorationMandatory
      ? true
      : booking.decorationRequired;
  }, [booking.slot?.decorationMandatory, booking.decorationRequired]);

  useEffect(() => {
    if (!couponIdentityPhone && booking.contact?.phone) {
      setCouponIdentityPhone(booking.contact.phone);
    }
  }, [booking.contact?.phone, couponIdentityPhone]);

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

  useEffect(() => {
    if (
      hydrated &&
      (!booking.bookingId ||
        !booking.theatre ||
        !booking.slot)
    ) {
      router.replace("/booking");
    }
  }, [hydrated, booking.bookingId, booking.theatre, booking.slot, router]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Loading booking…
      </div>
    );
  }

  if (!booking.bookingId || !booking.theatre || !booking.slot) {
    return null;
  }
  return (
    <div className="w-full min-h-screen overflow-x-hidden bg-[#f6f8f7]">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 pt-0 sm:pt-5 pb-5">
        <div className="grid grid-cols-1 gap-5 pt-4 lg:grid-cols-3 lg:items-start lg:gap-5">
          {/* LEFT */}
          <div className="lg:col-span-2 min-w-0">
            <StepIndicator currentStep={2} className="lg:hidden !px-2 !py-2" />
            <div className="min-w-0">
              <ContactForm
                formId={formId}
                onSubmit={handleFormSubmit}
                onContactChange={setLocalContact}
                onDecorationChange={handleDecorationChange}
                onCouponIdentityPhoneChange={setCouponIdentityPhone}
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
              couponIdentityOverride={{ phone: couponIdentityPhone }}
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
        totalPrice={booking.pricing?.total ?? booking.slot?.basePrice ?? null}
        advancePay={booking.pricing?.advancePay ?? null}
      />
    </div>
  );
}
