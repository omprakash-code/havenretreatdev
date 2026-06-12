"use client";

import Image from "next/image";
import { CheckCircle2, X } from "lucide-react";
import { Minus, Plus } from "@/components/icons";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import type { Product, Variant } from "./types";
import { getVariantPriceMeta } from "./price";
import type { BookingItemSnapshot } from "@/context/BookingContext";
import { useBooking } from "@/context/BookingContext";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import {
  getNumberDecorationLabel,
  isNumberDecorationProduct,
} from "@/lib/product-numbering";
import {
  getPackageIncludedProductQuantity,
  getPackageIncludedProductTotalPrice,
} from "@/lib/package-included-products";

type Props = {
  product: Product;
  selectedProducts: BookingItemSnapshot[];
};

const PACKAGE_DETAILS: Record<
  string,
  {
    includedItems: string[];
  }
> = {
  "balloon-decor-package": {
    includedItems: [
      "Up to 3 balloon colors of your choice",
      "Balloon arch design",
      "Cake cylinders/pedestals",
      "Basic setup and styling",
    ],
  },
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProductCard({
  product,
  selectedProducts,
}: Props) {
  const { booking, setBookingItems } = useBooking();
  const isNumberDecoration = isNumberDecorationProduct({
    slug: product.slug,
    name: product.name,
  });
  const numberLabel = getNumberDecorationLabel({
    slug: product.slug,
    name: product.name,
  });

  /* -----------------------------
     Normalize variants
  ------------------------------ */
  const variants: Variant[] = Array.isArray(product.variants)
    ? product.variants
    : [];

  const defaultVariant = variants.find((variant) => variant.isDefault) ?? variants[0];

  const [activeVariant, setActiveVariant] =
    useState<Variant | undefined>(defaultVariant);
  const [showLedPrompt, setShowLedPrompt] = useState(false);
  const [showPackageDetails, setShowPackageDetails] = useState(false);
  const [draftLedNumber, setDraftLedNumber] = useState("");
  const packageDetails = product.slug ? PACKAGE_DETAILS[product.slug] : undefined;

  useEffect(() => {
    if (!showPackageDetails) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowPackageDetails(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showPackageDetails]);

  /* -----------------------------
     Existing item lookup
  ------------------------------ */
  const existing = selectedProducts.find(
    (i) =>
      i.productId === product.id &&
      i.variantId === activeVariant?.id
  );

  const quantity = existing?.quantity ?? 0;
  const hasLedNumber = Boolean(existing?.ledNumber?.trim());
  const includedQuantity = getPackageIncludedProductQuantity(
    booking.package,
    product
  );
  const isPackageIncluded = includedQuantity > 0;
  /* -----------------------------
     Local-only update (NO API)
  ------------------------------ */
  const updateQuantity = (nextQty: number) => {
    if (!activeVariant) return;

    setBookingItems((prev) =>
      upsertItem({
        prev,
        product,
        variant: activeVariant,
        quantity: nextQty,
        minimumQuantity: includedQuantity,
        selectedPackage: booking.package,
      })
    );
  };

  const maxAllowed = activeVariant
    ? getVariantMaxAllowed(activeVariant)
    : 0;
  const outOfStock = maxAllowed <= 0;
  const reachedLimit = quantity >= maxAllowed && maxAllowed > 0;
  const isSingleSelect = maxAllowed === 1;

  const increment = () => {
    if (outOfStock) {
      toast.error("This item is currently out of stock.");
      return;
    }

    if (reachedLimit) {
      toast.error(
        isSingleSelect
          ? "Only one unit can be added for this add-on."
          : `You can add up to ${maxAllowed} units for this item.`
      );
      return;
    }

    updateQuantity(isSingleSelect ? 1 : quantity + 1);
  };
  const decrement = () => updateQuantity(Math.max(quantity - 1, includedQuantity));
  const toggleDecoration = () =>
    updateQuantity(quantity > includedQuantity ? includedQuantity : Math.max(1, includedQuantity));
  const handleAdd = () => {
    increment();
    if (isNumberDecoration) {
      setDraftLedNumber(existing?.ledNumber ?? "");
      setShowLedPrompt(true);
    }
  };
  const openLedPrompt = () => {
    setDraftLedNumber(existing?.ledNumber ?? "");
    setShowLedPrompt(true);
  };
  const updateLedNumber = (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 3);

    if (!existing) return;

    setBookingItems((prev) =>
      prev.map((item) =>
        item.productId === product.id && item.variantId === activeVariant?.id
          ? { ...item, ledNumber: clean || undefined }
          : item
      )
    );
  };

  if (!activeVariant) return null;
  const priceMeta = getVariantPriceMeta(activeVariant);

  /* -----------------------------
     Render
  ------------------------------ */
  return (
    <div className="flex h-full min-w-0 flex-col border border-[#2f7e7a]/25 bg-white p-2 sm:p-4 transition hover:border-[#347f7c]/45 hover:bg-[#fcfdfd]">
      <div className="relative aspect-[4/3] w-full overflow-hidden border border-[#d7e4e1] bg-[#f8fbfa]">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 280px"
          className="object-cover"
        />
      </div>

      <div className="mt-2 sm:mt-3 flex items-start justify-between gap-1.5 sm:gap-2 min-w-0">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <h4 className="min-w-0 text-xs sm:text-sm font-semibold text-gray-800 leading-snug line-clamp-2">
            {product.name}
          </h4>

          {isPackageIncluded && (
            <p className="inline-flex shrink-0 border border-[#d7e4e1] bg-[#edf3f1] px-1.5 py-0.5 text-[9px] font-semibold leading-none text-[#245e5b] sm:px-2 sm:text-[10px]">
              {includedQuantity} included
            </p>
          )}
        </div>

        {isNumberDecoration && quantity > 0 && hasLedNumber && (
          <button
            type="button"
            onClick={openLedPrompt}
            className="shrink-0 border border-[#2f7e7a]/30 bg-[#edf3f1] px-2 py-1 text-[10px] sm:text-[11px] font-semibold text-[#245e5b] hover:bg-[#e3efec] cursor-pointer"
          >
            {numberLabel}: {existing?.ledNumber}
          </button>
        )}
      </div>

      {product.description && (
        <p className="hidden text-[11px] sm:text-xs text-gray-500 mt-1 line-clamp-2">
          {product.description}
        </p>
      )}

      {packageDetails && (
        <button
          type="button"
          onClick={() => setShowPackageDetails(true)}
          className="mt-1.5 w-fit cursor-pointer text-left text-[11px] font-semibold text-[#347f7c] underline decoration-[#347f7c]/40 underline-offset-2 transition hover:text-[#245e5b] sm:text-xs"
        >
          View package details
        </button>
      )}

      {/* Variants */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2 sm:mt-3">
        {variants.map((v) => {
          const active = v.id === activeVariant.id;

          return (
            <button
              key={v.id}
              onClick={() => setActiveVariant(v)}
              disabled={variants.length === 1}
              className={`px-2 sm:px-3 py-1 text-[10px] sm:text-[11px] border transition
                ${active
                  ? "border-[#347f7c] bg-[#347f7c] text-white"
                  : "border-[#d7e4e1] text-gray-700 hover:border-[#347f7c]/40 hover:bg-[#f8fbfa]"
                }
                ${variants.length === 1 ? "cursor-default opacity-80" : ""}
              `}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Price + Controls */}
      <div className="mt-auto pt-2 sm:pt-3 grid grid-cols-[1fr_auto] items-end gap-1.5 sm:gap-2">
        <div>
          <p className="text-[10px] sm:text-xs text-gray-500">Price</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <p className="text-[15px] sm:text-lg font-bold text-gray-900 leading-none">
              {formatCurrency(priceMeta.displayPrice)}
            </p>
            {priceMeta.hasDiscount && (
              <>
                <p className="text-[10px] sm:text-xs text-gray-400 line-through leading-none">
                  {formatCurrency(priceMeta.regularPrice)}
                </p>
                <span className="bg-[#edf3f1] px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold text-[#245e5b] leading-none">
                  {priceMeta.savingsPercent}% OFF
                </span>
              </>
            )}
          </div>
          {outOfStock ? (
            <p className="mt-1 text-[10px] sm:text-xs text-gray-500">Out of stock</p>
          ) : null}
        </div>

        <div className="relative h-8 sm:h-9 w-[74px] sm:w-[88px] shrink-0">
          <AnimatePresence initial={false}>
            {quantity === 0 ? (
              <motion.button
                key="add"
                type="button"
                onClick={handleAdd}
                title="Add item"
                aria-label="Add item"
                disabled={outOfStock}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className="absolute inset-0 flex h-full w-full items-center justify-center gap-0.5 border border-[#347f7c] bg-[#347f7c] text-xs font-semibold text-white cursor-pointer select-none transition hover:bg-[#245e5b] disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-300 disabled:text-gray-600"
              >
                <Plus size={12} />
                {outOfStock ? "Out" : "Add"}
              </motion.button>
            ) : isSingleSelect ? (
              <motion.button
                key="added"
                type="button"
                onClick={toggleDecoration}
                title={isPackageIncluded ? "Included with package" : "Remove item"}
                aria-label={isPackageIncluded ? "Included with package" : "Remove item"}
                disabled={outOfStock && quantity === 0}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="absolute inset-0 flex h-full w-full items-center justify-center gap-0.5 border border-[#2f7e7a]/25 bg-[#edf3f1] text-xs font-semibold text-[#245e5b] cursor-pointer select-none transition-colors hover:bg-[#e3efec] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
              >
                <CheckCircle2 size={12} className="text-[#347f7c]" />
                {isPackageIncluded ? "Included" : "Added"}
              </motion.button>
            ) : (
              <motion.div
                key="qty"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="absolute inset-0 flex h-full w-full items-center justify-between border border-[#d7e4e1] bg-[#f8fbfa] px-0.5"
              >
                <button
                  type="button"
                  onClick={decrement}
                  title="Decrease quantity"
                  aria-label="Decrease quantity"
                  disabled={quantity <= includedQuantity}
                  className="flex aspect-square h-5 w-5 items-center justify-center border border-[#d7e4e1] bg-white leading-none cursor-pointer text-[#245e5b] hover:bg-[#edf3f1] active:scale-[0.97] transition disabled:cursor-not-allowed disabled:opacity-40 sm:h-6 sm:w-6"
                >
                  <Minus size={10} />
                </button>

                <span className="font-semibold text-[11px] sm:text-xs select-none leading-none">
                  {quantity}
                </span>

                <button
                  type="button"
                  onClick={increment}
                  title="Increase quantity"
                  aria-label="Increase quantity"
                  disabled={outOfStock || reachedLimit}
                  className="flex aspect-square h-5 w-5 items-center justify-center border border-[#d7e4e1] bg-white leading-none cursor-pointer text-[#245e5b] hover:bg-[#edf3f1] active:scale-[0.97] transition disabled:cursor-not-allowed disabled:opacity-40 sm:h-6 sm:w-6"
                >
                  <Plus size={11} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showPackageDetails && packageDetails && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-end bg-black/45 sm:items-center sm:justify-center sm:px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`package-details-${product.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setShowPackageDetails(false);
              }
            }}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="w-full rounded-t-2xl border border-[#2f7e7a]/20 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl sm:max-w-md sm:rounded-none sm:p-6"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-300 sm:hidden" />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3
                    id={`package-details-${product.id}`}
                    className="text-lg font-bold text-gray-900"
                  >
                    {product.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Our balloon décor packages start at{" "}
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(priceMeta.displayPrice)}
                    </span>{" "}
                    and include:
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPackageDetails(false)}
                  aria-label="Close package details"
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border border-[#d7e4e1] text-gray-500 transition hover:bg-[#edf3f1] hover:text-[#245e5b]"
                >
                  <X size={17} />
                </button>
              </div>

              <ul className="mt-5 space-y-3">
                {packageDetails.includedItems.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-sm leading-5 text-gray-700"
                  >
                    <CheckCircle2
                      size={17}
                      className="mt-0.5 shrink-0 text-[#347f7c]"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => setShowPackageDetails(false)}
                className="mt-6 w-full cursor-pointer border border-[#347f7c] bg-[#347f7c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#245e5b]"
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLedPrompt && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-sm border border-[#2f7e7a]/25 bg-white p-4 shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {numberLabel}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Add age/number for this add-on.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLedPrompt(false)}
                  className="text-gray-400 hover:text-[#245e5b] cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                value={draftLedNumber}
                onChange={(e) =>
                  setDraftLedNumber(e.target.value.replace(/\D/g, "").slice(0, 3))
                }
                placeholder="e.g. 25"
                className="mt-3 w-full border border-[#d7e4e1] bg-[#fcfdfd] px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#347f7c] focus:ring-2 focus:ring-[#347f7c]/10"
              />

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    updateLedNumber(draftLedNumber);
                    setShowLedPrompt(false);
                  }}
                  className="border border-[#347f7c] bg-[#347f7c] px-3 py-2 text-xs font-semibold text-white hover:bg-[#245e5b] cursor-pointer"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -----------------------------
   Pure helper (SAFE)
------------------------------ */
function upsertItem({
  prev,
  product,
  variant,
  quantity,
  minimumQuantity = 0,
  selectedPackage,
}: {
  prev: BookingItemSnapshot[];
  product: Product;
  variant: Variant;
  quantity: number;
  minimumQuantity?: number;
  selectedPackage?: { name?: string | null; capacity?: number | null } | null;
}): BookingItemSnapshot[] {
  const items = [...prev];
  const priceMeta = getVariantPriceMeta(variant);
  const unitPrice = priceMeta.displayPrice;
  const resolvedQuantity = Math.max(quantity, minimumQuantity);

  const index = items.findIndex(
    (i) =>
      i.productId === product.id &&
      i.variantId === variant.id
  );

  if (resolvedQuantity === 0) {
    if (index !== -1) items.splice(index, 1);
    return items;
  }

  const totalPrice = getPackageIncludedProductTotalPrice({
    source: selectedPackage,
    product,
    quantity: resolvedQuantity,
    unitPrice,
  });

  if (index !== -1) {
    items[index] = {
      ...items[index],
      quantity: resolvedQuantity,
      unitPrice,
      totalPrice,
    };
  } else {
    items.push({
      id: nanoid(), // temp UI id
      productId: product.id,
      variantId: variant.id,
      productName: product.name,
      productImage: product.image,
      productSlug: product.slug,
      variantLabel: variant.label,
      category: product.category,
      unitPrice,
      quantity: resolvedQuantity,
      totalPrice,
    });
  }

  return items;
}

function getVariantMaxAllowed(
  variant: Variant
): number {
  const stockCap = Math.max(Number(variant.stock ?? 0), 0);
  if (stockCap <= 0) return 0;
  return stockCap;
}
