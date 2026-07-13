"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

import BookingSummary from "@/components/booking/summary/BookingSummary";
import OccasionCard from "@/components/booking/occasion/OccasionCard";
import { useOccasions } from "@/components/booking/occasion/useOccasions";
import type { Occasion } from "@/components/booking/occasion/useOccasions";
import { buildOccasionPersonalizedMessage } from "@/components/booking/occasion/personalize";
import { useSubmitOccasion } from "@/hooks/booking/useSubmitOccasion";
import { useBooking } from "@/context/BookingContext";
import { ChevronLeft } from "@/components/icons";
import StepIndicator from "@/components/booking/steps/StepIndicator";
import MobileStickyAction from "@/components/booking/global/MobileStickyAction";

function isMessageField(field: { key: string; label: string }) {
  const key = field.key.toLowerCase();
  const label = field.label.toLowerCase();
  return key.includes("message") || label.includes("message");
}

function isMarriageProposalOccasion(occasion: Pick<Occasion, "key" | "name">) {
  const token = `${occasion.key} ${occasion.name}`.toLowerCase();
  return token.includes("marriage") && token.includes("proposal");
}

function isFieldRequiredForOccasion(
  occasion: Pick<Occasion, "key" | "name">,
  field: { key: string; label: string; isRequired: boolean }
) {
  if (isMarriageProposalOccasion(occasion) && isMessageField(field)) {
    return false;
  }
  return field.isRequired;
}

function resolveDynamicFieldInputType(field: {
  key: string;
  label: string;
}): React.HTMLInputTypeAttribute {
  const token = `${field.key} ${field.label}`.toLowerCase();
  if (token.includes("email")) return "email";
  if (token.includes("phone") || token.includes("mobile")) return "tel";
  return "text";
}

function resolveDynamicFieldAutocomplete(field: {
  key: string;
  label: string;
}): string {
  const token = `${field.key} ${field.label}`.toLowerCase();
  if (token.includes("email")) return "email";
  if (token.includes("phone") || token.includes("mobile")) return "tel";
  if (token.includes("name")) return "name";
  return "on";
}

function buildMappedFormData({
  targetOccasion,
  sourceOccasion,
  sourceData,
  existingTargetData,
}: {
  targetOccasion: Occasion;
  sourceOccasion: Occasion | null;
  sourceData: Record<string, string>;
  existingTargetData?: Record<string, string>;
}) {
  const normalizedTarget: Record<string, string> = {};
  targetOccasion.fields.forEach((field) => {
    normalizedTarget[field.key] = String(
      existingTargetData?.[field.key] ?? ""
    );
  });

  let sourceMessage = "";
  const sourceRegularValues: string[] = [];

  if (sourceOccasion) {
    sourceOccasion.fields.forEach((field) => {
      const value = String(sourceData[field.key] ?? "").trim();
      if (!value) return;

      if (isMessageField(field)) {
        if (!sourceMessage) sourceMessage = value;
        return;
      }

      sourceRegularValues.push(value);
    });
  } else {
    Object.entries(sourceData).forEach(([key, value]) => {
      const cleaned = String(value ?? "").trim();
      if (!cleaned) return;

      const fallbackField = { key, label: key };
      if (isMessageField(fallbackField)) {
        if (!sourceMessage) sourceMessage = cleaned;
        return;
      }

      sourceRegularValues.push(cleaned);
    });
  }

  // Map non-message fields in strict sequence without duplication/overflow.
  let sourceIndex = 0;
  targetOccasion.fields.forEach((field) => {
    if (isMessageField(field)) {
      if (!String(normalizedTarget[field.key] ?? "").trim() && sourceMessage) {
        normalizedTarget[field.key] = sourceMessage;
      }
      return;
    }

    const currentValue = String(normalizedTarget[field.key] ?? "").trim();
    const nextSourceValue = sourceRegularValues[sourceIndex] ?? "";
    sourceIndex += 1;

    if (!currentValue && nextSourceValue) {
      normalizedTarget[field.key] = nextSourceValue;
    }
  });

  return normalizedTarget;
}

