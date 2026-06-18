"use client";

import Image from "next/image";
import { Eye, Pencil, Trash } from "@/components/icons";
import type { AdminProduct } from "@/types/admin/product";
import ProductVariantChips from "./ProductVariantChips";

const FALLBACK_IMAGE = "/assets/logo.png";

export default function ProductRow({
    product,
    srNo,
    selected,
    onSelect,
    hideSelectionColumn = false,
    onView,
    onEdit,
    onDelete,
}: {
    product: AdminProduct;
    srNo: number;
    selected: boolean;
    onSelect: () => void;
    hideSelectionColumn?: boolean;
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const imageSrc =
        product.image && product.image.trim() !== ""
            ? product.image
            : FALLBACK_IMAGE;

    const defaultVariant = product.variants.find(
        (v) => v.isDefault
    );

    const price = defaultVariant
        ? (defaultVariant.salePrice !== null &&
          defaultVariant.salePrice !== undefined &&
          defaultVariant.salePrice > 0
            ? defaultVariant.salePrice
            : defaultVariant.regularPrice)
        : null;
    const hasUnlimitedStock = product.variants.some(
        (variant) => variant.stock === null || variant.stock === undefined
    );
    const totalStock = product.variants.reduce(
        (sum, variant) =>
            variant.stock === null || variant.stock === undefined
                ? sum
                : sum + Math.max(Number(variant.stock), 0),
        0
    );
    const isStockAvailable = hasUnlimitedStock || totalStock > 0;

            return (
        <tr className="border-t border-neutral-100 text-[13px] hover:bg-neutral-50">
            {/* Checkbox */}
            <td className={`w-12 pl-5 pr-4 ${hideSelectionColumn ? "hidden" : ""}`}>
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={onSelect}
                    className="h-4 w-4 cursor-pointer accent-neutral-900"
                />
            </td>

            {/* Serial Number */}
            <td className="px-3 py-3 text-neutral-500">
                {srNo}
            </td>

            {/* Product */}
            <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                    <Image
                        src={imageSrc}
                        alt={product.name}
                        width={36}
                        height={36}
                        className="h-9 w-9 rounded-md object-cover border"
                    />
                    <div>
                        <button
                            type="button"
                            onClick={onEdit}
                            className="cursor-pointer text-left font-medium text-neutral-900 transition hover:text-blue-600"
                        >
                            {product.name}
                        </button>
                        <div className="text-xs text-neutral-500">
                            {product.slug}
                        </div>
                    </div>
                </div>
            </td>

            {/* Category */}
            <td className="px-3 py-3">
                <span className="text-xs px-2 py-1 rounded bg-neutral-100">
                    {product.category}
                </span>
            </td>

            {/* Location */}
            <td className="px-3 py-3 text-neutral-600">
                {product.location?.name ?? "—"}
            </td>

            {/* Price */}
            <td className="px-3 py-3 whitespace-nowrap">
                {defaultVariant ? (
                    <div className="leading-tight">
                        {defaultVariant.salePrice !== null &&
                          defaultVariant.salePrice !== undefined &&
                          defaultVariant.salePrice > 0 && (
                            <div className="text-xs line-through text-neutral-400">
                                ${defaultVariant.regularPrice}
                            </div>
                          )}
                        <div className="font-semibold">
                            ${price}
                        </div>
                    </div>
                ) : (
                    <span className="text-neutral-400">—</span>
                )}
            </td>

            {/* Stock */}
            <td className="px-3 py-3 whitespace-nowrap">
                <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        isStockAvailable
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                    }`}
                >
                    {hasUnlimitedStock ? "Unlimited" : totalStock > 0 ? totalStock : "Out"}
                </span>
            </td>

            {/* Variants */}
            <td className="px-3 py-3">
                <ProductVariantChips variants={product.variants} />
            </td>

            {/* Sort */}
            <td className="px-3 py-3 font-mono text-xs text-neutral-500">
                {product.sortOrder}
            </td>

            {/* Created */}
            <td className="px-3 py-3 text-xs text-neutral-500 whitespace-nowrap">
                {new Date(product.createdAt).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                })}
            </td>

            {/* Status */}
            <td className="px-3 py-3">
                <span
                    className={`text-xs px-2 py-1 rounded-full ${product.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-neutral-300 text-neutral-700"
                        }`}
                >
                    {product.isActive ? "Active" : "Inactive"}
                </span>
            </td>

            <td className="px-3 py-3">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onView}
                        className="inline-flex cursor-pointer items-center justify-center rounded-md p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                        aria-label={`View ${product.name}`}
                        title="View"
                    >
                        <Eye size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={onEdit}
                        className="inline-flex cursor-pointer items-center justify-center rounded-md p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                        aria-label={`Edit ${product.name}`}
                        title="Edit"
                    >
                        <Pencil size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        className="inline-flex cursor-pointer items-center justify-center rounded-md p-1.5 text-red-600 transition hover:bg-red-50 hover:text-red-700"
                        aria-label={`Delete ${product.name}`}
                        title="Delete"
                    >
                        <Trash size={15} />
                    </button>
                </div>
            </td>
        </tr>
    );
}
