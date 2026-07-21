"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const CHART_NEUTRAL = "#94a3b8";
const BRAND_TEAL = "#347f7c";

function formatCompactCurrency(value: number) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${Math.round(value)}`;
}

export default function RevenueBookingsChart({ range }: Props) {
  const [rows, setRows] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState({ revenue: 0, bookings: 0 });
  const chartHostRef = useRef<HTMLDivElement | null>(null);
  const [chartReady, setChartReady] = useState(false);

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

  useEffect(() => {
    const chartHost = chartHostRef.current;
    if (!chartHost) return;

    const updateChartReady = () => {
      const rect = chartHost.getBoundingClientRect();
      setChartReady(rect.width > 0 && rect.height > 0);
    };

    updateChartReady();
    const observer = new ResizeObserver(updateChartReady);
    observer.observe(chartHost);
    return () => observer.disconnect();
  }, []);

  const hasData = useMemo(
    () => rows.some((row) => row.revenue > 0 || row.bookings > 0),
    [rows]
  );

  return (
    <div className="h-[285px] min-w-0 w-full rounded-2xl bg-white p-3 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:h-[350px] sm:p-5">
      {/* Summary */}
      <div className="mb-2 flex items-center gap-6 sm:mb-4">
        <div>
          <p className="text-xs text-gray-500">
            Revenue
          </p>
          <p className="text-base font-semibold text-gray-900 sm:text-lg">
            ${totals.revenue.toLocaleString()}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500">
            Bookings
          </p>
          <p className="text-base font-semibold text-gray-900 sm:text-lg">
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
      <div
        ref={chartHostRef}
        className="h-[210px] min-h-[210px] min-w-0 w-full sm:h-[220px] sm:min-h-[220px]"
      >
        {chartReady && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={rows} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
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
                  return [`$${Number(value).toLocaleString()}`, "Revenue"];
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
              stroke={CHART_NEUTRAL}
              strokeWidth={2}
              dot={false}
            />

            <Line
              yAxisId="bookings"
              type="monotone"
              dataKey="bookings"
              stroke={BRAND_TEAL}
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {!loading && !hasData && !error && (
        <p className="mt-2 text-xs text-gray-500">
          No paid bookings in the selected period.
        </p>
      )}
    </div>
  );
}