export default function OccasionPage() {
  const { occasions, loading } = useOccasions();
  const { booking, setOccasion, hydrated } = useBooking();
  const { submitOccasion } = useSubmitOccasion();
  const router = useRouter();

  const [selectedOccasion, setSelectedOccasion] = useState<Occasion | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(false);
  const [isOccasionSubmitted, setIsOccasionSubmitted] = useState(false);
  const [occasionDrafts, setOccasionDrafts] = useState<Record<string, Record<string, string>>>({});
  const [showInlineSummarySubmit, setShowInlineSummarySubmit] = useState(false);

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!hydrated) return;

    if (!booking.bookingId || !booking.package || !booking.schedule) {
      router.replace("/booking");
    }
  }, [hydrated, booking.bookingId, booking.package, booking.schedule, router]);

  const validate = () => {
    if (!selectedOccasion) return false;

    const nextErrors: Record<string, string> = {};

    selectedOccasion.fields.forEach((field) => {
      if (
        isFieldRequiredForOccasion(selectedOccasion, field) &&
        !formData[field.key]?.trim()
      ) {
        nextErrors[field.key] = "This field is required";
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!selectedOccasion) return;
    if (!validate()) {
      setIsDetailsCollapsed(false);
      return;
    }

    try {
      setSubmitting(true);
      setOccasion(selectedOccasion.key, formData);

      await submitOccasion({
        occasionKey: selectedOccasion.key,
        occasionData: formData,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOccasionFormSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    await handleSubmit();
  };

  const handleSummarySubmit = () => {
    if (!selectedOccasion) {
      void handleSubmit();
      return;
    }

    const formId = `occasion-form-${selectedOccasion.key}`;
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
    const occasion = booking.occasion;
    if (!occasion || !occasions.length) return;

    const match = occasions.find((o) => o.key === occasion.key);
    if (!match) return;

    setSelectedOccasion(match);

    const normalized: Record<string, string> = {
      ...(occasion.data ?? {}),
    };

    match.fields.forEach((f) => {
      if (normalized[f.key] === undefined) {
        normalized[f.key] = "";
      }
    });

    setFormData(normalized);
    setErrors({});
    setIsDetailsCollapsed(true);
    setIsOccasionSubmitted(true);
    setOccasionDrafts((prev) => ({
      ...prev,
      [match.key]: normalized,
    }));
  }, [booking.occasion, occasions]);

  useEffect(() => {
    if (!selectedOccasion || isDetailsCollapsed) return;

    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      const cardNode = cardRefs.current[selectedOccasion.id];
      if (cardNode) {
        window.requestAnimationFrame(() => {
          cardNode.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    }

    const timer = window.setTimeout(() => {
      const firstInput = firstInputRef.current;
      if (!firstInput) return;

      firstInput.focus();

      if (typeof window === "undefined" || window.innerWidth >= 1024) return;

      const ensureInputVisible = () => {
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const rect = firstInput.getBoundingClientRect();
        const topSafe = 88;
        const bottomSafe = 20;

        if (rect.top < topSafe) {
          window.scrollBy({
            top: rect.top - topSafe - 12,
            behavior: "smooth",
          });
          return;
        }

        if (rect.bottom > viewportHeight - bottomSafe) {
          window.scrollBy({
            top: rect.bottom - (viewportHeight - bottomSafe) + 12,
            behavior: "smooth",
          });
        }
      };

      window.requestAnimationFrame(ensureInputVisible);
      window.setTimeout(ensureInputVisible, 240);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [selectedOccasion, isDetailsCollapsed]);

  const canContinue = Boolean(
    selectedOccasion &&
    selectedOccasion.fields.every(
      (f) =>
        !isFieldRequiredForOccasion(selectedOccasion, f) ||
        formData[f.key]?.trim()
    )
  );

  const occasionPreview = useMemo(() => {
    if (!selectedOccasion) return undefined;
    return {
      label: selectedOccasion.name,
      data: formData,
    };
  }, [selectedOccasion, formData]);

  return (
    <div className="min-h-screen w-full bg-[#f6f8f7]">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 pt-0 sm:pt-5 pb-5">
        <div className="grid grid-cols-1 gap-5 pt-4 lg:grid-cols-3 lg:items-stretch lg:gap-5">
          <div className="min-w-0 lg:col-span-2">
            <StepIndicator currentStep={3} className="lg:hidden !px-2 !py-2" />
            <div className="bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-gray-900/[0.04] md:p-6">
              <div className="mb-1 flex items-center justify-between gap-3">
                <h2 className="min-w-0 truncate text-1xl font-semibold text-[#1f2937]">
                  Select an occasion
                </h2>

                <button
                  type="button"
                  onClick={() => router.push("/booking/contact")}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-50 hover:text-gray-900"
                >
                  <ChevronLeft size={14} />
                  Back
                </button>
              </div>
              <p className="mb-5 text-sm text-gray-500">
                Pick one option and fill the details inline.
              </p>

              {loading && <p className="text-sm text-gray-400">Loading occasions…</p>}

              {!loading && occasions.length === 0 && (
                <p className="text-sm text-red-500">No occasions available.</p>
              )}

              {!loading && occasions.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {occasions.map((occasion, index) => {
                  const isSelected = selectedOccasion?.id === occasion.id;
                  const isExpanded = isSelected && !isDetailsCollapsed;
                  const isDimmed = Boolean(selectedOccasion) && !isSelected;
                  const isSubmitted = isSelected && isOccasionSubmitted;
                  const personalizedMessage = isSubmitted
                    ? buildOccasionPersonalizedMessage(
                      occasion.key,
                      occasion.name,
                      formData
                    )
                    : undefined;

                  return (
                    <div
                      key={occasion.id}
                      ref={(el) => {
                        cardRefs.current[occasion.id] = el;
                      }}
                      className={`relative w-full ${isExpanded ? "z-30" : isSelected ? "z-20" : "z-0"}`}
                    >
                      <OccasionCard
                        label={occasion.name}
                        icon={occasion.icon}
                        subtext={occasion.subtext}
                        selected={isSelected}
                        dimmed={isDimmed}
                        expanded={isExpanded}
                        submitted={isSubmitted}
                        personalizedMessage={personalizedMessage}
                        overlayMobileAlign={index % 2 === 0 ? "left" : "right"}
                        overlayDesktopAlign={index % 4 === 0 ? "left" : "center"}
                        onSelect={() => {
                          if (selectedOccasion?.id === occasion.id) {
                            if (isDetailsCollapsed) {
                              setIsDetailsCollapsed(false);
                            }
                            return;
                          }

                          const sourceOccasion = selectedOccasion;
                          const sourceData = formData;
                          const existingTargetDraft = occasionDrafts[occasion.key];
                          const nextFormData = buildMappedFormData({
                            targetOccasion: occasion,
                            sourceOccasion,
                            sourceData,
                            existingTargetData: existingTargetDraft,
                          });

                          if (sourceOccasion) {
                            setOccasionDrafts((prev) => ({
                              ...prev,
                              [sourceOccasion.key]: sourceData,
                              [occasion.key]: nextFormData,
                            }));
                          } else {
                            setOccasionDrafts((prev) => ({
                              ...prev,
                              [occasion.key]: nextFormData,
                            }));
                          }

                          setSelectedOccasion(occasion);
                          setFormData(nextFormData);
                          setErrors({});
                          setIsDetailsCollapsed(false);
                          setIsOccasionSubmitted(false);
                        }}
                        onEdit={() => {
                          setSelectedOccasion(occasion);
                          setIsDetailsCollapsed(false);
                          setIsOccasionSubmitted(false);
                        }}
                        onClose={() => {
                          const hasAnyFilledDetail = occasion.fields.some((field) =>
                            String(formData[field.key] ?? "").trim().length > 0
                          );

                          if (!isOccasionSubmitted && !hasAnyFilledDetail) {
                            setSelectedOccasion(null);
                            setFormData({});
                            setIsDetailsCollapsed(false);
                            setIsOccasionSubmitted(false);
                            setErrors({});
                            setOccasionDrafts((prev) => {
                              const next = { ...prev };
                              delete next[occasion.key];
                              return next;
                            });
                            return;
                          }

                          setIsDetailsCollapsed(true);
                          setErrors({});
                        }}
                      >
                        <form
                          id={`occasion-form-${occasion.key}`}
                          autoComplete="on"
                          onSubmit={handleOccasionFormSubmit}
                          className="w-full space-y-2.5"
                        >
                          {occasion.fields.map((field, index) => {
                            const fieldHasError = Boolean(errors[field.key]);
                            const isMessageInputField = isMessageField(field);
                            const isRequiredField = isFieldRequiredForOccasion(
                              occasion,
                              field
                            );

                            return (
                              <motion.div
                                key={field.key}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: index * 0.03 }}
                                className="w-full"
                              >
                                <label className="text-xs font-medium text-gray-700">
                                  {field.label}
                                  {isMessageInputField && !isRequiredField
                                    ? " (Optional)"
                                    : ""}
                                  {isRequiredField ? " *" : ""}
                                </label>
                                <input
                                  ref={index === 0 ? firstInputRef : undefined}
                                  name={`${occasion.key}_${field.key}`}
                                  type={resolveDynamicFieldInputType(field)}
                                  autoComplete={resolveDynamicFieldAutocomplete(field)}
                                  required={isRequiredField}
                                  placeholder={field.placeholder || "Enter value"}
                                  value={formData[field.key] || ""}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setFormData((prev) => ({
                                      ...prev,
                                      [field.key]: value,
                                    }));
                                    setOccasionDrafts((prev) => ({
                                      ...prev,
                                      [occasion.key]: {
                                        ...(prev[occasion.key] ?? {}),
                                        [field.key]: value,
                                      },
                                    }));
                                    setIsOccasionSubmitted(false);
                                    if (errors[field.key]) {
                                      setErrors((prev) => ({
                                        ...prev,
                                        [field.key]: "",
                                      }));
                                    }
                                  }}
                                  className={`mt-1 w-full border bg-[#fcfdfd] px-2.5 py-2.5 text-sm text-black outline-none transition-colors focus:border-[#347f7c] focus:ring-2 focus:ring-[#347f7c]/10 ${
                                    fieldHasError ? "border-red-500" : "border-[#d7e4e1]"
                                    }`}
                                />
                                {fieldHasError && (
                                  <p className="mt-1 text-xs text-red-500">{errors[field.key]}</p>
                                )}
                              </motion.div>
                            );
                          })}

                          <div className="flex justify-end pt-0.5">
                            <button
                              type="button"
                              onClick={async () => {
                                if (validate()) {
                                  try {
                                    setSubmitting(true);
                                    setOccasion(occasion.key, formData);

                                    await submitOccasion(
                                      {
                                        occasionKey: occasion.key,
                                        occasionData: formData,
                                      },
                                      { redirectOnSuccess: false }
                                    );

                                    setIsOccasionSubmitted(true);
                                    setIsDetailsCollapsed(true);
                                  } finally {
                                    setSubmitting(false);
                                  }
                                }
                              }}
                              disabled={submitting}
                              className="cursor-pointer border border-[#347f7c] bg-[#347f7c] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#245e5b]"
                            >
                              {submitting ? "Saving..." : "Save Details"}
                            </button>
                          </div>
                          <button type="submit" className="hidden" aria-hidden="true" />
                        </form>
                      </OccasionCard>
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          </div>

          <div className="h-fit lg:sticky lg:top-28">
            <BookingSummary
              products={booking.bookingItems}
              onSubmit={handleSummarySubmit}
              isSubmitDisabled={!canContinue}
              hideSubmitOnMobile
              onMobileInlineSubmitVisibilityChange={setShowInlineSummarySubmit}
              enableInvalidSubmitFeedback
              invalidSubmitMessage="Please select your occasion and fill the details to continue."
              submitLabel={submitting ? "Saving..." : "Continue to Add-ons"}
              occasionPreview={occasionPreview}
            />
          </div>
        </div>
      </div>
      <MobileStickyAction
        label={submitting ? "Saving..." : "Continue to Add-ons"}
        onClick={handleSummarySubmit}
        disabled={submitting}
        hidden={showInlineSummarySubmit}
        isInvalid={!canContinue && !submitting}
        enableInvalidSubmitFeedback
        invalidSubmitMessage="Please select your occasion and fill the details to continue."
        totalPrice={booking.pricing?.total ?? booking.schedule?.basePrice ?? null}
        advancePay={booking.pricing?.advancePay ?? null}
      />
    </div>
  );
}
