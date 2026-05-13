"use client";

import { Pencil } from "@/components/icons";
import { formatISTDateTime } from "@/lib/formatters";
import type { AdminLocationRecord } from "@/types/admin/location";

type LocationsTableProps = {
  data: AdminLocationRecord[];
  serialStart?: number;
  onEdit: (row: AdminLocationRecord) => void;
};

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${
        isActive ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"
      }`}
    >
      {isActive ? "ACTIVE" : "INACTIVE"}
    </span>
  );
}

export default function LocationsTable({
  data,
  serialStart = 0,
  onEdit,
}: LocationsTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="min-w-[1020px] w-full border-collapse">
        <thead className="bg-neutral-50 text-left text-[12px] uppercase tracking-wide text-[#111827]">
          <tr className="h-12">
            <th className="w-14 pl-5 pr-4">#</th>
            <th className="px-4">Name</th>
            <th className="px-4">City</th>
            <th className="px-4">Status</th>
            <th className="px-4">Sort</th>
            <th className="px-4">Theatres</th>
            <th className="px-4">Products</th>
            <th className="px-4">Coupons</th>
            <th className="px-4">Updated</th>
            <th className="pl-4 pr-5">Actions</th>
          </tr>
        </thead>

        <tbody>
          {data.map((row, index) => (
            <tr
              key={row.id}
              className="border-t border-neutral-100 text-sm text-neutral-700 transition-colors hover:bg-[#F3F4F6]"
            >
              <td className="py-3 pl-5 pr-4 text-neutral-500">
                {serialStart + index + 1}
              </td>
              <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                {row.name}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{row.city}</td>
              <td className="px-4 py-3">
                <StatusBadge isActive={row.isActive} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{row.sortOrder}</td>
              <td className="px-4 py-3 whitespace-nowrap">{row.theatresCount}</td>
              <td className="px-4 py-3 whitespace-nowrap">{row.productsCount}</td>
              <td className="px-4 py-3 whitespace-nowrap">{row.couponsCount}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                {formatISTDateTime(row.updatedAt)}
              </td>
              <td className="py-3 pl-4 pr-5 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onEdit(row)}
                  title="Edit location"
                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <Pencil size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
