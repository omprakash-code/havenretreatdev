import type { AdminProductVariant } from "@/types/admin/product";

export default function ProductVariantChips({
  variants = [],
}: {
  variants?: AdminProductVariant[];
}) {
  if (variants.length === 0) {
    return (
      <span className="text-xs text-neutral-400">
        No variants
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {variants.map((v) => {
        const base =
          "text-xs px-2 py-0.5 rounded-full border whitespace-nowrap";

        // Default + Active
        if (v.isDefault && v.isActive) {
          return (
            <span
              key={v.id}
              className={`${base} bg-neutral-900 text-white border-neutral-900`}
              title="Default variant"
            >
              {v.label}
            </span>
          );
        }

        // Inactive variant
        if (!v.isActive) {
          return (
            <span
              key={v.id}
              className={`${base} border-dashed bg-neutral-50 text-neutral-400 border-neutral-300`}
              title={
                v.isDefault
                  ? "Default variant (inactive)"
                  : "Inactive variant"
              }
            >
              {v.label}
            </span>
          );
        }

        // Active (non-default)
        return (
          <span
            key={v.id}
            className={`${base} bg-neutral-100 text-neutral-700 border-neutral-200`}
            title="Active variant"
          >
            {v.label}
          </span>
        );
      })}
    </div>
  );
}
