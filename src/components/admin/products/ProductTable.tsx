"use client";

import { useMemo, useState } from "react";
import ProductRow from "./ProductRow";
import type { AdminProduct } from "@/types/admin/product";
import { ProductCategory } from "@prisma/client";

const PAGE_SIZE = 40;

const CATEGORY_ORDER: ProductCategory[] = [
  "CAKE",
  "DECORATION",
  "GIFT",
];

export default function ProductTable({
  data,
  onView,
  onEdit,
  onDelete,
}: {
  data: AdminProduct[];
  onView: (p: AdminProduct) => void;
  onEdit: (p: AdminProduct) => void;
  onDelete: (p: AdminProduct) => void;
}) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const hideSelectionColumn = true;

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const catDiff =
        CATEGORY_ORDER.indexOf(a.category) -
        CATEGORY_ORDER.indexOf(b.category);

      if (catDiff !== 0) return catDiff;
      return a.sortOrder - b.sortOrder;
    });
  }, [data]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  /* -----------------------------
     Selection helpers
  ------------------------------ */
  const toggleAll = () =>
    setSelected(
      selected.length === paginated.length
        ? []
        : paginated.map((p) => p.id)
    );

  const toggleOne = (id: string) =>
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id]
    );

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1060px] border-collapse">
          <thead className="bg-neutral-50 text-neutral-500 text-[12px] uppercase tracking-wide">
            <tr className="h-12">
              {/* Checkbox */}
              <th className={`w-12 pl-5 pr-4 ${hideSelectionColumn ? "hidden" : ""}`}>
                <input
                  type="checkbox"
                  checked={
                    selected.length === paginated.length &&
                    paginated.length > 0
                  }
                  onChange={toggleAll}
                  className="h-4 w-4 cursor-pointer accent-neutral-900"
                />
              </th>

              {/* Serial */}
              <th className="px-3 text-left">#</th>

              <th className="px-3 text-left">Product</th>
              <th className="px-3 text-left">Category</th>
              <th className="px-3 text-left">Location</th>
              <th className="px-3 text-left">Price</th>
              <th className="px-3 text-left">Stock</th>
              <th className="px-3 text-left">Variants</th>
              <th className="px-3 text-left">Sort</th>
              <th className="px-3 text-left">Created</th>
              <th className="px-3 text-left">Status</th>
              <th className="px-3 text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {paginated.map((p, index) => (
              <ProductRow
                key={p.id}
                product={p}
                srNo={(page - 1) * PAGE_SIZE + index + 1}
                selected={selected.includes(p.id)}
                onSelect={() => toggleOne(p.id)}
                hideSelectionColumn={hideSelectionColumn}
                onView={() => onView(p)}
                onEdit={() => onEdit(p)}
                onDelete={() => onDelete(p)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 text-sm">
          <span className="text-neutral-500">
            Page {page} of {totalPages}
          </span>

          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="cursor-pointer rounded-md border border-neutral-200 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="cursor-pointer rounded-md border border-neutral-200 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
