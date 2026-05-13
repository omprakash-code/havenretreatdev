// src/lib/admin/sla.ts

import {
  Flame,
  Thermometer,
  Snowflake,
  TimerOff,
  type LucideIcon,
} from "lucide-react";

/* -----------------------------
   Types
------------------------------ */
export type SLAStatus = "HOT" | "WARM" | "COOLING" | "EXPIRED";

export type SLAInfo = {
  label: SLAStatus;
  ageMinutes: number;
};

export type SLAMeta = {
  icon: LucideIcon;
  className: string;
  label: string;
};

/* -----------------------------
   SLA visual metadata
------------------------------ */
export const SLA_META: Record<SLAStatus, SLAMeta> = {
  HOT: {
    icon: Flame,
    className: "text-red-600",
    label: "Hot lead",
  },
  WARM: {
    icon: Thermometer,
    className: "text-orange-600",
    label: "Warm lead",
  },
  COOLING: {
    icon: Snowflake,
    className: "text-[#FFD700]",
    label: "Cooling",
  },
  EXPIRED: {
    icon: TimerOff,
    className: "text-gray-400",
    label: "Expired",
  },
};

/* -----------------------------
   SLA calculator (EXPORT THIS)
------------------------------ */
export function getSLA(createdAtISO: string): SLAInfo {
  const createdAt = new Date(createdAtISO);
  const now = new Date();

  const diffMs = now.getTime() - createdAt.getTime();
  const ageMinutes = Math.floor(diffMs / (1000 * 60));

  if (ageMinutes <= 2) {
    return { label: "HOT", ageMinutes };
  }

  if (ageMinutes <= 5) {
    return { label: "WARM", ageMinutes };
  }

  if (ageMinutes <= 10) {
    return { label: "COOLING", ageMinutes };
  }

  return { label: "EXPIRED", ageMinutes };
}
