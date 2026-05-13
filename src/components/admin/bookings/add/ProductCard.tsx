import Image from "next/image";
import { memo } from "react";
import { CheckCircle2, Minus, Plus } from "lucide-react";

import {
  getVariantPrice,
  inputClass,
  isLedNumberProduct,
  type ProductLineSelection,
  type ProductOption,
} from "@/components/admin/bookings/add/shared";
import { getNumberDecorationKind, getNumberDecorationLabel } from "@/lib/product-numbering";

type ProductCardProps = {
  product: ProductOption;
  activeVariantId: string;
  selection: ProductLineSelection;
  ledDraft: string;
  onVariantChange: (variantId: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onToggleDecoration: () => void;
  onLedNumberDraftChange: (value: string) => void;
  onLedNumberSubmit: (value: string) => void;
};

function ProductCardComponent({
  product,
  activeVariantId,
  selection,
  ledDraft,
  onVariantChange,
  onIncrement,
  onDecrement,
  onToggleDecoration,
  onLedNumberDraftChange,
  onLedNumberSubmit,
}: ProductCardProps) {
  const isDecoration = product.category === "DECORATION";
  const isLed = isLedNumberProduct(product);
  const numberKind = getNumberDecorationKind({
    slug: product.slug,
    name: product.name,
  });
  const numberLabel = getNumberDecorationLabel({
    slug: product.slug,
    name: product.name,
  });
  const numberShortLabel =
    numberKind === "LED_NUMBER"
      ? "LED No"
      : numberKind === "BALLOON_TOWER_NUMBER"
        ? "Tower No"
        : "No";
  const showDecorationNumber = isDecoration && Boolean(selection.ledNumber) && Boolean(numberKind);
  const activeVariant =
    product.variants.find((variant) => variant.id === activeVariantId) ??
    product.variants[0];
  const quantity = selection.quantity;

  if (!activeVariant) return null;
  const stockAvailable = Math.max(Number(activeVariant.stock ?? 0), 0);
  const maxAllowed = isDecoration
    ? Math.min(stockAvailable, 1)
    : stockAvailable;
  const outOfStock = maxAllowed <= 0;
  const reachedLimit = quantity >= maxAllowed && maxAllowed > 0;

  return (
    <article className="h-full rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className="grid grid-cols-[70px_minmax(0,1fr)] gap-x-2.5 sm:grid-cols-[70px_minmax(0,1fr)]">
        <div className="relative aspect-square h-[70px] w-[70px] shrink-0 self-start overflow-hidden rounded-lg border border-slate-200 bg-slate-100 sm:h-18 sm:w-18">
          {product.image ? (
            <Image src={product.image} alt={product.name} fill className="object-cover" />
          ) : null}
        </div>

        <div className="col-start-2 min-w-0 self-stretch">
          <div className="grid h-full grid-rows-[auto_auto] gap-y-0">
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-[12px] font-semibold leading-tight text-slate-900 sm:text-[13px]">
                  {product.name}
                </p>
                <div className="shrink-0 pt-0.5 text-right">
                  <div className="flex items-center gap-2">
                    {showDecorationNumber ? (
                      <p className="text-[10px] leading-none text-slate-500">
                        {numberShortLabel}: {selection.ledNumber}
                      </p>
                    ) : null}
                    <p className="text-[11px] leading-none text-slate-500">S: {stockAvailable}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {product.variants.map((variant) => {
                  const active = variant.id === activeVariant.id;
                  return (
                    <label
                      key={variant.id}
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name={`variant-${product.id}`}
                        value={variant.id}
                        checked={active}
                        onChange={() => onVariantChange(variant.id)}
                      />
                      {variant.label}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-end justify-between gap-2">
              <p className="text-[12px] font-bold text-slate-900 sm:text-[13px]">
                ₹{getVariantPrice(activeVariant)}
              </p>

              <div className="w-[70px] min-w-[70px] max-w-[70px] shrink-0">
                {isDecoration ? (
                  <button
                    type="button"
                    onClick={onToggleDecoration}
                    disabled={outOfStock && quantity === 0}
                    className={`inline-flex h-7 w-full whitespace-nowrap items-center justify-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition ${
                      quantity > 0
                        ? "border-slate-300 bg-gray-100 text-slate-800"
                        : "border-slate-900 bg-slate-900 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
                    }`}
                  >
                    {quantity > 0 ? (
                      <>
                        <CheckCircle2 size={13} />
                        Added
                      </>
                    ) : (
                      <>
                        <Plus size={13} />
                        Add
                      </>
                    )}
                  </button>
                ) : quantity > 0 ? (
                  <div className="flex h-7 w-full items-center justify-between rounded-full border border-slate-300 bg-white px-1">
                    <button
                      type="button"
                      onClick={onDecrement}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="min-w-[16px] text-center text-[12px] font-semibold text-slate-900">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={onIncrement}
                      disabled={outOfStock || reachedLimit}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onIncrement}
                    disabled={outOfStock}
                    className="inline-flex h-7 w-full whitespace-nowrap items-center justify-center gap-1 rounded-full border border-slate-900 bg-slate-900 px-2.5 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
                  >
                    <Plus size={13} />
                    {outOfStock ? "Out" : "Add"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLed && quantity > 0 && !selection.ledNumber ? (
        <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <label className="mb-1.5 block text-xs font-medium text-slate-700">{numberLabel}</label>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <input
              value={ledDraft}
              onChange={(event) => onLedNumberDraftChange(event.target.value)}
              inputMode="numeric"
              maxLength={3}
              className={inputClass}
              placeholder="e.g. 25"
            />
              <button
                type="button"
                onClick={() => onLedNumberSubmit(ledDraft)}
                disabled={!ledDraft.trim()}
                className="h-11 rounded-md border border-slate-900 bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 sm:h-10"
              >
                Add
              </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function areProductCardPropsEqual(prev: ProductCardProps, next: ProductCardProps) {
  return (
    prev.product === next.product &&
    prev.activeVariantId === next.activeVariantId &&
    prev.selection === next.selection &&
    prev.ledDraft === next.ledDraft
  );
}

export const ProductCard = memo(ProductCardComponent, areProductCardPropsEqual);
