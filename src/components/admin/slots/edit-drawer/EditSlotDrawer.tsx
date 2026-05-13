// src/components/admin/slots/edit-drawer/EditSlotDrawer.tsx
"use client";

import AdminDrawer from "@/components/admin/drawer/AdminDrawer";
import EditSlotDetails from "./EditSlotDetails";
import { AdminSlot } from "@/types/admin/slot-admin";
import { formatISTDate, formatSlotTime} from "@/lib/formatters";

type Props = {
  open: boolean;
  onClose: () => void;
  slotId: string | null;
  onUpdated?: (updated: AdminSlot) => void;
  slot: AdminSlot | null;
};

export default function EditSlotDrawer({
  open,
  onClose,
  slotId,
  onUpdated,
  slot
}: Props) {
  
  return (
    <AdminDrawer
      open={open}
      onClose={onClose}
      title="Edit Slot"
      description={slot ? `${formatISTDate(slot.date)} • ${formatSlotTime(slot.startTime, slot.endTime)}` : ""}
    >
      {slotId && <EditSlotDetails slotId={slotId} onCancel={onClose} onUpdated={onUpdated}/>}

    </AdminDrawer>
  );
}
