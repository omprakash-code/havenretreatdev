"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Gift } from "@/components/icons";

type Extra = {
  id: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  totalPrice: number;
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
      <h3 className="text-base font-semibold text-slate-900 text-left">Selected Add-ons</h3>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 2 + index * 0.08 }}
          >
            <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 p-2 hover:border-zinc-300 transition-colors">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-slate-100">
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
                    <Gift size={18} className="text-slate-400" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
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
                <div className="mt-0.5 flex items-center gap-px">
                  <p className="max-w-[calc(100%-3rem)] text-xs text-slate-500 truncate">
                    {item.variantLabel}
                  </p>
                  <p className="shrink-0 text-xs font-medium text-zinc-600">
                    x{item.quantity}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-zinc-900/60">
                  {formatCurrency(item.totalPrice)}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
        </div>
    </motion.div>
  );
}
