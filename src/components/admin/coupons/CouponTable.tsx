"use client";

import type { AdminCouponListItem, CouponActivityFilter } from "./coupon-list.types";
import CouponRow from "./CouponRow";

type Props = {
  data: AdminCouponListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit?: (coupon: AdminCouponListItem) => void;
  onView?: (coupon: AdminCouponListItem) => void;
  onDelete?: (coupon: AdminCouponListItem) => void;
};

export default function CouponTable({
  data,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onEdit,
  onView,
  onDelete,
}: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse">
          <thead className="bg-neutral-50 text-[12px] uppercase tracking-wide text-[#111827]">
            <tr className="h-14">
              <th className="px-4 text-left">#</th>
              <th className="px-4 text-left">Code</th>
              <th className="px-4 text-left">Discount</th>
              <th className="text-left">Scope</th>
              <th className="text-left">Validity</th>
              <th className="text-left">Usage</th>
              <th className="text-left">Stackable</th>
              <th className="text-left">Active</th>
              <th className="text-left">Updated</th>
              <th className="text-left">Action</th>
            </tr>
          </thead>

          <tbody>
            {data.map((coupon, index) => (
              <CouponRow
                key={coupon.id}
                srNo={(page - 1) * pageSize + index + 1}
                coupon={coupon}
                onEdit={onEdit}
                onView={onView}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3 text-sm">
          <span className="text-neutral-500">
            Page {page} of {totalPages} ({totalCount} coupons)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
              className="cursor-pointer rounded-md border border-neutral-200 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => onPageChange(page + 1)}
              className="cursor-pointer rounded-md border border-neutral-200 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function getCouponActivity(
  validFrom: string,
  validTill: string | null,
  now = new Date()
): CouponActivityFilter {
  const start = new Date(validFrom);

  if (now < start) return "UPCOMING";
  if (validTill) {
    const end = new Date(validTill);
    if (now > end) return "EXPIRED";
  }
  return "LIVE";
}
