import type { GroupedPackageFeatureItem } from "@/types/venue-package";

type PackagePriceBreakdownProps = {
  items: GroupedPackageFeatureItem[];
  compact?: boolean;
};

export default function PackagePriceBreakdown({
  items,
  compact = false,
}: PackagePriceBreakdownProps) {
  if (items.length === 0) return null;

  return (
    <section>
      <h3 className={`${compact ? "text-lg" : "text-xl"} font-semibold text-[#2d2d2d]`}>
        Price Breakdown
      </h3>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-center justify-between gap-4 ${
              item.label.toLowerCase().includes("before savings")
                ? "border-t border-[#e4e7ec] pt-3 text-[#101828] font-semibold"
                : "text-[#667085]"
            }`}
          >
            <span className={compact ? "text-sm" : "text-base"}>{item.label}</span>
            <span className={compact ? "text-sm" : "text-base"}>{item.value ?? "-"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
