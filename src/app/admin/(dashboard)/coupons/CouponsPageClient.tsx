"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/admin/page/PageHeader";
import { Plus, Search, Tag } from "@/components/icons";
import CouponFilters from "@/components/admin/coupons/CouponFilters";
import CouponTable from "@/components/admin/coupons/CouponTable";
import CouponDrawer, {
  invalidateCouponRuleOptionsCache,
} from "@/components/admin/coupons/CouponDrawer";
import ConfirmActionModal from "@/components/admin/drawer/ConfirmActionModal";
import AdminEmptyState from "@/components/admin/shared/AdminEmptyState";
import {
  AdminCouponListResponse,
  AdminCouponListItem,
  CouponActivityFilter,
} from "@/components/admin/coupons/coupon-list.types";
import type { CouponScopeUi } from "@/lib/coupon-scope";
import type { TabKey } from "@/components/admin/coupons/drawer/constants";
import { toast } from "sonner";

type CouponApiResponse = {
  success: boolean;
  message?: string;
  data?: AdminCouponListResponse;
};

const PAGE_SIZE = 20;

export default function CouponsPageClient() {
  const [coupons, setCoupons] = useState<AdminCouponListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">(
    "ALL"
  );
  const [activityFilter, setActivityFilter] = useState<CouponActivityFilter>("ALL");
  const [discountTypeFilter, setDiscountTypeFilter] = useState<
    "ALL" | "FLAT" | "PERCENTAGE"
  >("ALL");
  const [scopeFilter, setScopeFilter] = useState<
    "ALL" | CouponScopeUi
  >("ALL");
  const [stackableFilter, setStackableFilter] = useState<"ALL" | "YES" | "NO">(
    "ALL"
  );
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [drawerInitialTab, setDrawerInitialTab] = useState<TabKey>("basics");
  const [selectedCouponId, setSelectedCouponId] = useState<string | undefined>(
    undefined
  );
  const [deleteTarget, setDeleteTarget] = useState<AdminCouponListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      status: statusFilter,
      activity: activityFilter,
      discountType: discountTypeFilter,
      scope: scopeFilter,
      stackable: stackableFilter,
    });

    if (deferredSearch) {
      params.set("search", deferredSearch);
    }

    return params.toString();
  }, [
    activityFilter,
    deferredSearch,
    discountTypeFilter,
    page,
    scopeFilter,
    stackableFilter,
    statusFilter,
  ]);

  const fetchCoupons = useCallback(async (activeQueryString: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/coupons?${activeQueryString}`);
      const json: CouponApiResponse = await res.json();

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message ?? "Failed to load coupons");
      }

      const data = json.data;
      setCoupons(data.items);
      setTotalCount(data.totalCount);
      setTotalPages(data.totalPages);
      setPage((currentPage) =>
        currentPage > data.totalPages ? data.totalPages : currentPage
      );
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Failed to load coupons";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCoupons(queryString);
  }, [fetchCoupons, queryString]);

  useEffect(() => {
    setPage(1);
  }, [
    activityFilter,
    deferredSearch,
    discountTypeFilter,
    scopeFilter,
    stackableFilter,
    statusFilter,
  ]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== "ALL" ||
    activityFilter !== "ALL" ||
    discountTypeFilter !== "ALL" ||
    scopeFilter !== "ALL" ||
    stackableFilter !== "ALL";

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setActivityFilter("ALL");
    setDiscountTypeFilter("ALL");
    setScopeFilter("ALL");
    setStackableFilter("ALL");
    setPage(1);
  }

  function openCreateCoupon() {
    setDrawerMode("create");
    setDrawerInitialTab("basics");
    setSelectedCouponId(undefined);
    setDrawerOpen(true);
  }

  function openDeleteModal(coupon: AdminCouponListItem) {
    setDeleteError(null);
    setDeleteTarget(coupon);
  }

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteError(null);
    setDeleteTarget(null);
  }

  async function handleDeleteCoupon() {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      setDeleteError(null);

      const res = await fetch(`/api/admin/coupons/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; message?: string }
        | null;

      if (!res.ok || !json?.success) {
        setDeleteError(json?.message ?? "Failed to delete coupon");
        return;
      }

      toast.success(json?.message ?? "Coupon deleted successfully");
      invalidateCouponRuleOptionsCache();
      await fetchCoupons(queryString);
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete coupon");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Discount"
        description="Manage coupon availability, validity windows, discount logic, and usage controls."
        inlineActions
        actions={
          <button
            type="button"
            onClick={() => {
              openCreateCoupon();
            }}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 active:scale-[0.98]"
          >
            <Plus size={16} />
            Create Coupon
          </button>
        }
      />

      <div className="mt-6">
        <CouponFilters
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          activityFilter={activityFilter}
          onActivityFilterChange={setActivityFilter}
          discountTypeFilter={discountTypeFilter}
          onDiscountTypeFilterChange={setDiscountTypeFilter}
          scopeFilter={scopeFilter}
          onScopeFilterChange={setScopeFilter}
          stackableFilter={stackableFilter}
          onStackableFilterChange={setStackableFilter}
        />
      </div>

      {loading && (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-sm text-neutral-500">
          Loading coupons...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => {
              void fetchCoupons(queryString);
            }}
            className="mt-3 cursor-pointer rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && coupons.length === 0 && (
        <AdminEmptyState
          className="mt-0"
          title={hasActiveFilters ? "No coupons match your filters" : "No coupons found"}
          description={
            hasActiveFilters
              ? "Try clearing filters to view available coupons."
              : "Create your first coupon to start offering discounts."
          }
          icon={hasActiveFilters ? <Search size={18} /> : <Tag size={18} />}
          actionLabel={hasActiveFilters ? "Clear Filters" : "Create Coupon"}
          onAction={hasActiveFilters ? clearFilters : openCreateCoupon}
        />
      )}

      {!loading && !error && coupons.length > 0 && (
        <CouponTable
          data={coupons}
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={setPage}
          onView={(coupon) => {
            setDrawerMode("edit");
            setDrawerInitialTab("preview");
            setSelectedCouponId(coupon.id);
            setDrawerOpen(true);
          }}
          onEdit={(coupon) => {
            setDrawerMode("edit");
            setDrawerInitialTab("basics");
            setSelectedCouponId(coupon.id);
            setDrawerOpen(true);
          }}
          onDelete={(coupon) => {
            openDeleteModal(coupon);
          }}
        />
      )}

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Confirm Coupon Deletion"
        description={
          <>
            You are about to permanently delete{" "}
            <strong>{deleteTarget?.code ?? "this coupon"}</strong>. This action
            cannot be undone.
          </>
        }
        confirmLabel="Yes, Delete Coupon"
        loadingLabel="Deleting..."
        loading={deleting}
        error={deleteError}
        onClose={closeDeleteModal}
        onConfirm={() => void handleDeleteCoupon()}
      />

      <CouponDrawer
        key={`${drawerMode}-${selectedCouponId ?? "new"}`}
        open={drawerOpen}
        mode={drawerMode}
        initialTab={drawerInitialTab}
        couponId={selectedCouponId}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerInitialTab("basics");
          setSelectedCouponId(undefined);
        }}
        onSaved={() => {
          void fetchCoupons(queryString);
        }}
      />
    </>
  );
}
