"use client";

import { useEffect, useRef, useState } from "react";
import { Copy } from "@/components/icons";
import type { AdminCouponFormState } from "../../types";
import { SectionCard } from "../fields";

export default function PreviewTab({
  form,
  locationName,
  endDateEnabled,
}: {
  form: AdminCouponFormState;
  locationName: string;
  endDateEnabled: boolean;
}) {
  const targetCategoryRule = form.rules.find((rule) => rule.type === "TARGET_CATEGORY");
  const targetProductRule = form.rules.find((rule) => rule.type === "TARGET_PRODUCT_ID");
  const targetCategoryCount = Array.isArray(targetCategoryRule?.value)
    ? targetCategoryRule.value.length
    : 0;
  const targetProductCount = Array.isArray(targetProductRule?.value)
    ? targetProductRule.value.length
    : 0;
  const eligibilityRuleCount = form.rules.filter(
    (rule) => !["TARGET_CATEGORY", "TARGET_PRODUCT_ID"].includes(rule.type)
  ).length;

  const previewCode = form.code.trim() || "No discount code yet";
  const scopeLabel =
    form.scope === "BOOKING_TOTAL"
      ? "Order discount"
      : form.scope === "PRODUCTS_ONLY"
      ? targetProductCount > 0
        ? `Selected products (${targetProductCount})`
        : targetCategoryCount > 0
        ? `Selected categories (${targetCategoryCount})`
        : "Product discount"
      : "Slot discount";
  const discountTypeLabel =
    form.discountType === "PERCENTAGE" ? "Percentage discount" : "Fixed amount discount";
  const discountValueLabel =
    Number(form.discountValue || 0) <= 0
      ? "No discount value yet"
      : form.discountType === "PERCENTAGE"
      ? `${Number(form.discountValue || 0)}% off`
      : `Rs ${Number(form.discountValue || 0).toLocaleString()} off`;
  const maxDiscountLabel =
    form.discountType === "PERCENTAGE" && form.maxDiscount != null
      ? `Maximum discount: Rs ${Number(form.maxDiscount).toLocaleString()}`
      : null;
  const minimumRequirement =
    form.minimumAmount == null
      ? "No minimum purchase requirement"
      : `Minimum amount: Rs ${Number(form.minimumAmount).toLocaleString()}`;
  const totalUses =
    form.usageLimit == null
      ? "No usage limits"
      : `Total usage limit: ${form.usageLimit}`;
  const perUserUses =
    form.perUserUsageLimit == null
      ? "Unlimited per customer"
      : `Per-customer limit: ${form.perUserUsageLimit}`;
  const combinationLabel = !form.isStackable
    ? "Can't combine with other coupons"
    : form.stackableCouponIds.length > 0
    ? `Can combine with ${form.stackableCouponIds.length} selected coupon${
        form.stackableCouponIds.length === 1 ? "" : "s"
      }`
    : "Can combine with other stackable coupons";
  const activeDatesLabel = buildActiveDatesSummary({
    validFrom: form.validFrom,
    validTill: form.validTill,
    endDateEnabled,
  });

  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopyCode = async () => {
    const textToCopy = previewCode.trim();
    if (!textToCopy || previewCode === "No discount code yet") return;

    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = textToCopy;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopied(true);
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopied(false);
    }, 4000);
  };

  return (
    <div className="space-y-1.5">
      <SectionCard title="Summary">
        <div className="space-y-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-base font-semibold leading-6 text-slate-900">
                  {previewCode}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => void handleCopyCode()}
                disabled={previewCode === "No discount code yet"}
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy size={12} />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div>
              <p className="text-sm font-semibold text-slate-900">Type</p>
              <p className="mt-0.5 text-sm leading-5 text-slate-700">{discountTypeLabel}</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">Details</p>
              <ul className="list-disc space-y-0.5 pl-5 text-sm leading-5 text-slate-700 marker:text-slate-500">
                <li>{discountValueLabel}</li>
                {maxDiscountLabel ? <li>{maxDiscountLabel}</li> : null}
                <li>{scopeLabel}</li>
                <li>{locationName}</li>
                <li>{minimumRequirement}</li>
                <li>{totalUses}</li>
                <li>{perUserUses}</li>
                <li>{combinationLabel}</li>
                <li>
                  {eligibilityRuleCount > 0
                    ? `${eligibilityRuleCount} restriction${eligibilityRuleCount === 1 ? "" : "s"} added`
                    : "All customers"}
                </li>
                <li>{activeDatesLabel}</li>
              </ul>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function buildActiveDatesSummary({
  validFrom,
  validTill,
  endDateEnabled,
}: {
  validFrom: string;
  validTill: string | null;
  endDateEnabled: boolean;
}) {
  const startDate = new Date(validFrom);
  const endDate = validTill ? new Date(validTill) : null;

  if (Number.isNaN(startDate.getTime())) {
    return "Active date not set";
  }

  const startLabel = toRelativeDateLabel(startDate);
  if (!endDateEnabled || !endDate || Number.isNaN(endDate.getTime())) {
    return `Active from ${startLabel}`;
  }

  return `Active from ${startLabel} until ${toRelativeDateLabel(endDate)}`;
}

function toRelativeDateLabel(date: Date) {
  const now = new Date();
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  if (sameDay) return "today";

  const dateLabel = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  return dateLabel;
}
