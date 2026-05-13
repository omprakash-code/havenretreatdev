"use client";

import { ReactNode, useState } from "react";
import { ChevronDown } from "@/components/icons";

type AdminCompactFiltersProps = {
  searchSlot: ReactNode;
  filterSlot: ReactNode;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  onClearFilters?: () => void;
  className?: string;
  filterGridClassName?: string;
};

export default function AdminCompactFilters({
  searchSlot,
  filterSlot,
  hasActiveFilters,
  activeFilterCount,
  onClearFilters,
  className = "",
  filterGridClassName = "md:grid-cols-2 xl:grid-cols-4",
}: AdminCompactFiltersProps) {
  const [isOpen, setIsOpen] = useState(activeFilterCount > 0);

  const toggleLabel =
    activeFilterCount > 0 ? `Filter (${activeFilterCount})` : "Filter";

  return (
    <div
      className={`mt-6 mb-4 rounded-xl border border-neutral-200 bg-white p-3 sm:mb-6 sm:p-4 ${className}`.trim()}
    >
      <div
        className={`flex flex-col transition-[gap] duration-200 ease-out ${
          isOpen ? "gap-3" : "gap-0"
        }`}
      >
        <div className="flex items-center gap-2 md:justify-between md:gap-3">
          <div className="min-w-0 flex-1 md:w-[320px] md:max-w-[360px] md:flex-none lg:w-[360px] lg:max-w-[420px]">
            {searchSlot}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2">
            {onClearFilters && hasActiveFilters ? (
              <button
                type="button"
                onClick={onClearFilters}
                className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 sm:px-3 sm:text-sm"
              >
                Clear
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              aria-expanded={isOpen}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 sm:gap-2 sm:px-3 sm:text-sm"
            >
              <span className="whitespace-nowrap">{toggleLabel}</span>
              <ChevronDown
                size={14}
                className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </div>

        <div
          aria-hidden={!isOpen}
          className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
            isOpen
              ? "grid-rows-[1fr] opacity-100"
              : "pointer-events-none grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div
              className={`grid grid-cols-1 gap-2 transition-[padding-top] duration-200 ease-out sm:gap-3 ${filterGridClassName} ${
                isOpen ? "pt-3" : "pt-0"
              }`}
            >
              {filterSlot}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
