"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import VenueBookingLayout from "@/components/venue-booking/VenueBookingLayout";
import { useVenueBooking } from "@/context/VenueBookingContext";
import { HAVEN_BOOKING_ROUTES } from "@/constants/haven-booking-routes";

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  guestCount: string;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  specialInstructions: string;
};

export default function VenueBookingDetailsForm() {
  const router = useRouter();
  const { booking, hydrated, updateDetails, applyPersistedDraft } = useVenueBooking();
  const [form, setForm] = useState<FormState>({
    fullName: booking.contact.fullName,
    email: booking.contact.email,
    phone: booking.contact.phone,
    guestCount: String(booking.guestCount || 2),
    eventDate: booking.eventDate ?? "",
    eventStartTime: booking.eventStartTime,
    eventEndTime: booking.eventEndTime,
    specialInstructions: booking.specialInstructions,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (hydrated && !booking.packageSnapshot) {
      router.replace(HAVEN_BOOKING_ROUTES.PACKAGE);
    }
  }, [booking.packageSnapshot, hydrated, router]);

  const handleChange = (
    key: keyof FormState,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    const guestCount = Number(form.guestCount);

    if (!form.fullName.trim()) nextErrors.fullName = "Full name is required.";
    if (!form.email.trim()) nextErrors.email = "Email is required.";
    if (!form.phone.trim()) nextErrors.phone = "Phone is required.";
    if (!form.eventDate) nextErrors.eventDate = "Event date is required.";
    if (!form.eventStartTime) {
      nextErrors.eventStartTime = "Start time is required.";
    }
    if (!form.eventEndTime) {
      nextErrors.eventEndTime = "End time is required.";
    }
    if (!Number.isFinite(guestCount) || guestCount < 1) {
      nextErrors.guestCount = "Guest count must be at least 1.";
    }
    if (
      booking.packageSnapshot &&
      Number.isFinite(guestCount) &&
      guestCount > booking.packageSnapshot.guestLimit
    ) {
      nextErrors.guestCount = `This package supports up to ${booking.packageSnapshot.guestLimit} guests.`;
    }
    if (
      form.eventStartTime &&
      form.eventEndTime &&
      form.eventStartTime >= form.eventEndTime
    ) {
      nextErrors.eventEndTime = "End time must be after start time.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const contact = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      };

      const response = await fetch("/api/venue-bookings/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          venueId: booking.venueId,
          packageId: booking.packageId,
          eventDate: form.eventDate,
          eventStartTime: form.eventStartTime,
          eventEndTime: form.eventEndTime,
          guestCount: Number(form.guestCount),
          specialInstructions: form.specialInstructions.trim(),
          contact,
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.success || !json?.data?.draft) {
        setErrors((current) => ({
          ...current,
          form: json?.message || "Unable to save booking draft.",
        }));
        return;
      }

      updateDetails({
        contact,
        eventDate: form.eventDate,
        eventStartTime: form.eventStartTime,
        eventEndTime: form.eventEndTime,
        guestCount: Number(form.guestCount),
        specialInstructions: form.specialInstructions.trim(),
      });
      applyPersistedDraft(json.data.draft);
      router.push(HAVEN_BOOKING_ROUTES.OCCASION);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hydrated || !booking.packageSnapshot) {
    return null;
  }

  return (
    <VenueBookingLayout
      currentStep={2}
      title="Event Details"
      description="Capture the customer contact details, timing, guest count, and special instructions before we move into occasion and add-ons."
    >
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-[#d8e4e2] bg-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.06)]"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Full Name"
            value={form.fullName}
            onChange={(value) => handleChange("fullName", value)}
            error={errors.fullName}
          />
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(value) => handleChange("email", value)}
            error={errors.email}
          />
          <Field
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(value) => handleChange("phone", value)}
            error={errors.phone}
          />
          <Field
            label="Guest Count"
            type="number"
            value={form.guestCount}
            onChange={(value) => handleChange("guestCount", value)}
            error={errors.guestCount}
          />
          <Field
            label="Event Date"
            type="date"
            value={form.eventDate}
            onChange={(value) => handleChange("eventDate", value)}
            error={errors.eventDate}
          />
          <div className="grid gap-5 sm:grid-cols-2 sm:col-span-2">
            <Field
              label="Start Time"
              type="time"
              value={form.eventStartTime}
              onChange={(value) => handleChange("eventStartTime", value)}
              error={errors.eventStartTime}
            />
            <Field
              label="End Time"
              type="time"
              value={form.eventEndTime}
              onChange={(value) => handleChange("eventEndTime", value)}
              error={errors.eventEndTime}
            />
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-sm font-medium text-[#344054]">
            Special Instructions
          </label>
          <textarea
            value={form.specialInstructions}
            onChange={(event) =>
              handleChange("specialInstructions", event.target.value)
            }
            rows={4}
            className="mt-2 w-full rounded-2xl border border-[#d0d5dd] px-4 py-3 text-sm text-[#101828] outline-none transition focus:border-[#347f7c]"
            placeholder="Setup requests, access notes, vendor details, or anything the venue should know."
          />
        </div>

        <div className="mt-6 flex justify-end">
          {errors.form ? (
            <p className="mr-auto self-center text-sm text-[#b42318]">
              {errors.form}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-full bg-[#347f7c] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#245e5b] disabled:cursor-not-allowed disabled:bg-[#98a2b3]"
          >
            {isSubmitting ? "Saving..." : "Save Details"}
          </button>
        </div>
      </form>
    </VenueBookingLayout>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: React.HTMLInputTypeAttribute;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[#344054]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-[#d0d5dd] px-4 py-3 text-sm text-[#101828] outline-none transition focus:border-[#347f7c]"
      />
      {error ? <span className="mt-2 block text-sm text-[#b42318]">{error}</span> : null}
    </label>
  );
}
