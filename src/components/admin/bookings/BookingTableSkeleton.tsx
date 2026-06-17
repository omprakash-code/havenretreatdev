// src/components/admin/bookings/BookingTableSkeleton.tsx
"use client";

const COLUMNS = [
  { label: "#", width: "w-6" },
  { label: "Booking ID", width: "w-28" },
  { label: "Customer", width: "w-32" },
  { label: "Phone", width: "w-24" },
  { label: "Package", width: "w-24" },
  { label: "Event Date & Time", width: "w-36" },
  { label: "Amount", width: "w-16" },
  { label: "Status", width: "w-20" },
  { label: "Booking Date", width: "w-24" },
  { label: "Action", width: "w-12" },
];

type Props = {
  rows?: number;
};

export default function BookingTableSkeleton({ rows = 10 }: Props) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-x-auto overscroll-x-contain">
      <table className="min-w-[940px] w-full border-collapse">
        <thead className="bg-neutral-50 text-[#111827] text-[12px] uppercase tracking-wide">
          <tr className="h-14">
            {COLUMNS.map((column, index) => (
              <th
                key={column.label}
                className={`text-left ${index === 0 ? "pl-5 pr-3" : "px-3"}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr
              key={rowIndex}
              className="h-[60px] border-t border-neutral-100"
            >
              {COLUMNS.map((column, colIndex) => (
                <td
                  key={column.label}
                  className={colIndex === 0 ? "pl-5 pr-3" : "px-3"}
                >
                  <div
                    className={`h-3.5 ${column.width} max-w-full animate-pulse rounded bg-neutral-200`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
