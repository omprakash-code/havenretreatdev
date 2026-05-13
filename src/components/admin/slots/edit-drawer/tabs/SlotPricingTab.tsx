"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { IndianRupee, RotateCcw } from "lucide-react";
import type { AdminSlot } from "@/types/admin/slot-admin";

export type SlotPricingPayload = {
  regularPrice: number;
  salePrice: number | null;
  reason: string;
};

export type SlotPricingTabMeta = {
  hasChanges: boolean;
  canSubmit: boolean;
};

export type SlotPricingTabHandle = {
  submit: (reason: string) => Promise<boolean>;
};

type SlotPricingTabProps = {
  slot: AdminSlot;
  disabled?: boolean;
  onSave: (payload: SlotPricingPayload) => Promise<void>;
  onMetaChange?: (meta: SlotPricingTabMeta) => void;
};

const SlotPricingTab = forwardRef<SlotPricingTabHandle, SlotPricingTabProps>(
  function SlotPricingTab({ slot, disabled, onSave, onMetaChange }, ref) {
    const [regularPrice, setRegularPrice] = useState<number | "">(slot.pricing.regular);
    const [salePrice, setSalePrice] = useState<number | "">(slot.pricing.sale ?? "");
    const templateRegular = slot.template?.regularPrice ?? slot.pricing.regular;
    const templateSale = slot.template?.salePrice ?? null;
    const effectiveRegularPrice = regularPrice === "" ? slot.pricing.regular : regularPrice;

    const discountAmount =
      salePrice !== "" && salePrice < effectiveRegularPrice
        ? effectiveRegularPrice - salePrice
        : 0;

    const isChanged =
      regularPrice !== slot.pricing.regular ||
      salePrice !== (slot.pricing.sale ?? "");

    const isInvalid =
      regularPrice === "" ||
      regularPrice <= 0 ||
      (salePrice !== "" && salePrice <= 0) ||
      (salePrice !== "" && salePrice >= effectiveRegularPrice);

    const canSubmit =
      !isChanged ||
      Boolean(
        !disabled &&
          !isInvalid
      );

    useEffect(() => {
      onMetaChange?.({
        hasChanges: isChanged,
        canSubmit,
      });
    }, [canSubmit, isChanged, onMetaChange]);

    useImperativeHandle(
      ref,
      () => ({
        submit: async (reason: string) => {
          if (!isChanged) return false;
          if (disabled) throw new Error("This slot cannot be modified.");
          if (isInvalid) {
            throw new Error("Enter a valid pricing override. Sale price must be lower than regular price.");
          }
          if (!reason.trim() || reason.trim().length < 10) {
            throw new Error("Reason for price override is required (minimum 10 characters).");
          }

          await onSave({
            regularPrice: Number(regularPrice),
            salePrice: salePrice === "" ? null : salePrice,
            reason: reason.trim(),
          });
          return true;
        },
      }),
      [disabled, isChanged, isInvalid, onSave, regularPrice, salePrice]
    );

    return (
      <div className="space-y-2">
        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <IndianRupee size={16} />
            Override Pricing
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500">Regular Price</label>
              <input
                type="number"
                min={1}
                disabled={disabled}
                value={regularPrice}
                placeholder={`e.g. ${templateRegular}`}
                onChange={(e) =>
                  setRegularPrice(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">Sale Price (optional)</label>
              <input
                type="number"
                min={1}
                disabled={disabled}
                value={salePrice}
                placeholder={
                  templateSale
                    ? `Enter discounted price (e.g. ${templateSale})`
                    : "Enter discounted price"
                }
                onChange={(e) =>
                  setSalePrice(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </div>
          </div>

          <div>
            {discountAmount > 0 && (
              <div className="inline-block rounded bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
                Discount applied: ₹{discountAmount.toLocaleString()}
              </div>
            )}

            {salePrice !== "" && salePrice >= effectiveRegularPrice && (
              <div className="inline-block rounded bg-red-50 px-2 py-1 text-[11px] text-red-600">
                Sale price must be lower than regular price.
              </div>
            )}
          </div>

          {isChanged && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setRegularPrice(templateRegular);
                setSalePrice(templateSale ?? "");
              }}
              className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-60"
            >
              <RotateCcw size={14} />
              Reset to template pricing
            </button>
          )}
        </div>

      </div>
    );
  }
);

export default SlotPricingTab;
