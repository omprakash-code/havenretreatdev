import FeatureItemIcon from "@/components/packages/FeatureItemIcon";
import type { GroupedPackageFeatureItem } from "@/types/venue-package";

type PackageFeatureGroupProps = {
  title: string;
  items: GroupedPackageFeatureItem[];
  compact?: boolean;
};

export default function PackageFeatureGroup({
  title,
  items,
  compact = false,
}: PackageFeatureGroupProps) {
  if (items.length === 0) return null;

  return (
    <section>
      <h3 className={`${compact ? "text-lg" : "text-xl"} font-semibold text-[#2d2d2d]`}>
        {title}
      </h3>
      <ul className={`mt-3 ${compact ? "space-y-2" : "space-y-2.5"} text-[#667085]`}>
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <FeatureItemIcon label={item.label} />
            <div>
              <span className={compact ? "text-sm" : "text-base"}>{item.label}</span>
              {item.value ? (
                <span className={`ml-2 ${compact ? "text-sm" : "text-base"} font-medium text-[#475467]`}>
                  {item.value}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
