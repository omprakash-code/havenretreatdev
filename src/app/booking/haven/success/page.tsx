"use client";

import { useRouter } from "next/navigation";
import VenueBookingLayout from "@/components/venue-booking/VenueBookingLayout";
import { useVenueBooking } from "@/context/VenueBookingContext";
import { HAVEN_BOOKING_ROUTES } from "@/constants/haven-booking-routes";

export default function HavenBookingSuccessPage() {
  const router = useRouter();
  const { booking, resetVenueBooking } = useVenueBooking();

  return (
    <VenueBookingLayout
      currentStep={6}
      title="Success Placeholder"
      description="This route is a temporary endpoint for the new venue flow foundation. It proves the parallel state path without connecting booking creation or payment mutations yet."
    >
      <div className="rounded-3xl border border-[#d8e4e2] bg-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.06)]">
        <p className="font-playfair text-3xl text-[#101828]">
          {booking.contact.fullName || "Guest"} is ready for the next phase.
        </p>
        <p className="mt-3 text-base text-[#344054]">
          The Haven venue booking flow now carries package, event, occasion,
          add-on, agreement, and pricing data through its own isolated state.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => {
              resetVenueBooking();
              router.push(HAVEN_BOOKING_ROUTES.PACKAGE);
            }}
            className="inline-flex items-center justify-center rounded-full border border-[#347f7c] px-6 py-3 text-sm font-semibold text-[#347f7c] transition hover:bg-[#f1f8f7]"
          >
            Start New Venue Booking
          </button>
        </div>
      </div>
    </VenueBookingLayout>
  );
}
