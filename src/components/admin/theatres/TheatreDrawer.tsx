"use client";

import { useState } from "react";
import AdminDrawer from "@/components/admin/drawer/AdminDrawer";
import TheatreForm from "@/components/admin/theatres/TheatreForm";
import type { AdminTheatre } from "@/types/admin/theatre-admin";
import type { TheatreFormValues } from "@/components/admin/theatres/theatre.schema";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  theatre: AdminTheatre | null;
  locations: Array<{ id: string; name: string }>;
};

export default function TheatreDrawer({
  open,
  onClose,
  theatre,
  locations,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(values: TheatreFormValues) {
    try {
      setLoading(true);

      const res = await fetch("/api/admin/theatres", {
        method: theatre ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          id: theatre?.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.message || "Failed to save theatre");
        return;
      }

      toast.success(
        theatre
          ? "Theatre updated successfully"
          : "Theatre created successfully"
      );

      onClose();
    } catch (error) {
      console.error("THEATRE_SAVE_ERROR", error);
      toast.error("Something went wrong while saving theatre");
    } finally {
      setLoading(false);
    }
  }

  // console.log("THEATRE FROM LIST:", theatre);
  return (
    <AdminDrawer
      open={open}
      onClose={onClose}
      title={theatre ? "Edit Theatre" : "Add Theatre"}
    >
      <TheatreForm
        /** THIS IS THE IMPORTANT PART */
        key={theatre?.id ?? "create"}
        locations={locations}
        loading={loading}
        defaultValues={
          theatre
            ? {
                name: theatre.name,
                locationId: theatre.location?.id,
                capacity: theatre.capacity,
                baseGuests: theatre.baseGuests,
                extraPersonPrice: theatre.extraPersonPrice,
                decorationPrice: theatre.decorationPrice,
                hasFood: theatre.hasFood,
                isActive: theatre.isActive,
                images: theatre.images,
                sortOrder: theatre.sortOrder ?? 0,
                footerMessage: theatre.footerMessage ?? undefined,
                mapUrl: theatre.mapUrl ?? undefined,
                menuFile: theatre.menuFile ?? undefined,
              }
            : undefined
        }
        onSubmit={handleSubmit}
      />
    </AdminDrawer>
    
  );
}
