"use client";

import AdminDrawer from "@/components/admin/drawer/AdminDrawer";
import AddSlotDetails, {
  type SlotCreateLocationOption,
  type SlotCreateTheatreOption,
} from "./AddSlotDetails";
import type { AdminSlot } from "@/types/admin/slot-admin";

type Props = {
  open: boolean;
  onClose: () => void;
  locations: SlotCreateLocationOption[];
  theatres: SlotCreateTheatreOption[];
  onCreated?: (slot: AdminSlot) => void;
};

export default function AddSlotDrawer({
  open,
  onClose,
  locations,
  theatres,
  onCreated,
}: Props) {
  return (
    <AdminDrawer
      open={open}
      onClose={onClose}
      title="Add Slot"
      description="Create additional manual slots without changing auto-generation templates."
    >
      <AddSlotDetails
        locations={locations}
        theatres={theatres}
        onCancel={onClose}
        onCreated={onCreated}
      />
    </AdminDrawer>
  );
}
