import type { ReactNode } from "react";

export function FieldTooltip({
  message,
  children,
}: {
  message?: string;
  children: ReactNode;
}) {
  if (!message) return <>{children}</>;

  return (
    <div className="group/field-tooltip relative">
      {children}
      <div
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-20 mt-1 max-w-[260px] rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm opacity-0 translate-y-1 transition-all duration-100 group-hover/field-tooltip:translate-y-0 group-hover/field-tooltip:opacity-100 group-focus-within/field-tooltip:translate-y-0 group-focus-within/field-tooltip:opacity-100"
      >
        {message}
      </div>
    </div>
  );
}
