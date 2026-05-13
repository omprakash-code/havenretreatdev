"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, ChevronDown } from "@/components/icons";
import PackageFeatureGroup from "@/components/packages/PackageFeatureGroup";
import PackagePriceBreakdown from "@/components/packages/PackagePriceBreakdown";
import type { EventPackageSummary } from "@/types/venue-package";

type PackageCardProps = {
  eventPackage: EventPackageSummary;
  showDetailLink?: boolean;
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

export default function PackageCard({
  eventPackage,
  showDetailLink = true,
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
    <article className="flex h-full flex-col border border-[#2f7e7a]/45 bg-white p-3">
      <div className="bg-[#edf3f1] px-3 py-2 text-center text-sm font-medium text-[#2b2b2b]">
        {eventPackage.isPopular ? "Most Popular" : `Up to ${eventPackage.guestLimit} Guests`}
      </div>

      <div className="mt-3 bg-[#347f7c] px-4 py-4 text-center text-white">
        <h2 className="font-playfair text-[2rem] font-semibold leading-tight">
          {eventPackage.name}
        </h2>
        <p className="mt-1 text-base text-white/90">
          Up to {eventPackage.guestLimit} Guests
        </p>
        <p className="mt-3 text-4xl font-semibold tracking-tight">
          {formatCurrency(eventPackage.finalAmount)}
        </p>
        <p className="mt-2 text-sm text-white/90">
          Save {formatCurrency(eventPackage.savingsAmount)} with package pricing
        </p>
      </div>

      <div className="mt-4 flex-1">
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

          {expanded && (
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
          )}
        </div>

        {showDetailLink ? (
          <div className="mt-3">
            <Link
              href={`/packages/${eventPackage.slug}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#347f7c] hover:text-[#245e5b]"
            >
              View full package page
              <ArrowRight size={16} />
            </Link>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={handleBookPlaceholder}
        className="mt-4 inline-flex w-full items-center justify-center bg-[#347f7c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#245e5b]"
      >
        {bookLabel}
      </button>
    </article>
  );
}
