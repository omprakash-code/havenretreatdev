"use client";

import { useRouter } from "next/navigation";
import {
  PlusCircle,
  CalendarPlus,
  PhoneCall,
  RefreshCcw,
} from "@/components/icons";

type ActionButtonProps = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
};

function ActionButton({
  label,
  icon,
  onClick,
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="
        w-full flex items-center gap-3
        px-4 py-3 rounded-lg
        border border-gray-200
        bg-white
        text-sm font-medium
        hover:bg-gray-50
        transition
      "
    >
      <span className="text-gray-600">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

export default function QuickActions() {
  const router = useRouter();

  return (
    <div className="bg-white rounded-xl border p-4">
      <h3 className="font-semibold text-sm mb-4">
        Quick Actions
      </h3>

      <div className="space-y-3">
        <ActionButton
          label="Create Manual Booking"
          icon={<PlusCircle size={18} />}
          onClick={() => router.push("/admin/bookings/new")}
        />

        <ActionButton
          label="Manage Slots"
          icon={<CalendarPlus size={18} />}
          onClick={() => router.push("/admin/slots")}
        />

        <ActionButton
          label="Call Hot Lead"
          icon={<PhoneCall size={18} />}
          onClick={() => router.push("/admin/live-bookings")}
        />

        <ActionButton
          label="Refresh Dashboard"
          icon={<RefreshCcw size={18} />}
          onClick={() => window.location.reload()}
        />
      </div>
    </div>
  );
}
