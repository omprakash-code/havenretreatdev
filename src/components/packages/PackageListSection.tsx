import PackageCard from "@/components/packages/PackageCard";
import type { EventPackageSummary, VenueSummary } from "@/types/venue-package";

type PackageListSectionProps = {
  venue?: VenueSummary | null;
  packages: EventPackageSummary[];
};

export default function PackageListSection({
  venue,
  packages,
}: PackageListSectionProps) {
  return (
    <section className="bg-[#f8f7f4] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-medium tracking-[0.18em] text-[#347f7c] uppercase">
            Packages
          </p>
          <h1 className="mt-4 font-playfair text-4xl leading-tight text-[#151515] sm:text-5xl">
            Event Packages Designed Around Your Celebration
          </h1>
          <p className="mt-4 text-base text-[#4b5563] sm:text-lg">
            Flexible options for intimate gatherings, styled celebrations, and personalized setups based on your event needs.
          </p>
          {venue ? (
            <p className="mt-2 text-sm text-[#667085]">
              {venue.name} · {venue.city}{venue.state ? `, ${venue.state}` : ""}
            </p>
          ) : null}
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {packages.map((eventPackage) => (
            <PackageCard key={eventPackage.id} eventPackage={eventPackage} />
          ))}
        </div>

        <div className="mt-8 border border-[#e4e7ec] bg-white px-6 py-6 text-center">
          <p className="text-sm font-semibold text-[#1f2937]">Looking for something different?</p>
          <p className="mt-1 text-sm text-[#667085]">
            All packages can be customized to fit your vision — guest count, décor, and more.{" "}
            <a href="/contact" className="font-medium text-[#347f7c] hover:underline">
              Contact us to discuss.
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
