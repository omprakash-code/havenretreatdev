"use client";

import type { VenueBookingSelectedAddon } from "@/types/venue-booking";
import { useVenueBooking } from "@/context/VenueBookingContext";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function AddonRow({ addon }: { addon: VenueBookingSelectedAddon }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <div>
        <p className="font-medium text-[#101828]">{addon.name}</p>
        <p className="text-[#667085]">
          {addon.quantity} × {formatCurrency(addon.unitPrice)}
        </p>
      </div>
      <p className="font-medium text-[#101828]">
        {formatCurrency(addon.unitPrice * addon.quantity)}
      </p>
    </div>
  );
}

export default function VenueBookingSummary() {
  const { booking } = useVenueBooking();
  const eventPackage = booking.packageSnapshot;
  const pricing = booking.pricingSnapshot;

  return (
    <aside className="rounded-3xl border border-[#d8e4e2] bg-white p-5 shadow-[0_20px_45px_rgba(15,23,42,0.06)]">
      <p className="text-sm font-semibold tracking-[0.12em] text-[#347f7c] uppercase">
        Booking Summary
      </p>

      {eventPackage ? (
        <div className="mt-4 rounded-2xl bg-[#f5f8f7] p-4">
          <p className="font-playfair text-2xl text-[#101828]">
            {eventPackage.name}
          </p>
          <p className="mt-1 text-sm text-[#667085]">
            Up to {eventPackage.guestLimit} guests at {eventPackage.venue.name}
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-[#d0d5dd] p-4 text-sm text-[#667085]">
          Choose a package to begin your event booking.
        </div>
      )}

      <div className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-[#667085]">Event Date</span>
          <span className="text-right text-[#101828]">
            {booking.eventDate || "Not selected"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#667085]">Time</span>
          <span className="text-right text-[#101828]">
            {booking.eventStartTime && booking.eventEndTime
              ? `${booking.eventStartTime} - ${booking.eventEndTime}`
              : "Not selected"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#667085]">Guests</span>
          <span className="text-right text-[#101828]">{booking.guestCount}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#667085]">Occasion</span>
          <span className="text-right text-[#101828]">
            {booking.occasionType || "Not selected"}
          </span>
        </div>
      </div>

      {booking.selectedAddons.length > 0 ? (
        <div className="mt-5 border-t border-[#eaecf0] pt-5">
          <p className="text-sm font-semibold text-[#101828]">Selected Add-ons</p>
          <div className="mt-3 space-y-3">
            {booking.selectedAddons.map((addon) => (
              <AddonRow key={addon.addonId} addon={addon} />
            ))}
          </div>
        </div>
      ) : null}

      {pricing ? (
        <div className="mt-5 border-t border-[#eaecf0] pt-5 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-[#667085]">Package</span>
            <span className="text-[#101828]">
              {formatCurrency(pricing.packageAmount)}
            </span>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <span className="text-[#667085]">Add-ons</span>
            <span className="text-[#101828]">
              {formatCurrency(pricing.addonsAmount)}
            </span>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <span className="text-[#667085]">Cleaning included</span>
            <span className="text-[#101828]">
              {formatCurrency(pricing.cleaningFeeAmount)}
            </span>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <span className="text-[#667085]">Savings</span>
            <span className="text-[#347f7c]">
              {formatCurrency(pricing.savingsAmount)}
            </span>
          </div>
          <div className="mt-4 flex justify-between gap-4 border-t border-[#eaecf0] pt-4 text-base font-semibold">
            <span className="text-[#101828]">Estimated Total</span>
            <span className="text-[#101828]">
              {formatCurrency(pricing.subtotalAmount)}
            </span>
          </div>
          <div className="mt-2 flex justify-between gap-4">
            <span className="text-[#667085]">Deposit target</span>
            <span className="text-[#101828]">
              {formatCurrency(pricing.depositAmount)}
            </span>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
