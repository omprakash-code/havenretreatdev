"use client";

import { useEffect } from "react";
import AdminDrawer from "@/components/admin/drawer/AdminDrawer";
import SlotDetails from "./SlotDetails";
import type { AdminSlot } from "@/types/admin/slot-admin";
import { formatISTDate, formatSlotTime} from "@/lib/formatters";

type Props = {
  open: boolean;
  onClose: () => void;
  slot: AdminSlot | null;
};

export default function SlotDrawer({
  open,
  onClose,
  slot,
}: Props) {
  useEffect(() => {
    if (!open) {
      // reset later if we add state inside SlotDetails
    }
  }, [open]);

  if (!slot) return null;

  return (
    <AdminDrawer
      open={open}
      onClose={onClose}
      title="Slot Details"
      description={`${formatISTDate(slot.date)} • ${formatSlotTime(slot.startTime, slot.endTime)}`}
    >
      <SlotDetails slot={slot} />
    </AdminDrawer>
  );
}
