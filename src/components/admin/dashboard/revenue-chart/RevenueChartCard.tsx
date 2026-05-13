"use client";

import { useState } from "react";
import RevenueBookingChart from "./RevenueBookingChart";

export default function RevenueChartCard() {
  const [range, setRange] = useState<
    "today" | "7d" | "30d" | "90d" | "1y"
  >("7d");

  return (
    <div className="mt-4 lg:mt-6 rounded-2xl bg-white border border-gray-100 shadow-sm p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Revenue & Booking Trends
          </h3>
          <p className="text-sm text-gray-500">
            Performance across selected period
          </p>
        </div>

        <select
          value={range}
          onChange={(e) =>
            setRange(
              e.target.value as "today" | "7d" | "30d" | "90d" | "1y"
            )
          }
          className="w-full sm:w-auto rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:outline-none"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="1y">Last 1 year</option>
          <option value="today">Today</option>
        </select>
      </div>

      <RevenueBookingChart range={range} />
    </div>
  );
}
