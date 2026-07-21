"use client";

import { useEffect, useState } from "react";
import {
  IndianRupee,
  CalendarCheck,
  Activity,
  ClipboardCheck,
  ClipboardX,
  ShoppingCart,
} from "@/components/icons";
import KpiCard from "./KpiCard";

const SHOW_LIVE_AND_ABANDONED_KPIS = false;

type KpiData = {
  revenueLifetime: number;
  approvedLifetime: number;
  confirmedLifetime: number;
  pendingReview: number;
  rejectedLifetime: number;
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
    approved?: {
      direction: "up" | "down" | "neutral";
      percentChange: number | null;
      absoluteChange: number;
      current: number;
      previous: number;
    };
    rejected: {
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 lg:gap-5">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-[112px] rounded-2xl bg-gray-100 animate-pulse sm:h-[120px]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5 xl:grid-cols-4">
      <KpiCard
        title="Total Revenue"
        value={`$${data.revenueLifetime.toLocaleString()}`}
        delta={formatTrendDelta(
          data.trends?.revenue,
          data.trends?.periodDays ?? 7,
          "All time",
          (amount) => `$${amount.toLocaleString()}`
        )}
        trend={data.trends?.revenue.direction ?? "neutral"}
        trendSentiment="positive"
        icon={<IndianRupee className="h-5 w-5" />}
      />

      <KpiCard
        title="Pending Bookings"
        value={String(data.pendingReview)}
        delta={data.pendingReview > 0 ? "Awaiting admin review" : "All caught up"}
        trend="neutral"
        icon={<ClipboardCheck className="h-5 w-5" />}
        href="/admin/bookings/pending"
      />

      <KpiCard
        title="Approved Bookings"
        value={String(data.approvedLifetime ?? data.confirmedLifetime)}
        delta={formatTrendDelta(
          data.trends?.approved ?? data.trends?.confirmed,
          data.trends?.periodDays ?? 7,
          "All time"
        )}
        trend={data.trends?.approved?.direction ?? data.trends?.confirmed.direction ?? "neutral"}
        trendSentiment="positive"
        icon={<CalendarCheck className="h-5 w-5" />}
      />

      <KpiCard
        title="Rejected Bookings"
        value={String(data.rejectedLifetime)}
        delta={
          data.rejectedLifetime > 0
            ? "All-time"
            : "No rejected bookings"
        }
        trend="neutral"
        icon={<ClipboardX className="h-5 w-5" />}
      />

      {SHOW_LIVE_AND_ABANDONED_KPIS ? (
        <>
          <KpiCard
            title="Live Bookings"
            value={String(data.liveBookings)}
            delta={data.liveBookings > 0 ? "In progress" : ""}
            trend="neutral"
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
            trendSentiment="negative"
            icon={<ShoppingCart className="h-5 w-5" />}
          />
        </>
      ) : null}
      {/* Future scope: re-enable Coupon Health KPI after finalizing health signal UX. */}

    </div>
  );
}
