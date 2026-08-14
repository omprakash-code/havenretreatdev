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
  canDecreaseProductQuantity,
  getPackageIncludedProductQuantity,
  priceIncludedProductLine,
} from "@/lib/package-included-products";
import {
  getDurationAdjustedUnitPrice,
  getDurationPricingBreakdown,
} from "@/lib/product-duration-pricing";
import { getVariantMaxAllowed } from "@/lib/product-stock";

type Props = {
  product: Product;
  selectedProducts: BookingItemSnapshot[];
};

const PACKAGE_DETAILS: Record<
  string,
  (variantLabel: string) => {
    introBefore: string;
    introAfter: string;
    includedItems: string[];
  }
> = {
  "balloon-decor-package": () => ({
    introBefore: "Our balloon décor packages start at ",
    introAfter: " and include:",
    includedItems: [
      "Up to 3 balloon colors of your choice",
      "Balloon arch design",
      "Cake cylinders/pedestals",
      "Basic setup and styling",
    ],
  }),
  "photo-booth": (variantLabel) => ({
    introBefore: `The ${variantLabel} package is `,
    introAfter: " per setup and includes:",
    includedItems:
      variantLabel === "Classic"
        ? [
            "Digital Sharing",
            "Fun Props",
            "Online Gallery",
            "Setup & Takedown",
            "No Attendant Present",
          ]
        : [
            "Digital Sharing",
            "Fun Props",
            "Online Gallery",
            "Setup & Takedown",
            "Small Garland Included",
            "Custom Design on Backdrop",
            "Pictures Throughout the Event (at least the first 3 hours)",
          ],
  }),
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
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
  const [showPricingDetails, setShowPricingDetails] = useState(false);
  const [draftLedNumber, setDraftLedNumber] = useState("");
  const packageDetails =
    product.slug && activeVariant
      ? PACKAGE_DETAILS[product.slug]?.(activeVariant.label)
      : undefined;

  const anyDetailsOpen = showPackageDetails || showPricingDetails;

  useEffect(() => {
    if (!anyDetailsOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowPackageDetails(false);
        setShowPricingDetails(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [anyDetailsOpen]);

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
  // Prefer the allowance snapshot carried on the line; fall back to package
  // config for a product the customer has not touched yet in this session, and
  // for sessions started before allowances were snapshotted (those hydrate as 0,
  // which `??` would not fall through on).
  const includedQuantity =
    existing?.includedQuantity ||
    getPackageIncludedProductQuantity(booking.package, product);
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
        includedQuantity,
        includedUnitPrice: existing?.includedUnitPrice,
        durationHours: booking.durationHours,
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
  // Included quantities are reducible: the package price drops by the removed
  // quantity, so the floor is 0 rather than the package's included count.
  const decrement = () => updateQuantity(Math.max(quantity - 1, 0));
  const toggleDecoration = () => updateQuantity(quantity > 0 ? 0 : 1);
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
  // Duration-priced add-ons (e.g. Bartender) scale with the booked hours.
  const durationPricing = getDurationPricingBreakdown({
    product,
    baseUnitPrice: priceMeta.displayPrice,
    durationHours: booking.durationHours,
  });
  const displayPrice = durationPricing?.unitPrice ?? priceMeta.displayPrice;

  /* -----------------------------
     Render
  ------------------------------ */
  return (
    <div className="flex h-full min-w-0 flex-col bg-gray-50 p-3 ring-1 ring-gray-900/[0.04] transition-shadow hover:shadow-[0_2px_16px_rgba(0,0,0,0.06)] sm:p-4">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 280px"
          className="object-cover"
        />
      </div>

      <div className="mt-2.5 sm:mt-3.5 flex items-start justify-between gap-1.5 sm:gap-2 min-w-0">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <h4 className="min-w-0 text-[13px] sm:text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
            {product.name}
          </h4>

          {isPackageIncluded && (
            <p className="inline-flex shrink-0 items-center bg-gray-200/70 px-2 py-0.5 text-[9px] font-medium leading-none text-gray-600 sm:text-[10px]">
              {includedQuantity} included
            </p>
          )}
        </div>

        {isNumberDecoration && quantity > 0 && hasLedNumber && (
          <button
            type="button"
            onClick={openLedPrompt}
            className="shrink-0 bg-white px-2.5 py-1 text-[10px] sm:text-[11px] font-medium text-gray-700 ring-1 ring-gray-200 transition hover:bg-gray-100 cursor-pointer"
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
          className="mt-1.5 w-fit cursor-pointer text-left text-[11px] font-medium text-[#347f7c] underline-offset-2 transition hover:text-[#245e5b] hover:underline sm:text-xs"
        >
          {variants.length > 1
            ? `View ${activeVariant.label} package details`
            : "View package details"}
        </button>
      )}

      {durationPricing && (
        <button
          type="button"
          onClick={() => setShowPricingDetails(true)}
          className="mt-1.5 w-fit cursor-pointer text-left text-[11px] font-medium text-[#347f7c] underline-offset-2 transition hover:text-[#245e5b] hover:underline sm:text-xs"
        >
          View pricing details
        </button>
      )}

      {/* Variants (selector only shown when there is a real choice) */}
      {variants.length > 1 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 sm:mt-3">
          {variants.map((v) => {
            const active = v.id === activeVariant.id;

            return (
              <button
                key={v.id}
                onClick={() => setActiveVariant(v)}
                className={`cursor-pointer px-3 py-1 text-[10px] sm:text-[11px] font-medium transition
                  ${active
                    ? "bg-[#347f7c] text-white"
                    : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
                  }
                `}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Price + Controls */}
      <div className="mt-auto pt-3 sm:pt-4 grid grid-cols-[1fr_auto] items-end gap-1.5 sm:gap-2">
        <div>
          <div className="flex flex-wrap items-baseline gap-1.5">
            <p className="text-base sm:text-xl font-semibold tracking-tight text-gray-900 leading-none">
              {formatCurrency(displayPrice)}
            </p>
            {priceMeta.hasDiscount && (
              <>
                <p className="text-[10px] sm:text-xs text-gray-400 line-through leading-none">
                  {formatCurrency(priceMeta.regularPrice)}
                </p>
                <span className="bg-emerald-50 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold text-emerald-700 leading-none">
                  {priceMeta.savingsPercent}% OFF
                </span>
              </>
            )}
          </div>
          <p className="mt-1 text-[10px] sm:text-[11px] text-gray-500">
            {outOfStock
              ? "Out of stock"
              : isSingleSelect
                ? "One per event"
                : activeVariant.label}
          </p>
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
                className="absolute inset-0 flex h-full w-full items-center justify-center gap-1 bg-[#347f7c] text-[13px] font-semibold text-white cursor-pointer select-none transition hover:bg-[#245e5b] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
              >
                <Plus size={15} />
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
                className="absolute inset-0 flex h-full w-full items-center justify-center bg-[#347f7c]/10 text-[13px] font-semibold text-[#245e5b] cursor-pointer select-none transition-colors hover:bg-[#347f7c]/15 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
              >
                {isPackageIncluded ? "Included" : "Added"}
              </motion.button>
            ) : (
              <motion.div
                key="qty"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="absolute inset-0 flex h-full w-full items-center justify-between bg-white px-1.5 ring-1 ring-gray-200"
              >
                <button
                  type="button"
                  onClick={decrement}
                  title="Decrease quantity"
                  aria-label="Decrease quantity"
                  disabled={!canDecreaseProductQuantity(quantity)}
                  className="flex h-[18px] w-[18px] items-center justify-center bg-gray-100 leading-none cursor-pointer text-gray-700 hover:bg-gray-200 active:scale-95 transition disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:opacity-100"
                >
                  <Minus size={10} />
                </button>

                <span className="font-semibold text-[11px] sm:text-xs text-gray-900 select-none leading-none">
                  {quantity}
                </span>

                <button
                  type="button"
                  onClick={increment}
                  title="Increase quantity"
                  aria-label="Increase quantity"
                  disabled={outOfStock || reachedLimit}
                  className="flex h-[18px] w-[18px] items-center justify-center bg-gray-100 leading-none cursor-pointer text-gray-700 hover:bg-gray-200 active:scale-95 transition disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:opacity-100"
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
              className="w-full bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl sm:max-w-md sm:p-6"
            >
              <div className="mx-auto mb-4 h-1 w-10 bg-gray-300 sm:hidden" />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3
                    id={`package-details-${product.id}`}
                    className="text-lg font-bold text-gray-900"
                  >
                    {product.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {packageDetails.introBefore}
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(displayPrice)}
                    </span>
                    {packageDetails.introAfter}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPackageDetails(false)}
                  aria-label="Close package details"
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
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
                className="mt-6 w-full cursor-pointer bg-[#347f7c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#245e5b]"
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPricingDetails && durationPricing && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-end bg-black/45 sm:items-center sm:justify-center sm:px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`pricing-details-${product.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setShowPricingDetails(false);
              }
            }}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="w-full bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl sm:max-w-md sm:p-6"
            >
              <div className="mx-auto mb-4 h-1 w-10 bg-gray-300 sm:hidden" />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3
                    id={`pricing-details-${product.id}`}
                    className="text-lg font-bold text-gray-900"
                  >
                    {product.name} Service
                  </h3>
                  {product.description && (
                    <p className="mt-1 text-sm text-gray-600">
                      {product.description}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowPricingDetails(false)}
                  aria-label="Close pricing details"
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <X size={17} />
                </button>
              </div>

              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Included
              </p>
              <ul className="mt-2 space-y-2">
                {[
                  `Professional ${product.name.toLowerCase()}`,
                  `Up to ${durationPricing.includedHours} hours of service`,
                ].map((item) => (
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

              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Pricing
              </p>
              <dl className="mt-2 space-y-2 text-sm text-gray-700">
                <div className="flex items-center justify-between gap-3">
                  <dt>Base price</dt>
                  <dd className="font-medium text-gray-900">
                    {formatCurrency(durationPricing.baseUnitPrice)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Additional time</dt>
                  <dd className="font-medium text-gray-900">
                    {formatCurrency(durationPricing.extraHourlyRate)}/hour
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Current booking duration</dt>
                  <dd className="font-medium text-gray-900">
                    {durationPricing.bookedHours} hours
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-black/10 pt-2">
                  <dt className="font-semibold text-gray-900">Current price</dt>
                  <dd className="font-bold text-gray-900">
                    {formatCurrency(durationPricing.unitPrice)}
                  </dd>
                </div>
              </dl>

              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Notes
              </p>
              <p className="mt-2 text-sm leading-5 text-gray-600">
                Pricing updates automatically based on your selected booking
                duration.
              </p>

              <button
                type="button"
                onClick={() => setShowPricingDetails(false)}
                className="mt-6 w-full cursor-pointer bg-[#347f7c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#245e5b]"
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
  includedQuantity = 0,
  includedUnitPrice,
  durationHours,
}: {
  prev: BookingItemSnapshot[];
  product: Product;
  variant: Variant;
  quantity: number;
  includedQuantity?: number;
  includedUnitPrice?: number;
  durationHours?: number | null;
}): BookingItemSnapshot[] {
  const priceMeta = getVariantPriceMeta(variant);
  const unitPrice = getDurationAdjustedUnitPrice({
    product,
    baseUnitPrice: priceMeta.displayPrice,
    durationHours,
  });
  // No clamping to the included quantity: reductions are the point of the
  // feature. The package price drops instead of the quantity being pushed back.
  const resolvedQuantity = Math.max(quantity, 0);
  // The snapshot rate is authoritative once the server has issued one; a
  // brand-new local line falls back to the live variant price, which the server
  // reconciles against the real snapshot on commit.
  const resolvedIncludedUnitPrice =
    typeof includedUnitPrice === "number" && includedUnitPrice > 0
      ? includedUnitPrice
      : priceMeta.displayPrice;
  const linePricing = priceIncludedProductLine({
    includedQuantity,
    includedUnitPrice: resolvedIncludedUnitPrice,
    quantity: resolvedQuantity,
    unitPrice,
  });

  // Single-select variants are exclusive package choices (e.g. Photo Booth
  // Premium vs Classic): adding one replaces any other variant of the product.
  const items =
    resolvedQuantity > 0 && getVariantMaxAllowed(variant) === 1
      ? prev.filter(
          (item) =>
            item.productId !== product.id || item.variantId === variant.id
        )
      : [...prev];

  const index = items.findIndex(
    (i) =>
      i.productId === product.id &&
      i.variantId === variant.id
  );

  // A line with a package allowance is kept at quantity 0 rather than removed:
  // the row is the only record that the customer reduced it to nothing, and it
  // is what stops seeding from re-adding the full included quantity.
  if (resolvedQuantity === 0 && includedQuantity <= 0) {
    if (index !== -1) items.splice(index, 1);
    return items;
  }

  const totalPrice = linePricing.totalPrice;

  if (index !== -1) {
    items[index] = {
      ...items[index],
      quantity: resolvedQuantity,
      unitPrice,
      baseUnitPrice: priceMeta.displayPrice,
      totalPrice,
      includedQuantity,
      includedUnitPrice: resolvedIncludedUnitPrice,
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
      baseUnitPrice: priceMeta.displayPrice,
      quantity: resolvedQuantity,
      totalPrice,
      includedQuantity,
      includedUnitPrice: resolvedIncludedUnitPrice,
    });
  }

  return items;
}
