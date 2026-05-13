"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MapPin, Plus, Search } from "@/components/icons";
import AdminDrawer from "@/components/admin/drawer/AdminDrawer";
import LocationForm from "@/components/admin/location/LocationForm";
import PageHeader from "@/components/admin/page/PageHeader";
import LocationsTable from "@/components/admin/location/LocationsTable";
import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";
import AdminCompactFilters from "@/components/admin/shared/AdminCompactFilters";
import { invalidateCouponRuleOptionsCache } from "@/components/admin/coupons/CouponDrawer";
import type { AdminLocationRecord, AdminLocationsResponse } from "@/types/admin/location";
import type { LocationFormValues } from "@/components/admin/location/location.schema";

const PAGE_SIZE = 40;

export default function LocationsPageClient() {
  const [rows, setRows] = useState<AdminLocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [selectedLocation, setSelectedLocation] = useState<AdminLocationRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const formDefaultValues = useMemo(
    () =>
      drawerMode === "edit" && selectedLocation
        ? {
            name: selectedLocation.name,
            city: selectedLocation.city,
            isActive: selectedLocation.isActive,
            sortOrder: selectedLocation.sortOrder,
          }
        : undefined,
    [drawerMode, selectedLocation]
  );

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });

      if (statusFilter) params.set("isActive", statusFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/admin/locations?${params.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as
        | AdminLocationsResponse
        | { success?: boolean; message?: string };

      if (!res.ok || !json.success || !("data" in json)) {
        throw new Error(
          "message" in json
            ? json.message || "Failed to fetch locations."
            : "Failed to fetch locations."
        );
      }

      setRows(json.data);
      setTotalPages(json.pagination.totalPages || 1);
      setTotalRecords(json.pagination.total || 0);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to fetch locations."
      );
      setRows([]);
      setTotalPages(1);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    void fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const canPrev = page > 1;
  const canNext = page < totalPages;
  const serialStart = (page - 1) * PAGE_SIZE;
  const hasActiveFilters =
    statusFilter.trim().length > 0 || search.trim().length > 0;

  const summaryText = useMemo(() => {
    if (totalRecords === 0) return "No locations found.";
    const start = serialStart + 1;
    const end = Math.min(page * PAGE_SIZE, totalRecords);
    return `Showing ${start}-${end} of ${totalRecords} locations`;
  }, [page, serialStart, totalRecords]);

  function handleAddLocation() {
    setDrawerMode("create");
    setSelectedLocation(null);
    setDrawerOpen(true);
  }

  function handleEditLocation(row: AdminLocationRecord) {
    setDrawerMode("edit");
    setSelectedLocation(row);
    setDrawerOpen(true);
  }

  function clearFilters() {
    setStatusFilter("");
    setSearch("");
  }

  async function handleSubmitLocation(values: LocationFormValues) {
    try {
      setSaving(true);
      const method = drawerMode === "edit" ? "PATCH" : "POST";
      const payload =
        drawerMode === "edit" && selectedLocation
          ? { id: selectedLocation.id, ...values }
          : values;

      const res = await fetch("/api/admin/locations", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; message?: string }
        | null;

      if (!res.ok || !json?.success) {
        toast.error(json?.message || "Failed to save location.");
        return;
      }

      toast.success(drawerMode === "edit" ? "Location updated." : "Location created.");
      invalidateCouponRuleOptionsCache();
      setDrawerOpen(false);
      await fetchLocations();
    } catch {
      toast.error("Failed to save location.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Locations"
        description="Manage all locations used by theatres, coupons and products."
        inlineActions
        actions={
          <button
            type="button"
            onClick={handleAddLocation}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#27272a] px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-black active:scale-[0.98]"
          >
            <Plus size={16} />
            Add Location
          </button>
        }
      />

      <div className="mt-6">
        <AdminCompactFilters
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={statusFilter.trim().length > 0 ? 1 : 0}
          onClearFilters={hasActiveFilters ? clearFilters : undefined}
          searchSlot={
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or city..."
              className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
            />
          }
          filterSlot={
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          }
        />
      </div>

      <div className="mt-4 text-sm text-neutral-500">{summaryText}</div>

      <div className="mt-4">
        {loading ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-sm text-neutral-500">
            Loading locations...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void fetchLocations()}
              className="mt-3 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <AdminEmptyState
            className="mt-0"
            title={hasActiveFilters ? "No locations match your filters" : "No locations found"}
            description={
              hasActiveFilters
                ? "Try clearing filters to view available locations."
                : "Add your first location to map theatres, products and offers."
            }
            icon={hasActiveFilters ? <Search size={18} /> : <MapPin size={18} />}
            actionLabel={hasActiveFilters ? "Clear Filters" : "Add Location"}
            onAction={hasActiveFilters ? clearFilters : handleAddLocation}
          />
        ) : (
          <LocationsTable
            data={rows}
            serialStart={serialStart}
            onEdit={handleEditLocation}
          />
        )}
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-neutral-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              className="rounded-md border border-neutral-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setPage((prev) => prev + 1)}
              className="rounded-md border border-neutral-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <AdminDrawer
        open={drawerOpen}
        onClose={() => {
          if (saving) return;
          setDrawerOpen(false);
        }}
        title={drawerMode === "edit" ? "Edit Location" : "Add Location"}
        description={
          drawerMode === "edit"
            ? "Update location details and visibility."
            : "Create a new location for theatres and offers."
        }
      >
        <LocationForm
          key={`${drawerMode}-${selectedLocation?.id ?? "new"}`}
          mode={drawerMode}
          loading={saving}
          defaultValues={formDefaultValues}
          onSubmit={(values) => void handleSubmitLocation(values)}
        />
      </AdminDrawer>
    </>
  );
}
