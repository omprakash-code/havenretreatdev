"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type RangeKey = "today" | "7d" | "30d" | "90d" | "1y";

type ChartPoint = {
  key: string;
  label: string;
  revenue: number;
  bookings: number;
};

type ChartApiResponse = {
  success: boolean;
  data?: ChartPoint[];
  totals?: {
    revenue: number;
    bookings: number;
  };
};

type Props = {
  range: RangeKey;
};

function formatCompactCurrency(value: number) {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${Math.round(value)}`;
}

export default function RevenueBookingsChart({ range }: Props) {
  const [rows, setRows] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState({ revenue: 0, bookings: 0 });

  useEffect(() => {
    const controller = new AbortController();

    async function fetchChartData() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `/api/admin/charts/revenue-bookings?range=${range}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const json = (await res.json()) as ChartApiResponse;

        if (!res.ok || !json.success || !Array.isArray(json.data)) {
          throw new Error("Unable to load chart data");
        }

        setRows(json.data);
        setTotals({
          revenue: Number(json.totals?.revenue ?? 0),
          bookings: Number(json.totals?.bookings ?? 0),
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("DASHBOARD_CHART_FETCH_ERROR", err);
        setRows([]);
        setTotals({ revenue: 0, bookings: 0 });
        setError("Failed to load chart data");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchChartData();

    return () => controller.abort();
  }, [range]);

  const hasData = useMemo(
    () => rows.some((row) => row.revenue > 0 || row.bookings > 0),
    [rows]
  );

  return (
    <div
      className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-5 w-full"
      style={{ height: 350 }}
    >
      {/* Summary */}
      <div className="flex items-center gap-6 mb-4">
        <div>
          <p className="text-xs text-gray-500">
            Revenue
          </p>
          <p className="text-lg font-semibold text-gray-900">
            ₹{totals.revenue.toLocaleString()}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500">
            Bookings
          </p>
          <p className="text-lg font-semibold text-gray-900">
            {totals.bookings}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={rows}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#f1f1f1"
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="revenue"
            tick={{ fontSize: 12, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatCompactCurrency}
          />
          <YAxis
            yAxisId="bookings"
            orientation="right"
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            tick={{ fontSize: 12, fill: "#9ca3af" }}
          />
          <Tooltip
            formatter={(value, name) => {
              if (name === "revenue") {
                return [`₹${Number(value).toLocaleString()}`, "Revenue"];
              }
              return [Number(value), "Bookings"];
            }}
            contentStyle={{
              background: "white",
              borderRadius: 12,
              border: "none",
              boxShadow:
                "0 10px 25px rgba(0,0,0,0.08)",
            }}
          />

          <Line
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            stroke="#111827"
            strokeWidth={2.5}
            dot={false}
          />

          <Line
            yAxisId="bookings"
            type="monotone"
            dataKey="bookings"
            stroke="#D4AF37"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {!loading && !hasData && !error && (
        <p className="mt-2 text-xs text-gray-500">
          No paid bookings in the selected period.
        </p>
      )}
    </div>
  );
}
