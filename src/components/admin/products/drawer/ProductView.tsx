"use client";

import { Calendar, Clock, Tag } from "@/components/icons";
import type { AdminProduct } from "@/types/admin/product";
import { formatVenueDateTime } from "@/lib/formatters";

type ProductViewProps = {
  product: AdminProduct;
  onClose: () => void;
  onEdit: () => void;
};

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${
        active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function ProductView({ product, onClose, onEdit }: ProductViewProps) {
  const defaultVariant = product.variants.find((variant) => variant.isDefault) ?? null;
  const defaultPrice =
    defaultVariant &&
    defaultVariant.salePrice !== null &&
    defaultVariant.salePrice !== undefined &&
    defaultVariant.salePrice > 0
      ? defaultVariant.salePrice
      : defaultVariant?.regularPrice ?? null;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Status Overview</h3>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div>
            <p className="mb-1 text-xs text-slate-500">Product Status</p>
            <StatusBadge active={product.isActive} />
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <p className="mb-1 text-xs text-slate-500">Category</p>
            <span className="inline-flex rounded-md bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-800">
              {product.category}
            </span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <p className="mb-1 text-xs text-slate-500">Default Price</p>
            <span className="inline-flex rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-900">
              {defaultPrice !== null ? `$${defaultPrice}` : "—"}
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Product Details</h3>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 sm:h-28 sm:w-28">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image || "/assets/logo.png"}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Name</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{product.name}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Slug</p>
              <p className="mt-1 break-all text-sm font-medium text-slate-900">{product.slug}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Location</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {product.location?.name ?? "—"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Sort Order</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{product.sortOrder}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Description</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
            {product.description?.trim() || "No description added."}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Variant Information</h3>
        <div className="mt-3 space-y-2">
          {product.variants.length === 0 ? (
            <p className="text-sm text-slate-500">No variants configured.</p>
          ) : (
            product.variants.map((variant) => (
              <div
                key={variant.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{variant.label}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Tag size={12} />
                        Sort {variant.sortOrder}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Tag size={12} />
                        Stock {variant.stock === null ? "Unlimited" : variant.stock}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Tag size={12} />
                        Max/booking{" "}
                        {variant.maxPerBooking === null ? "No limit" : variant.maxPerBooking}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {variant.isActive ? "Active" : "Inactive"}
                      </span>
                      {variant.isDefault && (
                        <span className="rounded bg-slate-900 px-2 py-0.5 text-white">Default</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    {variant.salePrice !== null &&
                      variant.salePrice !== undefined &&
                      variant.salePrice > 0 && (
                      <p className="text-xs text-slate-400 line-through">${variant.regularPrice}</p>
                    )}
                    <p className="text-sm font-semibold text-slate-900">
                      $
                      {variant.salePrice !== null &&
                      variant.salePrice !== undefined &&
                      variant.salePrice > 0
                        ? variant.salePrice
                        : variant.regularPrice}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Timestamps</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Created At</p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-900">
              <Calendar size={14} />
              {formatVenueDateTime(product.createdAt)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Updated At</p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-900">
              <Calendar size={14} />
              {formatVenueDateTime(product.updatedAt)}
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-slate-700"
        >
          Close
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Edit Product
        </button>
      </div>
    </div>
  );
}
