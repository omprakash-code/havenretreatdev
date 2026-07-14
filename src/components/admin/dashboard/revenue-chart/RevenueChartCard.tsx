"use client";

import { useState } from "react";
import RevenueBookingChart from "./RevenueBookingChart";

export default function RevenueChartCard() {
  const [range, setRange] = useState<
    "today" | "7d" | "30d" | "90d" | "1y"
  >("7d");

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-3 sm:p-4 lg:p-6">
      <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div>
          <h3 className="text-base font-semibold leading-tight text-gray-900 sm:text-lg">
            Revenue & Booking Trends
          </h3>
          <p className="mt-0.5 text-sm leading-snug text-gray-500">
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
          className="w-36 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:outline-none sm:w-auto"
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
