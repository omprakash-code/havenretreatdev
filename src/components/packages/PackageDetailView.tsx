"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import PackageCard from "@/components/packages/PackageCard";
import PackageFeatureGroup from "@/components/packages/PackageFeatureGroup";
import PackagePriceBreakdown from "@/components/packages/PackagePriceBreakdown";
import type { EventPackageSummary } from "@/types/venue-package";

type PackageDetailViewProps = {
  eventPackage: EventPackageSummary;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PackageDetailView({
  eventPackage,
}: PackageDetailViewProps) {
  const allAddons = useMemo(() => eventPackage.addons, [eventPackage.addons]);

  return (
    <section className="bg-[#f8f7f4] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1.15fr)_420px]">
        <div>
          <p className="text-sm font-medium tracking-[0.18em] text-[#347f7c] uppercase">
            Package Details
          </p>
          <h1 className="mt-4 font-playfair text-4xl leading-tight text-[#151515] sm:text-5xl">
            {eventPackage.name}
          </h1>
          <p className="mt-4 max-w-3xl text-base text-[#4b5563] sm:text-lg">
            {eventPackage.shortDescription}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Metric label="Guests" value={`Up to ${eventPackage.guestLimit}`} />
            <Metric label="Event Duration" value={`${eventPackage.eventDurationHours} hours`} />
            <Metric label="Complimentary Setup" value={`${eventPackage.complimentarySetupHours} hour`} />
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#e4e7ec] bg-white p-5">
              <PackageFeatureGroup
                title="Included"
                items={eventPackage.featureGroups.included}
              />
            </div>

            <div className="rounded-2xl border border-[#e4e7ec] bg-white p-5">
              <PackageFeatureGroup
                title="Decoration Included"
                items={eventPackage.featureGroups.decoration}
              />
            </div>

            <div className="rounded-2xl border border-[#e4e7ec] bg-white p-5">
              <PackageFeatureGroup
                title="Cleaning"
                items={eventPackage.featureGroups.cleaning}
              />
            </div>

            <div className="rounded-2xl border border-[#e4e7ec] bg-white p-5">
              <PackagePriceBreakdown
                items={eventPackage.featureGroups.priceBreakdown}
              />
            </div>
          </div>

          {allAddons.length > 0 ? (
            <div className="mt-10 rounded-2xl border border-[#e4e7ec] bg-white p-5">
              <h2 className="text-xl font-semibold text-[#2d2d2d]">Optional Add-ons</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {allAddons.map((addon) => (
                  <div key={addon.id} className="rounded-xl border border-[#e4e7ec] p-4">
                    <p className="font-semibold text-[#1f2937]">{addon.name}</p>
                    {addon.description ? (
                      <p className="mt-1 text-sm text-[#667085]">{addon.description}</p>
                    ) : null}
                    <p className="mt-3 text-sm font-medium text-[#347f7c]">
                      {formatCurrency(addon.price)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <PackageCard
            eventPackage={eventPackage}
            defaultExpanded={false}
          />

          <button
            type="button"
            onClick={() =>
              toast.info("Booking integration for venue packages is coming next.", {
                id: `package-detail-book-${eventPackage.slug}`,
              })
            }
            className="mt-4 inline-flex w-full items-center justify-center border border-[#347f7c] bg-white px-4 py-2.5 text-sm font-semibold text-[#347f7c] hover:bg-[#edf3f1]"
          >
            Start Booking Flow Later
          </button>
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e4e7ec] bg-white p-4">
      <p className="text-sm font-medium text-[#667085]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[#1f2937]">{value}</p>
    </div>
  );
}
