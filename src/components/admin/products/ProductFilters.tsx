"use client";

import AdminCompactFilters from "@/components/admin/shared/AdminCompactFilters";
import type { AdminProduct } from "@/types/admin/product";

interface Props {
  search: string;
  setSearch: (v: string) => void;

  category: string;
  setCategory: (v: string) => void;

  location: string;
  setLocation: (v: string) => void;

  status: string;
  setStatus: (v: string) => void;

  products: AdminProduct[];
}

export default function ProductFilters({
  search,
  setSearch,
  category,
  setCategory,
  location,
  setLocation,
  status,
  setStatus,
  products,
}: Props) {
  const locations = Array.from(
    new Map(
      products.map((p) => [p.location.id, p.location])
    ).values()
  );

  const activeFilterCount = [
    category.trim().length > 0,
    location.trim().length > 0,
    status.trim().length > 0,
  ].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0 || search.trim().length > 0;

  return (
    <AdminCompactFilters
      hasActiveFilters={hasActiveFilters}
      activeFilterCount={activeFilterCount}
      onClearFilters={
        hasActiveFilters
          ? () => {
              setCategory("");
              setLocation("");
              setStatus("");
              setSearch("");
            }
          : undefined
      }
      searchSlot={
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product name or slug..."
          className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
        />
      }
      filterSlot={
        <>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 w-full cursor-pointer rounded-md border border-neutral-200 px-3 text-sm"
          >
            <option value="">All Categories</option>
            <option value="CAKE">Cake</option>
            <option value="DECORATION">Decoration</option>
            <option value="GIFT">Gift</option>
          </select>

          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="h-10 w-full cursor-pointer rounded-md border border-neutral-200 px-3 text-sm"
          >
            <option value="">All Locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 w-full cursor-pointer rounded-md border border-neutral-200 px-3 text-sm"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </>
      }
    />
  );
}
