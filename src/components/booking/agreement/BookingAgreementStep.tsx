"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BookingSummary from "@/components/booking/summary/BookingSummary";
import StepIndicator from "@/components/booking/steps/StepIndicator";
import MobileStickyAction from "@/components/booking/global/MobileStickyAction";
import AgreementSection from "@/components/booking/agreement/AgreementSection";
import SignaturePad from "@/components/shared/SignaturePad";
import { Check, ChevronLeft } from "@/components/icons";
import {
  HAVEN_AGREEMENT_CLAUSE_NUMBERS,
  HAVEN_AGREEMENT_DEFAULT_VERSION,
  HAVEN_AGREEMENT_INTRO,
  HAVEN_AGREEMENT_REQUIRED_ACKNOWLEDGMENTS,
  HAVEN_AGREEMENT_SECTIONS,
  HAVEN_AGREEMENT_TOTAL_CLAUSES,
} from "@/constants/haven-agreement-content";
import { BOOKING_ROUTES } from "@/constants/routes";
import { useBooking } from "@/context/BookingContext";
import { handleBookingError } from "@/utils/handleBookingError";

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

export default function BookingAgreementStep({
  template,
}: {
  template: AgreementTemplateSummary;
}) {
  const router = useRouter();
  const { booking, hydrated, resetBooking } = useBooking();
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  // The signer types their own legal name: it is the signature on the contract,
  // not a copy of the contact on the booking, and the two are allowed to differ.
  const [signerName, setSignerName] = useState("");
  const [finalConfirmationChecked, setFinalConfirmationChecked] = useState(false);
  const [acknowledgedClauses, setAcknowledgedClauses] = useState<
    Record<number, boolean>
  >(
    Object.fromEntries(
      HAVEN_AGREEMENT_CLAUSE_NUMBERS.map((clauseNumber) => [
        clauseNumber,
        false,
      ])
    )
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [highlightTarget, setHighlightTarget] = useState<HighlightTarget>(null);
  const [showInlineSummarySubmit, setShowInlineSummarySubmit] = useState(false);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const agreementPanelRef = useRef<HTMLDivElement | null>(null);
  const clauseRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const signatureSectionRef = useRef<HTMLDivElement | null>(null);
  const signerNameInputRef = useRef<HTMLInputElement | null>(null);
  const finalConfirmationRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (
      hydrated &&
      (!booking.bookingId || !booking.package || !booking.schedule || !booking.contact)
    ) {
      router.replace(BOOKING_ROUTES.ROOT);
    }
  }, [booking.bookingId, booking.contact, booking.schedule, booking.package, hydrated, router]);

  useEffect(() => {
    if (!highlightTarget) return;
    const timeoutId = window.setTimeout(() => {
      setHighlightTarget(null);
    }, 1600);

    return () => window.clearTimeout(timeoutId);
  }, [highlightTarget]);

  const acknowledgedClauseCount = HAVEN_AGREEMENT_CLAUSE_NUMBERS.filter(
    (clauseNumber) => acknowledgedClauses[clauseNumber]
  ).length;
  const hasAllAcknowledgments = HAVEN_AGREEMENT_CLAUSE_NUMBERS.every(
    (clauseNumber) => acknowledgedClauses[clauseNumber]
  );
  const firstUncheckedClause = HAVEN_AGREEMENT_CLAUSE_NUMBERS.find(
    (clauseNumber) => !acknowledgedClauses[clauseNumber]
  );
  const hasSignerName = Boolean(signerName.trim());
  const hasSignature = Boolean(signatureImage);

  // Acknowledging every clause is still an explicit, deliberate action: the
  // control mirrors the individual checkboxes and clears them all when undone.
  const toggleAllAcknowledgments = () => {
    const nextAcknowledged = !hasAllAcknowledgments;
    setAcknowledgedClauses(
      Object.fromEntries(
        HAVEN_AGREEMENT_CLAUSE_NUMBERS.map((clauseNumber) => [
          clauseNumber,
          nextAcknowledged,
        ])
      )
    );
    setHighlightTarget(null);
  };
  const hasMissingAgreementRequirements =
    !hasAllAcknowledgments ||
    !finalConfirmationChecked ||
    !hasSignerName ||
    !hasSignature;
  const missingAgreementMessage = useMemo(() => {
    const missing = [];
    if (!hasAllAcknowledgments) {
      missing.push(`acknowledge all ${HAVEN_AGREEMENT_TOTAL_CLAUSES} clauses`);
    }
    if (!hasSignerName) missing.push("enter your legal name");
    if (!hasSignature) missing.push("add your signature");
    if (!finalConfirmationChecked) missing.push("confirm electronic signature consent");

    return `Please ${missing.join(", ")} before submitting your booking request.`;
  }, [
    finalConfirmationChecked,
    hasAllAcknowledgments,
    hasSignature,
    hasSignerName,
  ]);

  const canContinue =
    hasAllAcknowledgments &&
    finalConfirmationChecked &&
    hasSignerName &&
    hasSignature &&
    !isSubmitting;

  // Attention reads as a tint against an accent rail, the same language the
  // clauses use. The rail is always laid out and only takes colour when active,
  // so highlighting a field cannot reflow the form around it.
  const ATTENTION_IDLE =
    "border-l-2 border-l-transparent transition-all duration-500 ease-out";
  const ATTENTION_ACTIVE = "border-l-[#347f7c] bg-[#f4f9f8] pl-3.5";

  const getHighlightClass = (target: Exclude<HighlightTarget, null>) =>
    highlightTarget === target
      ? `${ATTENTION_IDLE} ${ATTENTION_ACTIVE}`
      : ATTENTION_IDLE;

  if (!hydrated || !booking.bookingId || !booking.package || !booking.schedule || !booking.contact) {
    return null;
  }

  const handleInvalidAgreementSubmit = () => {
    setErrorMessage(null);

    if (!hasAllAcknowledgments) {
      setHighlightTarget("acknowledgments");
      if (firstUncheckedClause) {
        clauseRefs.current[firstUncheckedClause]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
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
      const res = await fetch("/api/bookings/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          signerName: signerName.trim(),
          signatureImage,
          confirmationAccepted: finalConfirmationChecked,
          acknowledgedClauses: HAVEN_AGREEMENT_CLAUSE_NUMBERS.filter(
            (clauseNumber) => acknowledgedClauses[clauseNumber]
          ),
          agreementVersion: template?.version || HAVEN_AGREEMENT_DEFAULT_VERSION,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !json?.successToken) {
        handleBookingError(json, router, {
          resetBooking,
          fallbackMessage: "Unable to submit your booking request.",
        });
        return;
      }

      // Do not clear the local draft here: this page redirects to the booking
      // root whenever the draft goes empty, and that guard would beat the
      // navigation below. The success page clears the draft once it has loaded.
      router.replace(BOOKING_ROUTES.SUCCESS(json.successToken));
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
              <div className="mb-1 flex items-start justify-between gap-3">
                <h2 className="min-w-0 flex-1 pt-1 text-sm font-semibold uppercase leading-tight tracking-[0.18em] text-[#6b7280] sm:text-base">
                  Rental Agreement
                </h2>

                <button
                  type="button"
                  onClick={() => {
                    const decorationActive =
                      booking.decorationRequired || booking.schedule?.decorationMandatory;
                    router.push(
                      decorationActive
                        ? BOOKING_ROUTES.EXTRAS("add-ons")
                        : BOOKING_ROUTES.CONTACT
                    );
                  }}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-50 hover:text-gray-900"
                >
                  <ChevronLeft size={14} />
                  Back
                </button>
              </div>
              <p className="mb-4 text-sm text-gray-500">
                Review the agreement, confirm the required acknowledgments, and sign to submit your booking request.
              </p>

              <div className="space-y-4">
                <div
                  ref={agreementPanelRef}
                  className="bg-[#f7f9f8] p-2 transition md:p-3"
                >
                  <div className="border border-[#d7e4e1] bg-white">
                    <div
                      ref={scrollRootRef}
                      tabIndex={-1}
                      className="h-[37.75rem] overflow-y-auto px-4 pb-4 md:h-[42.75rem] xl:h-[46.75rem]"
                    >
                      <div className="mx-auto max-w-3xl space-y-3">
                        <div className="sticky top-0 z-10 bg-white pt-4 pr-2 pb-5">
                          <div className="border border-[#d7e4e1] bg-white px-3 py-2 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[11px] font-semibold text-[#344054]">
                                Mandatory clause acknowledgments
                              </p>
                              <p className="shrink-0 text-[11px] font-bold text-[#347f7c]">
                                {acknowledgedClauseCount} of{" "}
                                {HAVEN_AGREEMENT_TOTAL_CLAUSES}
                              </p>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden bg-[#edf1ef]">
                              <div
                                className="h-full bg-[#347f7c] transition-[width] duration-200"
                                style={{
                                  width: `${
                                    (acknowledgedClauseCount /
                                      HAVEN_AGREEMENT_TOTAL_CLAUSES) *
                                    100
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="border-b border-[#edf1ef] pb-4">
                          <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[#7b7f85]">
                            Agreement Overview and Required Acknowledgments
                          </p>
                          <div className="mt-2 space-y-2 text-[11px] leading-5 text-[#475467]">
                            {HAVEN_AGREEMENT_INTRO.map((paragraph) => (
                              <p key={paragraph}>{paragraph}</p>
                            ))}
                          </div>
                        </div>

                        {HAVEN_AGREEMENT_SECTIONS.map((section, index) => {
                          const clauseNumber = index + 1;
                          return (
                            <div
                              key={section.title}
                              ref={(node) => {
                                clauseRefs.current[clauseNumber] = node;
                              }}
                            >
                              <AgreementSection
                                clauseNumber={clauseNumber}
                                eyebrow={section.eyebrow}
                                title={section.title}
                                body={section.body.join("\n")}
                                acknowledged={
                                  acknowledgedClauses[clauseNumber] ?? false
                                }
                                highlighted={
                                  highlightTarget === "acknowledgments" &&
                                  firstUncheckedClause === clauseNumber
                                }
                                onToggle={() =>
                                  setAcknowledgedClauses((current) => ({
                                    ...current,
                                    [clauseNumber]: !current[clauseNumber],
                                  }))
                                }
                              />
                            </div>
                          );
                        })}

                        {HAVEN_AGREEMENT_REQUIRED_ACKNOWLEDGMENTS.map(
                          (section) => (
                            <div
                              key={section.key}
                              ref={(node) => {
                                clauseRefs.current[section.number] = node;
                              }}
                            >
                              <AgreementSection
                                clauseNumber={section.number}
                                eyebrow={`Section ${section.number}`}
                                title={`${section.number}. ${section.title}`}
                                body={section.body.join("\n")}
                                acknowledged={
                                  acknowledgedClauses[section.number] ?? false
                                }
                                highlighted={
                                  highlightTarget === "acknowledgments" &&
                                  firstUncheckedClause === section.number
                                }
                                onToggle={() =>
                                  setAcknowledgedClauses((current) => ({
                                    ...current,
                                    [section.number]:
                                      !current[section.number],
                                  }))
                                }
                              />
                            </div>
                          )
                        )}

                        {/* The acknowledgment sentence is not shown here: the
                            clause checkboxes, the signature and the final
                            confirmation already carry it on screen. It still
                            goes into the signed agreement itself. */}
                        <div className="border-t border-[#edf1ef] pt-4">
                          <button
                            type="button"
                            aria-pressed={hasAllAcknowledgments}
                            onClick={toggleAllAcknowledgments}
                            className="grid w-full cursor-pointer grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-2.5 text-left transition"
                          >
                            <span
                              className={`flex h-4 w-4 items-center justify-center self-start border transition ${
                                hasAllAcknowledgments
                                  ? "border-[#347f7c] bg-[#347f7c] text-white"
                                  : "border-gray-400 bg-white"
                              }`}
                            >
                              {hasAllAcknowledgments ? (
                                <Check size={11} strokeWidth={2.5} />
                              ) : null}
                            </span>

                            <span className="min-w-0">
                              <span className="block text-[13px] font-semibold text-[#1f2937]">
                                {hasAllAcknowledgments
                                  ? `All ${HAVEN_AGREEMENT_TOTAL_CLAUSES} clauses acknowledged`
                                  : `Acknowledge all ${HAVEN_AGREEMENT_TOTAL_CLAUSES} clauses`}
                              </span>
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* The section is only the scroll anchor. Highlighting it as
                    well as the field inside would light up everything the signer
                    already completed, so the glow stays on the one thing that
                    needs attention. */}
                <div
                  ref={signatureSectionRef}
                  className="border border-[#d7e4e1] bg-white p-4 transition md:p-5"
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#347f7c]">
                    Digital Signature
                  </p>
                  <label className={`mt-5 block ${getHighlightClass("name")}`}>
                    <span className="text-sm font-medium text-[#344054]">
                      Full Legal Name
                    </span>
                    <input
                      ref={signerNameInputRef}
                      value={signerName}
                      onChange={(event) => setSignerName(event.target.value)}
                      className="mt-2 w-full border border-[#d0d5dd] px-4 py-3 text-sm text-[#101828] outline-none transition focus:border-[#347f7c]"
                      placeholder="Enter your full legal name"
                    />
                  </label>

                  <div className={`mt-5 ${getHighlightClass("signature")}`}>
                    <p className="mb-2 text-sm font-medium text-[#344054]">
                      Signature
                    </p>
                    <SignaturePad
                      value={signatureImage}
                      onChange={setSignatureImage}
                      disabled={!hasAllAcknowledgments}
                      disabledMessage="Complete all acknowledgements to enable signing."
                      flat
                    />
                  </div>

                  {/* This card already carries a border, so its left edge is the
                      rail: it only changes colour. Using the shared idle classes
                      would leave the border open on that side. */}
                  <div
                    className={`mt-5 flex items-start gap-3 border border-[#d0d5dd] p-4 transition-all duration-500 ease-out ${
                      highlightTarget === "confirmation"
                        ? "border-l-[#347f7c] bg-[#f4f9f8]"
                        : "border-l-[#d0d5dd]"
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
                      I confirm that this is my legal name and electronic
                      signature, and I agree to the Haven Retreat Rental
                      Agreement.
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
              submitLabel={isSubmitting ? "Submitting booking..." : "Submit Booking Request"}
            />
          </div>
        </div>
      </div>

      <MobileStickyAction
        label={isSubmitting ? "Submitting booking..." : "Submit Booking Request"}
        onClick={submitAgreement}
        onInvalidClick={handleInvalidAgreementSubmit}
        disabled={isSubmitting}
        isInvalid={hasMissingAgreementRequirements && !isSubmitting}
        enableInvalidSubmitFeedback
        invalidSubmitMessage={missingAgreementMessage}
        hidden={showInlineSummarySubmit}
        totalPrice={booking.pricing?.total ?? booking.schedule?.basePrice ?? null}
        advancePay={booking.pricing?.advancePay ?? null}
      />
    </div>
  );
}
