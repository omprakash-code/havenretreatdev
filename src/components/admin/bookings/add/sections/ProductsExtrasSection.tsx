import { memo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { ProductCard } from "@/components/admin/bookings/add/ProductCard";
import {
  PRODUCT_CATEGORIES,
  sectionClass,
  type ProductCategory,
  type ProductLineSelection,
  type ProductOption,
} from "@/components/admin/bookings/add/shared";

type ProductsExtrasSectionProps = {
  loadingProducts: boolean;
  products: ProductOption[];
  productsByCategory: Record<"CAKE" | "DECORATION" | "GIFT", ProductOption[]>;
  getActiveVariantId: (product: ProductOption) => string;
  getVariantSelection: (productId: string, variantId: string) => ProductLineSelection;
  getLedDraftValue: (productId: string, variantId: string, savedValue?: string) => string;
  onVariantChange: (product: ProductOption, variantId: string) => void;
  onIncrementQuantity: (product: ProductOption) => void;
  onDecrementQuantity: (product: ProductOption) => void;
  onToggleDecoration: (product: ProductOption) => void;
  onLedDraftValueChange: (productId: string, variantId: string, value: string) => void;
  onLedNumberSubmit: (product: ProductOption, value: string) => void;
};

const DEFAULT_EXPANDED_STATE: Record<ProductCategory, boolean> = {
  CAKE: false,
  DECORATION: false,
  GIFT: false,
};

function ProductsExtrasSectionComponent({
  loadingProducts,
  products,
  productsByCategory,
  getActiveVariantId,
  getVariantSelection,
  getLedDraftValue,
  onVariantChange,
  onIncrementQuantity,
  onDecrementQuantity,
  onToggleDecoration,
  onLedDraftValueChange,
  onLedNumberSubmit,
}: ProductsExtrasSectionProps) {
  const [expandedByCategory, setExpandedByCategory] = useState(DEFAULT_EXPANDED_STATE);

  function toggleCategory(category: ProductCategory) {
    setExpandedByCategory((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  }

  return (
    <section className={sectionClass}>
      <h2 className="text-sm font-semibold text-slate-900">4. Add-ons</h2>

      {loadingProducts && <p className="mt-3 text-xs text-slate-500">Loading products...</p>}

      {!loadingProducts && products.length === 0 && (
        <p className="mt-3 text-xs text-slate-500">No active products for selected location.</p>
      )}

      {!loadingProducts &&
        PRODUCT_CATEGORIES.map((category, index) => {
          const categoryProducts = productsByCategory[category];
          if (!categoryProducts.length) return null;
          const isExpanded = expandedByCategory[category];

          return (
            <div
              key={category}
              className={`${index === 0 ? "mt-4" : "mt-3"} rounded-xl border border-slate-200 bg-slate-50`}
            >
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-slate-800"
                aria-expanded={isExpanded}
              >
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  {category}
                  <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
                    {categoryProducts.length}
                  </span>
                </span>
                {isExpanded ? (
                  <ChevronDown size={16} className="text-slate-600" />
                ) : (
                  <ChevronRight size={16} className="text-slate-600" />
                )}
              </button>

              <div
                className={`grid overflow-hidden transition-all duration-300 ease-out ${
                  isExpanded
                    ? "mt-0 grid-rows-[1fr] opacity-100"
                    : "mt-0 grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="min-h-0">
                  <div className="grid grid-cols-1 gap-2.5 px-3 pb-3 xl:grid-cols-2">
                    {categoryProducts.map((product) => {
                      const activeVariantId = getActiveVariantId(product);
                      const selection = getVariantSelection(product.id, activeVariantId);
                      return (
                        <ProductCard
                          key={product.id}
                          product={product}
                          activeVariantId={activeVariantId}
                          selection={selection}
                          ledDraft={getLedDraftValue(product.id, activeVariantId, selection.ledNumber)}
                          onVariantChange={(variantId) => onVariantChange(product, variantId)}
                          onIncrement={() => onIncrementQuantity(product)}
                          onDecrement={() => onDecrementQuantity(product)}
                          onToggleDecoration={() => onToggleDecoration(product)}
                          onLedNumberDraftChange={(value) =>
                            onLedDraftValueChange(product.id, activeVariantId, value)
                          }
                          onLedNumberSubmit={(value) => onLedNumberSubmit(product, value)}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
    </section>
  );
}

export const ProductsExtrasSection = memo(ProductsExtrasSectionComponent);
