"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BookingSummary from "@/components/booking/summary/BookingSummary";
import StepIndicator from "@/components/booking/steps/StepIndicator";
import MobileStickyAction from "@/components/booking/global/MobileStickyAction";
import AgreementSection from "@/components/booking/agreement/AgreementSection";
import SignaturePad from "@/components/shared/SignaturePad";
import { Check } from "@/components/icons";
import {
  HAVEN_AGREEMENT_ACKNOWLEDGMENT,
  HAVEN_AGREEMENT_DEFAULT_TITLE,
  HAVEN_AGREEMENT_DEFAULT_VERSION,
  HAVEN_AGREEMENT_INTRO,
  HAVEN_AGREEMENT_SECTIONS,
} from "@/constants/haven-agreement-content";
import { BOOKING_ROUTES } from "@/constants/routes";
import { useBooking } from "@/context/BookingContext";
import { handleBookingError } from "@/utils/handleBookingError";
import { ensureRazorpayCheckoutLoaded } from "@/lib/razorpay/checkout-client";

type AgreementTemplateSummary = {
  title: string;
  content: string;
  version: string;
} | null;

type HighlightTarget =
  | "agreement"
  | "acknowledgments"
  | "signature"
  | "name"
  | "confirmation"
  | null;

const ACKNOWLEDGMENT_ITEMS = [
  {
    key: "safety",
    title: "Safety & Liability",
    body: "I understand and accept the pool, lake, playground, slide, and general injury liability terms.",
  },
  {
    key: "damage",
    title: "Cleaning & Property Damage",
    body: "I understand the cleaning policy, floor damage fees, confetti restrictions, and responsibility for property damage.",
  },
  {
    key: "payment",
    title: "Payment, Cancellation & Weather",
    body: "I understand the payment deadlines, deposit policy, rescheduling rules, and rain-or-shine policy.",
  },
  {
    key: "conduct",
    title: "Alcohol, Guests & Neighborhood",
    body: "I understand and accept responsibility for guest conduct, alcohol-related incidents, parking, and neighborhood restrictions.",
  },
] as const;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildAgreementHtmlSnapshot(template: AgreementTemplateSummary) {
  const sectionMarkup = HAVEN_AGREEMENT_SECTIONS.map(
    (section) =>
      `<section><p>${escapeHtml(section.eyebrow)}</p><h2>${escapeHtml(
        section.title
      )}</h2><p>${escapeHtml(section.body.join("\n")).replaceAll(
        "\n",
        "<br />"
      )}</p></section>`
  ).join("");

  return `
    <article>
      <header>
        <h1>${escapeHtml(template?.title || HAVEN_AGREEMENT_DEFAULT_TITLE)}</h1>
        <p>Version ${escapeHtml(template?.version || HAVEN_AGREEMENT_DEFAULT_VERSION)}</p>
      </header>
      <section>${HAVEN_AGREEMENT_INTRO.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</section>
      ${sectionMarkup}
      <section>
        <h2>Final Acknowledgment</h2>
        <p>${escapeHtml(HAVEN_AGREEMENT_ACKNOWLEDGMENT)}</p>
      </section>
    </article>
  `.trim();
}

