"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import VenueBookingLayout from "@/components/venue-booking/VenueBookingLayout";
import { useVenueBooking } from "@/context/VenueBookingContext";
import { HAVEN_BOOKING_ROUTES } from "@/constants/haven-booking-routes";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function VenueBookingAddonsForm() {
  const router = useRouter();
  const { booking, hydrated, setAddonQuantity, applyPersistedDraft } = useVenueBooking();
  const availableAddons = booking.packageSnapshot?.addons ?? [];
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (hydrated && !booking.packageSnapshot) {
      router.replace(HAVEN_BOOKING_ROUTES.PACKAGE);
    }
    if (hydrated && !booking.bookingId) {
      router.replace(HAVEN_BOOKING_ROUTES.DETAILS);
    }
  }, [booking.bookingId, booking.packageSnapshot, hydrated, router]);

  if (!hydrated || !booking.packageSnapshot) {
    return null;
  }

  return (
    <VenueBookingLayout
      currentStep={4}
      title="Optional Add-ons"
      description="Choose any optional add-ons for your event."
    >
      <div className="space-y-6 rounded-3xl border border-[#d8e4e2] bg-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.06)]">
        {availableAddons.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {availableAddons.map((addon) => {
              const currentQuantity =
                booking.selectedAddons.find((item) => item.addonId === addon.id)
                  ?.quantity ?? 0;

              return (
                <div
                  key={addon.id}
                  className="rounded-2xl border border-[#d0d5dd] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-[#101828]">
                        {addon.name}
                      </p>
                      {addon.description ? (
                        <p className="mt-1 text-sm text-[#667085]">
                          {addon.description}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-sm font-semibold text-[#347f7c]">
                      {formatCurrency(addon.price)}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <QuantityButton
                      label="-"
                      onClick={() =>
                        setAddonQuantity(addon, Math.max(0, currentQuantity - 1))
                      }
                    />
                    <span className="min-w-8 text-center text-sm font-semibold text-[#101828]">
                      {currentQuantity}
                    </span>
                    <QuantityButton
                      label="+"
                      onClick={() =>
                        setAddonQuantity(addon, currentQuantity + 1)
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#d0d5dd] p-6 text-sm text-[#667085]">
            No add-ons are attached to this package yet. You can continue without add-ons.
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={async () => {
              if (!booking.bookingId) {
                router.replace(HAVEN_BOOKING_ROUTES.DETAILS);
                return;
              }

              setIsSubmitting(true);
              try {
                const response = await fetch("/api/venue-bookings/addons", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    bookingId: booking.bookingId,
                    selectedAddons: booking.selectedAddons.map((addon) => ({
                      addonId: addon.addonId,
                      quantity: addon.quantity,
                    })),
                  }),
                });

                const json = await response.json().catch(() => null);
                if (!response.ok || !json?.success || !json?.data?.draft) {
                  return;
                }

                applyPersistedDraft(json.data.draft);
                router.push(HAVEN_BOOKING_ROUTES.AGREEMENT);
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="inline-flex items-center justify-center rounded-full bg-[#347f7c] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#245e5b] disabled:cursor-not-allowed disabled:bg-[#98a2b3]"
          >
            {isSubmitting ? "Saving..." : "Continue to Agreement"}
          </button>
        </div>
      </div>
    </VenueBookingLayout>
  );
}

function QuantityButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d0d5dd] text-base font-semibold text-[#101828] transition hover:border-[#347f7c] hover:text-[#347f7c]"
    >
      {label}
    </button>
  );
}
