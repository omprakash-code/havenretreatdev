"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOccasions } from "@/components/booking/occasion/useOccasions";
import VenueBookingLayout from "@/components/venue-booking/VenueBookingLayout";
import { useVenueBooking } from "@/context/VenueBookingContext";
import { HAVEN_BOOKING_ROUTES } from "@/constants/haven-booking-routes";

const ALLOWED_OCCASION_TOKENS = [
  "birthday",
  "anniversary",
  "proposal",
  "baby",
  "family",
  "corporate",
] as const;

function matchesAllowedOccasion(label: string, key: string) {
  const token = `${label} ${key}`.toLowerCase();
  return ALLOWED_OCCASION_TOKENS.some((allowed) => token.includes(allowed));
}

export default function VenueBookingOccasionForm() {
  const router = useRouter();
  const { occasions, loading } = useOccasions();
  const { booking, hydrated, setOccasion, applyPersistedDraft } = useVenueBooking();
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(
    booking.occasionType
  );
  const [formData, setFormData] = useState<Record<string, string>>(
    booking.occasionData ?? {}
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (hydrated && !booking.packageSnapshot) {
      router.replace(HAVEN_BOOKING_ROUTES.PACKAGE);
    }
    if (hydrated && !booking.bookingId) {
      router.replace(HAVEN_BOOKING_ROUTES.DETAILS);
    }
  }, [booking.bookingId, booking.packageSnapshot, hydrated, router]);

  const filteredOccasions = useMemo(() => {
    const matched = occasions.filter((occasion) =>
      matchesAllowedOccasion(occasion.name, occasion.key)
    );
    return matched.length > 0 ? matched : occasions;
  }, [occasions]);

  const activeOccasion =
    filteredOccasions.find((occasion) => occasion.key === selectedOccasion) ?? null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeOccasion) {
      setErrors({ occasion: "Choose an occasion to continue." });
      return;
    }

    const nextErrors: Record<string, string> = {};
    activeOccasion.fields.forEach((field) => {
      if (field.isRequired && !String(formData[field.key] ?? "").trim()) {
        nextErrors[field.key] = "This field is required.";
      }
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (!booking.bookingId) {
      router.replace(HAVEN_BOOKING_ROUTES.DETAILS);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/venue-bookings/occasion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          occasionKey: activeOccasion.key,
          occasionData: formData,
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.success || !json?.data?.draft) {
        setErrors((current) => ({
          ...current,
          occasion: json?.message || "Unable to save occasion details.",
        }));
        return;
      }

      setOccasion(activeOccasion.key, formData);
      applyPersistedDraft(json.data.draft);
      router.push(HAVEN_BOOKING_ROUTES.ADDONS);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hydrated || !booking.packageSnapshot) {
    return null;
  }

  return (
    <VenueBookingLayout
      currentStep={3}
      title="Choose the Occasion"
      description="We’re reusing the existing occasion architecture here so the new venue flow can keep the same dynamic data model without rebuilding it."
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-3xl border border-[#d8e4e2] bg-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.06)]"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="text-sm text-[#667085]">Loading occasions...</div>
          ) : (
            filteredOccasions.map((occasion) => {
              const isSelected = occasion.key === selectedOccasion;
              return (
                <button
                  key={occasion.id}
                  type="button"
                  onClick={() => {
                    setSelectedOccasion(occasion.key);
                    setErrors((current) => {
                      const next = { ...current };
                      delete next.occasion;
                      return next;
                    });
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? "border-[#347f7c] bg-[#f1f8f7]"
                      : "border-[#d0d5dd] bg-white hover:border-[#98c4c1]"
                  }`}
                >
                  <p className="text-base font-semibold text-[#101828]">
                    {occasion.name}
                  </p>
                  {occasion.subtext ? (
                    <p className="mt-1 text-sm text-[#667085]">{occasion.subtext}</p>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
        {errors.occasion ? (
          <p className="text-sm text-[#b42318]">{errors.occasion}</p>
        ) : null}

        {activeOccasion ? (
          <div className="grid gap-5 md:grid-cols-2">
            {activeOccasion.fields.map((field) => (
              <label key={field.key} className="block">
                <span className="text-sm font-medium text-[#344054]">
                  {field.label}
                </span>
                <input
                  value={formData[field.key] ?? ""}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                  placeholder={field.placeholder}
                  className="mt-2 w-full rounded-2xl border border-[#d0d5dd] px-4 py-3 text-sm text-[#101828] outline-none transition focus:border-[#347f7c]"
                />
                {errors[field.key] ? (
                  <span className="mt-2 block text-sm text-[#b42318]">
                    {errors[field.key]}
                  </span>
                ) : null}
              </label>
            ))}
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-full bg-[#347f7c] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#245e5b] disabled:cursor-not-allowed disabled:bg-[#98a2b3]"
          >
            {isSubmitting ? "Saving..." : "Save Occasion"}
          </button>
        </div>
      </form>
    </VenueBookingLayout>
  );
}
