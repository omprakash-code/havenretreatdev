"use client";

import { ChevronDown, Search } from "@/components/icons";
import AdminCompactFilters from "@/components/admin/shared/AdminCompactFilters";
import { CouponActivityFilter } from "./coupon-list.types";
import type { CouponScopeUi } from "@/lib/coupon-scope";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: "ALL" | "ACTIVE" | "INACTIVE";
  onStatusFilterChange: (value: "ALL" | "ACTIVE" | "INACTIVE") => void;
  activityFilter: CouponActivityFilter;
  onActivityFilterChange: (value: CouponActivityFilter) => void;
  discountTypeFilter: "ALL" | "FLAT" | "PERCENTAGE";
  onDiscountTypeFilterChange: (value: "ALL" | "FLAT" | "PERCENTAGE") => void;
  scopeFilter: "ALL" | CouponScopeUi;
  onScopeFilterChange: (value: "ALL" | CouponScopeUi) => void;
  stackableFilter: "ALL" | "YES" | "NO";
  onStackableFilterChange: (value: "ALL" | "YES" | "NO") => void;
};

export default function CouponFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  activityFilter,
  onActivityFilterChange,
  discountTypeFilter,
  onDiscountTypeFilterChange,
  scopeFilter,
  onScopeFilterChange,
  stackableFilter,
  onStackableFilterChange,
}: Props) {
  const activeFilterCount = [
    statusFilter !== "ALL",
    activityFilter !== "ALL",
    discountTypeFilter !== "ALL",
    scopeFilter !== "ALL",
    stackableFilter !== "ALL",
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0 || search.trim().length > 0;

  return (
    <AdminCompactFilters
      filterGridClassName="md:grid-cols-2 lg:grid-cols-5"
      hasActiveFilters={hasActiveFilters}
      activeFilterCount={activeFilterCount}
      onClearFilters={
        hasActiveFilters
          ? () => {
              onSearchChange("");
              onStatusFilterChange("ALL");
              onActivityFilterChange("ALL");
              onDiscountTypeFilterChange("ALL");
              onScopeFilterChange("ALL");
              onStackableFilterChange("ALL");
            }
          : undefined
      }
      searchSlot={
        <div className="relative w-full">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search coupon code..."
            className="h-10 w-full rounded-md border border-neutral-200 pl-9 pr-3 text-sm outline-none transition focus:border-neutral-300"
          />
        </div>
      }
      filterSlot={
        <>
          <Select
            value={statusFilter}
            onChange={(value) =>
              onStatusFilterChange(value as "ALL" | "ACTIVE" | "INACTIVE")
            }
            options={[
              { value: "ALL", label: "All Status" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />

          <Select
            value={activityFilter}
            onChange={(value) =>
              onActivityFilterChange(value as CouponActivityFilter)
            }
            options={[
              { value: "ALL", label: "All Validity" },
              { value: "LIVE", label: "Live" },
              { value: "UPCOMING", label: "Upcoming" },
              { value: "EXPIRED", label: "Expired" },
            ]}
          />

          <Select
            value={discountTypeFilter}
            onChange={(value) =>
              onDiscountTypeFilterChange(value as "ALL" | "FLAT" | "PERCENTAGE")
            }
            options={[
              { value: "ALL", label: "All Discount Types" },
              { value: "FLAT", label: "Flat" },
              { value: "PERCENTAGE", label: "Percentage" },
            ]}
          />

          <Select
            value={scopeFilter}
            onChange={(value) =>
              onScopeFilterChange(value as "ALL" | CouponScopeUi)
            }
            options={[
              { value: "ALL", label: "All Scope" },
              { value: "BOOKING_TOTAL", label: "Booking Total" },
              { value: "SLOT_ONLY", label: "Slot Only" },
              { value: "PRODUCTS_ONLY", label: "Products Only" },
            ]}
          />

          <Select
            value={stackableFilter}
            onChange={(value) =>
              onStackableFilterChange(value as "ALL" | "YES" | "NO")
            }
            options={[
              { value: "ALL", label: "All Stackability" },
              { value: "YES", label: "Stackable" },
              { value: "NO", label: "Non-Stackable" },
            ]}
          />
        </>
      }
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative w-full">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full cursor-pointer appearance-none rounded-md border border-neutral-200 bg-white pl-3 pr-8 text-sm text-neutral-700 outline-none transition focus:border-neutral-300"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500"
      />
    </div>
  );
}
