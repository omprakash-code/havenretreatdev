"use client";

import { useEffect, useState } from "react";
import {
  IndianRupee,
  CalendarCheck,
  Activity,
  ShoppingCart,
} from "@/components/icons";
import KpiCard from "./KpiCard";

type KpiData = {
  revenueLifetime: number;
  confirmedLifetime: number;
  abandonedLifetime: number;
  liveBookings: number;
  trends?: {
    periodDays: number;
    revenue: {
      direction: "up" | "down" | "neutral";
      percentChange: number | null;
      absoluteChange: number;
      current: number;
      previous: number;
    };
    confirmed: {
      direction: "up" | "down" | "neutral";
      percentChange: number | null;
      absoluteChange: number;
      current: number;
      previous: number;
    };
    abandoned: {
      direction: "up" | "down" | "neutral";
      percentChange: number | null;
      absoluteChange: number;
      current: number;
      previous: number;
    };
  };
  couponHealth?: {
    staleReservedCount: number;
    mismatchCount: number;
  };
  couponOps?: {
    level: "OK" | "WARNING" | "CRITICAL";
    alerting?: {
      enabled: boolean;
      minLevel: "WARNING" | "CRITICAL";
    };
  };
};

export default function KpiGrid() {
  const [data, setData] = useState<KpiData | null>(null);

  function formatTrendDelta(
    trend:
      | {
          direction: "up" | "down" | "neutral";
          percentChange: number | null;
          absoluteChange: number;
          current: number;
          previous: number;
        }
      | undefined,
    periodDays: number,
    fallback: string,
    valueFormatter: (value: number) => string = (value) => value.toLocaleString()
  ) {
    if (!trend) return fallback;
    if (trend.previous === 0) return "";
    if (trend.direction === "neutral") return `No change vs previous ${periodDays}d`;
    if (trend.percentChange === null) {
      return `${trend.direction === "up" ? "+" : "-"}${valueFormatter(Math.abs(trend.absoluteChange))} vs previous ${periodDays}d`;
    }

    const sign = trend.direction === "up" ? "+" : "-";
    return `${sign}${Math.abs(trend.percentChange)}% vs previous ${periodDays}d`;
  }

  useEffect(() => {
    async function fetchKpis() {
      try {
        const res = await fetch("/api/admin/kpis");
        if (!res.ok) {
          throw new Error("KPI API failed");
        }

        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (e) {
        console.error("KPI_FETCH_ERROR", e);
      }
    }

    fetchKpis();
  }, []);

  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4 lg:gap-5">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-[120px] rounded-2xl bg-gray-100 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4 lg:gap-5">
      <KpiCard
        title="Total Revenue"
        value={`₹${data.revenueLifetime.toLocaleString()}`}
        delta={formatTrendDelta(
          data.trends?.revenue,
          data.trends?.periodDays ?? 7,
          "All time",
          (amount) => `₹${amount.toLocaleString()}`
        )}
        trend={data.trends?.revenue.direction ?? "neutral"}
        tone={
          data.trends?.revenue.direction === "neutral"
            ? "neutral"
            : data.trends?.revenue.direction === "up"
            ? "good"
            : "bad"
        }
        accent="green"
        icon={<IndianRupee className="h-5 w-5" />}
      />

      <KpiCard
        title="Confirmed Bookings"
        value={String(data.confirmedLifetime)}
        delta={formatTrendDelta(
          data.trends?.confirmed,
          data.trends?.periodDays ?? 7,
          "All time"
        )}
        trend={data.trends?.confirmed.direction ?? "neutral"}
        tone={
          data.trends?.confirmed.direction === "neutral"
            ? "neutral"
            : data.trends?.confirmed.direction === "up"
            ? "good"
            : "bad"
        }
        accent="blue"
        icon={<CalendarCheck className="h-5 w-5" />}
      />

      <KpiCard
        title="Live Bookings"
        value={String(data.liveBookings)}
        delta={data.liveBookings > 0 ? "In progress" : ""}
        trend="neutral"
        accent="amber"
        icon={<Activity className="h-5 w-5" />}
      />

      <KpiCard
        title="Abandoned"
        value={String(data.abandonedLifetime)}
        delta={formatTrendDelta(
          data.trends?.abandoned,
          data.trends?.periodDays ?? 7,
          "All time"
        )}
        trend={data.trends?.abandoned.direction ?? "neutral"}
        tone={
          data.trends?.abandoned.direction === "neutral"
            ? "neutral"
            : data.trends?.abandoned.direction === "down"
            ? "good"
            : "bad"
        }
        accent="red"
        icon={<ShoppingCart className="h-5 w-5" />}
      />
      {/* Future scope: re-enable Coupon Health KPI after finalizing health signal UX. */}

    </div>
  );
}
