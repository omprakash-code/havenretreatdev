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
        {items.map((item, idx) => {
          const isTotal = idx === items.length - 1;
          const isSavings = item.label.toLowerCase().includes("before savings");
          return (
            <div
              key={item.id}
              className={`flex items-center justify-between gap-4 ${
                isTotal
                  ? "mt-1 border-t-2 border-[#347f7c] pt-3 font-bold text-[#101828]"
                  : isSavings
                  ? "border-t border-[#e4e7ec] pt-3 text-[#101828] font-semibold"
                  : "text-[#667085]"
              }`}
            >
              <span className={compact ? "text-sm" : "text-base"}>{item.label}</span>
              <span className={`${compact ? "text-sm" : "text-base"} ${isTotal ? "text-[#347f7c]" : ""}`}>
                {item.value ?? "-"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
