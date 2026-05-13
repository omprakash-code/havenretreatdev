"use client";

import { useRouter } from "next/navigation";
import PackageCard from "@/components/packages/PackageCard";
import VenueBookingLayout from "@/components/venue-booking/VenueBookingLayout";
import { useVenueBooking } from "@/context/VenueBookingContext";
import { HAVEN_BOOKING_ROUTES } from "@/constants/haven-booking-routes";
import type { EventPackageSummary, VenueSummary } from "@/types/venue-package";

export default function VenueBookingPackageSelection({
  venue,
  packages,
}: {
  venue?: VenueSummary | null;
  packages: EventPackageSummary[];
}) {
  const router = useRouter();
  const { selectPackage } = useVenueBooking();

  return (
    <VenueBookingLayout
      currentStep={1}
      title="Choose Your Event Package"
      description={
        venue
          ? `${venue.name}${venue.city ? ` in ${venue.city}` : ""} offers flexible packages for styled celebrations, private events, and poolside gatherings.`
          : "Select the package that best fits your guest count, event style, and celebration needs."
      }
    >
      {packages.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {packages.map((eventPackage) => (
            <PackageCard
              key={eventPackage.id}
              eventPackage={eventPackage}
              showDetailLink={false}
              onBook={() => {
                selectPackage(eventPackage);
                router.push(HAVEN_BOOKING_ROUTES.DETAILS);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-[#d0d5dd] bg-white p-8 text-center text-[#667085]">
          No event packages are available right now.
        </div>
      )}
    </VenueBookingLayout>
  );
}