export default function BookingAgreementStep({
  template,
}: {
  template: AgreementTemplateSummary;
}) {
  const router = useRouter();
  const { booking, hydrated, resetBooking } = useBooking();
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signerName, setSignerName] = useState(() => booking.contact?.name ?? "");
  const [finalConfirmationChecked, setFinalConfirmationChecked] = useState(false);
  const [acknowledgments, setAcknowledgments] = useState<Record<string, boolean>>(
    Object.fromEntries(ACKNOWLEDGMENT_ITEMS.map((item) => [item.key, false]))
  );
  const [hasReviewedAgreement, setHasReviewedAgreement] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [highlightTarget, setHighlightTarget] = useState<HighlightTarget>(null);
  const [showInlineSummarySubmit, setShowInlineSummarySubmit] = useState(false);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const agreementPanelRef = useRef<HTMLDivElement | null>(null);
  const acknowledgmentsRef = useRef<HTMLDivElement | null>(null);
  const signatureSectionRef = useRef<HTMLDivElement | null>(null);
  const signerNameInputRef = useRef<HTMLInputElement | null>(null);
  const finalConfirmationRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (
      hydrated &&
      (!booking.bookingId || !booking.theatre || !booking.slot || !booking.contact)
    ) {
      router.replace(BOOKING_ROUTES.ROOT);
    }
  }, [booking.bookingId, booking.contact, booking.slot, booking.theatre, hydrated, router]);

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) return;

    const handleScroll = () => {
      const isAtEnd =
        root.scrollTop + root.clientHeight >= root.scrollHeight - 12;
      if (isAtEnd) {
        setHasReviewedAgreement(true);
      }
    };

    handleScroll();
    root.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      root.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (signerName.trim()) return;
    if (booking.contact?.name) {
      setSignerName(booking.contact.name);
    }
  }, [booking.contact?.name, signerName]);

  useEffect(() => {
    if (!highlightTarget) return;
    const timeoutId = window.setTimeout(() => {
      setHighlightTarget(null);
    }, 1600);

    return () => window.clearTimeout(timeoutId);
  }, [highlightTarget]);

  const hasAllAcknowledgments = ACKNOWLEDGMENT_ITEMS.every(
    (item) => acknowledgments[item.key]
  );
  const hasSignerName = Boolean(signerName.trim());
  const hasSignature = Boolean(signatureImage);
  const hasMissingAgreementRequirements =
    !hasReviewedAgreement ||
    !hasAllAcknowledgments ||
    !finalConfirmationChecked ||
    !hasSignerName ||
    !hasSignature;
  const missingAgreementMessage = useMemo(() => {
    const missing = [];
    if (!hasReviewedAgreement) missing.push("review the full agreement");
    if (!hasAllAcknowledgments) missing.push("complete the acknowledgments");
    if (!hasSignerName) missing.push("enter your legal name");
    if (!hasSignature) missing.push("add your signature");
    if (!finalConfirmationChecked) missing.push("confirm electronic signature consent");

    return `Please ${missing.join(", ")} before continuing to payment.`;
  }, [
    finalConfirmationChecked,
    hasAllAcknowledgments,
    hasReviewedAgreement,
    hasSignature,
    hasSignerName,
  ]);

  const canContinue =
    hasReviewedAgreement &&
    hasAllAcknowledgments &&
    finalConfirmationChecked &&
    hasSignerName &&
    hasSignature &&
    !isSubmitting;

  const agreementHtmlSnapshot = useMemo(
    () => buildAgreementHtmlSnapshot(template),
    [template]
  );
  const getHighlightClass = (target: Exclude<HighlightTarget, null>) =>
    highlightTarget === target
      ? "agreement-attention transition"
      : "transition";

  if (!hydrated || !booking.bookingId || !booking.theatre || !booking.slot || !booking.contact) {
    return null;
  }

  const handleInvalidAgreementSubmit = () => {
    setErrorMessage(null);

    if (!hasReviewedAgreement) {
      setHighlightTarget("agreement");
      agreementPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      scrollRootRef.current?.focus({ preventScroll: true });
      return;
    }

    if (!hasAllAcknowledgments) {
      setHighlightTarget("acknowledgments");
      acknowledgmentsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    if (!hasSignerName) {
      setHighlightTarget("name");
      signatureSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      signerNameInputRef.current?.focus({ preventScroll: true });
      return;
    }

    if (!hasSignature) {
      setHighlightTarget("signature");
      signatureSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    setHighlightTarget("confirmation");
    finalConfirmationRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    finalConfirmationRef.current?.focus({ preventScroll: true });
  };

  const submitAgreement = async () => {
    if (!canContinue) {
      if (hasMissingAgreementRequirements && !isSubmitting) {
        handleInvalidAgreementSubmit();
      }
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/bookings/accept-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          signerName: signerName.trim(),
          signatureImage,
          confirmationAccepted: finalConfirmationChecked,
          agreementVersion: template?.version || HAVEN_AGREEMENT_DEFAULT_VERSION,
          agreementHtmlSnapshot,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        handleBookingError(json, router, {
          resetBooking,
          fallbackMessage: "Unable to save signed agreement.",
        });
        return;
      }

      void ensureRazorpayCheckoutLoaded();
      router.push(BOOKING_ROUTES.PAYMENT);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen overflow-x-hidden bg-[#f6f8f7]">
      <div className="mx-auto max-w-7xl px-3 pt-0 pb-5 sm:px-4 sm:pt-5">
        <div className="grid grid-cols-1 gap-5 pt-4 lg:grid-cols-3 lg:items-stretch lg:gap-5">
          <div className="lg:col-span-2 min-w-0">
            <StepIndicator currentStep={5} className="lg:hidden !px-2 !py-2" />
            <div className="border border-[#2f7e7a]/20 bg-white p-4 md:p-5">
              <h2 className="mb-1 text-xl font-semibold text-[#1f2937]">
                {template?.title || HAVEN_AGREEMENT_DEFAULT_TITLE}
              </h2>
              <p className="mb-5 text-sm text-gray-500">
                Review the agreement, confirm the required acknowledgments, and sign before continuing to payment.
              </p>

              <div className="space-y-4">
                <div
                  ref={agreementPanelRef}
                  className={`bg-[#f7f9f8] p-2 md:p-3 ${getHighlightClass(
                    "agreement"
                  )}`}
                >
                  <div className="border border-[#d7e4e1] bg-white">
                    <div className="border-b border-[#edf1ef] bg-[#fbfcfb] px-4 py-2">
                      <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#6b7280]">
                        License Agreement
                      </p>
                    </div>
                    <div
                      ref={scrollRootRef}
                      tabIndex={-1}
                      className="h-[24rem] overflow-y-auto px-4 py-3 md:h-[29rem] xl:h-[33rem]"
                    >
                      <div className="mx-auto max-w-3xl space-y-3">
                        <div className="border-b border-[#edf1ef] pb-4">
                          <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[#7b7f85]">
                            Agreement Overview
                          </p>
                          <div className="mt-2 space-y-2 text-[11px] leading-5 text-[#475467]">
                            {HAVEN_AGREEMENT_INTRO.map((paragraph) => (
                              <p key={paragraph}>{paragraph}</p>
                            ))}
                          </div>
                        </div>

                        {HAVEN_AGREEMENT_SECTIONS.map((section) => (
                          <AgreementSection
                            key={section.title}
                            eyebrow={section.eyebrow}
                            title={section.title}
                            body={section.body.join("\n")}
                          />
                        ))}

                        <div
                          ref={acknowledgmentsRef}
                          className={`bg-[#f8fbfa] px-4 py-3 ${getHighlightClass(
                            "acknowledgments"
                          )}`}
                        >
                          <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[#347f7c]">
                            Required Acknowledgments
                          </p>
                          <div className="mt-3 space-y-2.5">
                            {ACKNOWLEDGMENT_ITEMS.map((item) => (
                              <button
                                key={item.key}
                                type="button"
                                aria-pressed={acknowledgments[item.key]}
                                onClick={() =>
                                  setAcknowledgments((current) => ({
                                    ...current,
                                    [item.key]: !current[item.key],
                                  }))
                                }
                                className="flex w-full cursor-pointer items-start gap-3 border-b border-[#edf1ef] bg-white px-4 py-3 text-left transition hover:bg-[#f8fbfa] last:border-b-0"
                              >
                                <span
                                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border transition ${
                                    acknowledgments[item.key]
                                      ? "border-[#347f7c] bg-[#347f7c] text-white"
                                      : "border-gray-400 bg-white"
                                  }`}
                                >
                                  {acknowledgments[item.key] ? (
                                    <Check size={14} />
                                  ) : null}
                                </span>
                                <span>
                                  <span className="block text-[11px] font-semibold text-[#101828]">
                                    {item.title}
                                  </span>
                                  <span className="mt-1 block text-[11px] leading-5 text-[#475467]">
                                    {item.body}
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="border-t border-[#edf1ef] pt-4">
                          <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[#347f7c]">
                            Final Acknowledgment
                          </p>
                          <p className="mt-2 text-[11px] leading-5 text-[#475467]">
                            {HAVEN_AGREEMENT_ACKNOWLEDGMENT}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  ref={signatureSectionRef}
                  className={`border border-[#d7e4e1] bg-white p-4 md:p-5 ${
                    highlightTarget === "signature" ||
                    highlightTarget === "name" ||
                    highlightTarget === "confirmation"
                      ? getHighlightClass(highlightTarget)
                      : "transition"
                  }`}
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#347f7c]">
                    Digital Signature
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#475467]">
                    Sign as the responsible renter after reviewing the agreement.
                  </p>

                  <label
                    className={`mt-5 block ${
                      highlightTarget === "name"
                        ? "agreement-attention"
                        : ""
                    }`}
                  >
                    <span className="text-sm font-medium text-[#344054]">
                      Typed Full Legal Name
                    </span>
                    <input
                      ref={signerNameInputRef}
                      value={signerName}
                      onChange={(event) => setSignerName(event.target.value)}
                      className="mt-2 w-full border border-[#d0d5dd] px-4 py-3 text-sm text-[#101828] outline-none transition focus:border-[#347f7c]"
                      placeholder="Type the signer name exactly as it should appear on the agreement"
                    />
                  </label>

                  <div
                    className={`mt-5 ${
                      highlightTarget === "signature"
                        ? "agreement-attention"
                        : ""
                    }`}
                  >
                    <p className="mb-2 text-sm font-medium text-[#344054]">
                      Signature
                    </p>
                    <SignaturePad
                      value={signatureImage}
                      onChange={setSignatureImage}
                      disabled={!hasReviewedAgreement}
                      flat
                    />
                  </div>

                  <div
                    className={`mt-5 flex items-start gap-3 border border-[#d0d5dd] p-4 ${
                      highlightTarget === "confirmation"
                        ? "agreement-attention"
                        : ""
                    }`}
                  >
                    <button
                      ref={finalConfirmationRef}
                      type="button"
                      aria-pressed={finalConfirmationChecked}
                      onClick={() =>
                        setFinalConfirmationChecked((current) => !current)
                      }
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border transition ${
                        finalConfirmationChecked
                          ? "border-[#347f7c] bg-[#347f7c] text-white"
                          : "border-gray-400 bg-white"
                      }`}
                    >
                      {finalConfirmationChecked ? <Check size={14} /> : null}
                    </button>
                    <span className="text-sm leading-6 text-[#344054]">
                      I confirm that this electronic signature and typed legal name are mine, and that I agree to the Haven Retreat event rental terms.
                    </span>
                  </div>

                  {errorMessage ? (
                    <p className="mt-4 text-sm text-[#b42318]">
                      {errorMessage}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:sticky lg:top-0 lg:self-start">
            <BookingSummary
              products={booking.bookingItems}
              onSubmit={submitAgreement}
              onInvalidSubmit={handleInvalidAgreementSubmit}
              isSubmitDisabled={!canContinue}
              enableInvalidSubmitFeedback={
                hasMissingAgreementRequirements && !isSubmitting
              }
              invalidSubmitMessage={missingAgreementMessage}
              hideSubmitOnMobile
              onMobileInlineSubmitVisibilityChange={setShowInlineSummarySubmit}
              submitLabel={isSubmitting ? "Saving..." : "Continue to Payment"}
            />
          </div>
        </div>
      </div>

      <MobileStickyAction
        label={isSubmitting ? "Saving..." : "Continue to Payment"}
        onClick={submitAgreement}
        onInvalidClick={handleInvalidAgreementSubmit}
        disabled={isSubmitting}
        isInvalid={hasMissingAgreementRequirements && !isSubmitting}
        enableInvalidSubmitFeedback
        invalidSubmitMessage={missingAgreementMessage}
        hidden={showInlineSummarySubmit}
        totalPrice={booking.pricing?.total ?? booking.slot?.basePrice ?? null}
        advancePay={booking.pricing?.advancePay ?? null}
      />
      <style jsx>{`
        .agreement-attention {
          animation: agreementAttentionGlow 1.6s ease-out;
        }

        @keyframes agreementAttentionGlow {
          0% {
            background-color: rgba(52, 127, 124, 0);
            box-shadow: 0 0 0 0 rgba(52, 127, 124, 0);
          }
          18% {
            background-color: rgba(52, 127, 124, 0.08);
            box-shadow:
              0 0 0 1px rgba(52, 127, 124, 0.22),
              0 14px 36px rgba(52, 127, 124, 0.18),
              0 0 42px rgba(52, 127, 124, 0.2);
          }
          62% {
            background-color: rgba(52, 127, 124, 0.04);
            box-shadow:
              0 0 0 1px rgba(52, 127, 124, 0.12),
              0 10px 28px rgba(52, 127, 124, 0.1);
          }
          100% {
            background-color: rgba(52, 127, 124, 0);
            box-shadow: 0 0 0 0 rgba(52, 127, 124, 0);
          }
        }
      `}</style>
    </div>
  );
}
