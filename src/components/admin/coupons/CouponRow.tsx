"use client";

import { Eye, Pencil, Trash } from "@/components/icons";
import { formatIST } from "@/lib/formatters";
import type { AdminCouponListItem } from "./coupon-list.types";

type Props = {
  srNo: number;
  coupon: AdminCouponListItem;
  onEdit?: (coupon: AdminCouponListItem) => void;
  onView?: (coupon: AdminCouponListItem) => void;
  onDelete?: (coupon: AdminCouponListItem) => void;
};

const SCOPE_LABEL: Record<AdminCouponListItem["scope"], string> = {
  BOOKING_TOTAL: "Booking Total",
  PRODUCTS_ONLY: "Products Only",
  SLOT_ONLY: "Slot Only",
};

export default function CouponRow({ srNo, coupon, onEdit, onView, onDelete }: Props) {
  return (
    <tr className="border-t border-neutral-200 text-[13px] text-neutral-800 transition-colors hover:bg-[#F3F4F6]">
      <td className="px-4 py-4 whitespace-nowrap text-neutral-500">{srNo}</td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="inline-flex rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 font-semibold tracking-wide text-neutral-800">
          {coupon.code}
        </div>
      </td>

      <td className="px-4 whitespace-nowrap font-semibold text-neutral-900">
        {formatDiscount(coupon)}
      </td>

      <td className="whitespace-nowrap">{SCOPE_LABEL[coupon.scope]}</td>

      <td className="whitespace-nowrap leading-tight">
        <div>{formatIST(coupon.validFrom).split(",")[0]}</div>
        <div className="text-xs text-neutral-500">
          {coupon.validTill
            ? `till ${formatIST(coupon.validTill).split(",")[0]}`
            : "No expiry"}
        </div>
      </td>

      <td className="whitespace-nowrap">
        <span className="font-medium">{coupon.confirmedUsageCount}</span>
        <span className="text-neutral-500"> / {coupon.usageLimit ?? "Unlimited"}</span>
      </td>

      <td className="whitespace-nowrap">
        <StatusBadge
          variant={coupon.isStackable ? "success" : "default"}
          label={getStackableLabel(coupon)}
        />
      </td>

      <td className="whitespace-nowrap">
        <StatusBadge
          variant={coupon.isActive ? "success" : "default"}
          label={coupon.isActive ? "Active" : "Inactive"}
        />
      </td>

      <td className="text-neutral-500 leading-tight whitespace-nowrap">
        <div>{formatIST(coupon.updatedAt).split(",")[0]}</div>
        <div className="text-xs">{formatIST(coupon.updatedAt).split(",")[1]}</div>
      </td>

      <td className="whitespace-nowrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onView?.(coupon)}
            title="View coupon"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <Eye size={15} />
          </button>
          <button
            type="button"
            onClick={() => onEdit?.(coupon)}
            title="Edit coupon"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-700"
          >
            <Pencil size={15} />
          </button>
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(coupon)}
              title="Delete coupon"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-red-600 transition hover:bg-red-50 hover:text-red-700"
            >
              <Trash size={15} />
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function formatDiscount(coupon: AdminCouponListItem) {
  if (coupon.discountType === "FLAT") {
    return `Rs ${coupon.discountValue} OFF`;
  }

  const cap = coupon.maxDiscount ? ` (max Rs ${coupon.maxDiscount})` : "";
  return `${coupon.discountValue}% OFF${cap}`;
}

function getStackableLabel(coupon: AdminCouponListItem) {
  if (!coupon.isStackable) {
    return "No";
  }

  const selectedCount = coupon.stackableCouponIds?.length ?? 0;
  if (selectedCount > 0) {
    return `Limited (${selectedCount})`;
  }

  return "All";
}

function StatusBadge({
  label,
  variant,
}: {
  label: string;
  variant: "success" | "default";
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium",
        variant === "success"
          ? "bg-emerald-50 text-emerald-800"
          : "bg-slate-100 text-slate-700",
      ].join(" ")}
    >
      {label}
    </span>
  );
}
