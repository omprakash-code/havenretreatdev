"use client";

//src/app/admin/theatres/page.tsx
import { useEffect, useState } from "react";
import { Plus } from "@/components/icons";
import PageHeader from "@/components/admin/page/PageHeader";
import AdminTheatreList from "@/components/admin/theatres/AdminTheatreList";
import AdminDrawer from "@/components/admin/drawer/AdminDrawer";
import TheatreForm from "@/components/admin/theatres/TheatreForm";
import { invalidateCouponRuleOptionsCache } from "@/components/admin/coupons/CouponDrawer";
import type { AdminTheatre } from "@/types/admin/theatre-admin";
import type { TheatreFormValues } from "@/components/admin/theatres/theatre.schema";
import { mapAdminTheatreToForm } from "@/components/admin/theatres/theatre.mapper";
import { toast } from "sonner";

type LocationOption = {
  id: string;
  name: string;
};

export default function AdminTheatresPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTheatre, setEditingTheatre] =
    useState<AdminTheatre | null>(null);

  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [listKey, setListKey] = useState(0);

  function openAddTheatreDrawer() {
    setEditingTheatre(null);
    setDrawerOpen(true);
  }

  // Fetch locations once
  useEffect(() => {
    async function fetchLocations() {
      try {
        setLoadingLocations(true);
        const res = await fetch("/api/locations");
        const json = await res.json();
        setLocations(json.data ?? []);
      } catch (err) {
        console.error("FETCH_LOCATIONS_ERROR", err);
      } finally {
        setLoadingLocations(false);
      }
    }

    fetchLocations();
  }, []);

  async function handleSubmit(
    values: TheatreFormValues,
    helpers?: { reset?: () => void }
  ) {
    const isEdit = Boolean(editingTheatre?.id);

    const payload = {
      ...values,
    };

    
    try {
      const res = await fetch("/api/admin/theatres", {
        method: isEdit ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          isEdit
            ? { ...payload, id: editingTheatre!.id }
            : payload
        ),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.message || "Failed to save theatre");
        return;
      }

      toast.success(
        isEdit
          ? "Theatre updated successfully"
          : "Theatre Added successfully"
      );
      invalidateCouponRuleOptionsCache();

      if (isEdit) {
        //UPDATE
        setDrawerOpen(false);
        setEditingTheatre(null);
      } else {
        //CREATE
        helpers?.reset?.();
      }

      // IMPORTANT (next step): refetch theatre list
      setListKey((k) => k + 1);
    } catch (err) {
      console.error("THEATRE_SUBMIT_ERROR", err);
      toast.error("Something went wrong");
    }
  }



  return (
    <>
      <PageHeader
        title="Theatres"
        description="Manage all private theatre screens, pricing and capacity."
        inlineActions
        actions={
          <button
            onClick={openAddTheatreDrawer}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#27272a] px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-black active:scale-[0.98]"
          >
            <Plus size={16} />
            Add Theatre
          </button>
        }
      />

      <section className="mt-4 sm:mt-6">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AdminTheatreList
            key={listKey}
            onAdd={openAddTheatreDrawer}
            onEdit={(theatre: AdminTheatre) => {
              setEditingTheatre(theatre);
              setDrawerOpen(true);
            }}
          />
        </div>
      </section>

      {/* Drawer */}
      <AdminDrawer
        open={drawerOpen}
        title={editingTheatre ? "Edit Theatre" : "Add Theatre"}
        description="Configure theatre details and pricing"
        onClose={() => {
          setDrawerOpen(false);
          setEditingTheatre(null);
        }}
      >
        <TheatreForm
          locations={locations}
          loading={loadingLocations}
          defaultValues={
            editingTheatre
              ? mapAdminTheatreToForm(editingTheatre)
              : undefined
          }
          onSubmit={handleSubmit}
        />
      </AdminDrawer>
    </>
  );
}
