"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown } from "@/components/icons";
import PackageFeatureGroup from "@/components/packages/PackageFeatureGroup";
import PackagePriceBreakdown from "@/components/packages/PackagePriceBreakdown";
import type { EventPackageSummary } from "@/types/venue-package";

type PackageCardProps = {
  eventPackage: EventPackageSummary;
  defaultExpanded?: boolean;
  onBook?: (eventPackage: EventPackageSummary) => void;
  bookLabel?: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getBadgeLabel(eventPackage: EventPackageSummary) {
  if (eventPackage.isPopular) return "Most Popular";
  if (eventPackage.guestLimit >= 50) return "For Larger Celebrations";
  return "Best Value";
}

export default function PackageCard({
  eventPackage,
  defaultExpanded = false,
  onBook,
  bookLabel = "Book This Package",
}: PackageCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleBookPlaceholder = () => {
    if (onBook) {
      onBook(eventPackage);
      return;
    }

    toast.info("Booking integration for venue packages is coming next.", {
      id: `package-book-${eventPackage.slug}`,
    });
  };

  return (
    <article className="flex h-full flex-col bg-white shadow-[0_18px_50px_rgba(16,24,40,0.08)]">
      <div className="relative min-h-[180px] overflow-hidden bg-[url('/media/booking/success/pool-view.avif')] bg-cover bg-center px-3 pb-5 pt-3 text-center text-white">
        <div className="absolute inset-0 bg-[#0b1f24]/62" />
        <div className="relative z-10 flex h-full min-h-[152px] flex-col items-center justify-end pt-10">
          <div
            className={`absolute left-0 top-0 px-3 py-1.5 text-[0.65rem] font-extrabold uppercase tracking-[0.11em] ${
              eventPackage.isPopular
                ? "bg-[#347f7c] text-white"
                : "bg-[#edf7f3] text-[#245e5b]"
            }`}
          >
            {getBadgeLabel(eventPackage)}
          </div>
          <h2 className="font-playfair text-[1.55rem] font-semibold leading-tight drop-shadow-sm sm:text-[1.8rem]">
            {eventPackage.name}
          </h2>
          <div className="mt-1 flex items-center justify-center gap-2">
            {eventPackage.hourlyRate > 0 ? (
              <p className="text-[1.9rem] font-medium tracking-tight sm:text-[2.1rem]">
                {formatCurrency(eventPackage.hourlyRate)}<span className="text-base font-normal opacity-80">/hr</span>
              </p>
            ) : (
              <p className="text-[1.9rem] font-medium tracking-tight sm:text-[2.1rem]">
                {formatCurrency(eventPackage.subtotalAmount)}
              </p>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-white/90">
            Up to {eventPackage.guestLimit} Guests
            {eventPackage.hourlyRate > 0 && (
              <span className="ml-1.5 font-normal opacity-75 text-xs">
                · Starting at {formatCurrency(eventPackage.subtotalAmount)} for 4 hrs
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <PackageFeatureGroup
          title="Included"
          items={eventPackage.featureGroups.included}
          compact
        />

        <div className="mt-4 border border-[#e4e7ec]">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex w-full cursor-pointer items-center justify-between gap-3 bg-[#fafafa] px-3 py-2.5 text-left text-sm font-semibold text-[#347f7c]"
          >
            <span>View Package Details</span>
            <ChevronDown
              size={16}
              className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>

          <div
            className={`grid transition-all duration-300 ease-in-out ${
              expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <div className="space-y-4 border-t border-[#e4e7ec] px-3 py-3">
                <PackageFeatureGroup
                  title="Decoration Included"
                  items={eventPackage.featureGroups.decoration}
                  compact
                />
                <PackageFeatureGroup
                  title="Cleaning"
                  items={eventPackage.featureGroups.cleaning}
                  compact
                />
                <PackagePriceBreakdown
                  items={eventPackage.featureGroups.priceBreakdown}
                  compact
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      <button
        type="button"
        onClick={handleBookPlaceholder}
        className="mx-6 mb-6 mt-0 inline-flex items-center justify-center bg-[#347f7c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245e5b]"
      >
        {bookLabel}
      </button>
    </article>
  );
}
