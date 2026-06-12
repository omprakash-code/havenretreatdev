"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Gift } from "@/components/icons";

type Extra = {
  id: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  includedQuantity?: number | null;
  extraQuantity?: number | null;
  image?: string | null;
  numberLabel?: string | null;
  numberValue?: string | null;
};

type ExtrasShowcaseProps = {
  items: Extra[];
  embedded?: boolean;
};

export default function ExtrasShowcase({
  items,
  embedded = false,
}: ExtrasShowcaseProps) {
  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.8 }}
      className={
        embedded
          ? "space-y-3"
          : "space-y-3 border border-zinc-200 bg-white p-3 shadow-sm"
      }
    >
      <h3 className="text-base font-semibold text-[#1f2937] text-left">
        Package Inclusions & Add-ons
      </h3>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 2 + index * 0.08 }}
          >
            <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-2 border border-[#d7e4e1] bg-[#f8fbfa] p-2">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-[#edf3f1]">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.productName}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Gift size={18} className="text-[#6f8f8b]" />
                  </div>
                )}
              </div>

              <div className="min-w-0 pt-0.5">
                <div className="flex items-center gap-1.5">
                  <h4 className="min-w-0 truncate text-sm font-semibold text-slate-900">
                    {item.productName}
                  </h4>
                  {item.numberValue ? (
                    <p className="shrink-0 text-xs font-medium text-slate-700">
                      No: {item.numberValue}
                    </p>
                  ) : null}
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-1 text-xs text-slate-500">
                  <p className="min-w-0 truncate">
                    {item.variantLabel}
                  </p>
                  <span aria-hidden="true" className="shrink-0 text-[#9ab0ad]">
                    ·
                  </span>
                  <p className="shrink-0 font-medium text-zinc-600">
                    Qty {item.quantity}
                  </p>
                </div>
              </div>

              {(() => {
                const includedQty = Math.max(
                  Number(item.includedQuantity ?? 0),
                  0
                );
                const extraQty =
                  item.extraQuantity ??
                  (item.unitPrice > 0
                    ? Math.max(
                        Math.round(item.totalPrice / item.unitPrice),
                        0
                      )
                    : 0);
                const isEffectivelyIncluded =
                  extraQty === 0 && includedQty > 0;
                const isIncluded =
                  isEffectivelyIncluded || item.totalPrice <= 0;

                return isIncluded ? (
                  <span className="mt-0.5 shrink-0 border border-[#b9d8d3] bg-[#edf3f1] px-2 py-1 text-[10px] font-semibold leading-none text-[#245e5b]">
                    Included
                  </span>
                ) : (
                  <p className="mt-0.5 shrink-0 text-right text-sm font-bold leading-none text-[#1f2937]">
                    {formatCurrency(item.totalPrice)}
                  </p>
                );
              })()}
            </div>
          </motion.div>
        ))}
        </div>
    </motion.div>
  );
}
