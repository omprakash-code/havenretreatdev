"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import AdminDrawer from "@/components/admin/drawer/AdminDrawer";
import { invalidateCouponRuleOptionsCache } from "@/components/admin/coupons/CouponDrawer";
import type {
  AdminProduct,
  ProductDrawerMode,
  ProductLocationOption,
} from "@/types/admin/product";
import ProductForm from "./ProductForm";
import ProductView from "./ProductView";
import {
  mapProductToFormValues,
  type ProductFormValues,
} from "./product.schema";

type ProductDrawerProps = {
  open: boolean;
  mode: ProductDrawerMode;
  product: AdminProduct | null;
  locations: ProductLocationOption[];
  onClose: () => void;
  onSaved: () => void;
  onModeChange: (mode: ProductDrawerMode) => void;
};

type ProductMutationResponse = {
  success: boolean;
  message?: string;
  data?: AdminProduct;
};

const MODE_TITLE: Record<ProductDrawerMode, string> = {
  create: "Add Product",
  edit: "Edit Product",
  view: "View Product",
};

const MODE_DESCRIPTION: Record<ProductDrawerMode, string> = {
  create: "Create product and configure variants.",
  edit: "Update product details and variants.",
  view: "Review product details and pricing variants.",
};

export default function ProductDrawer({
  open,
  mode,
  product,
  locations,
  onClose,
  onSaved,
  onModeChange,
}: ProductDrawerProps) {
  const [saving, setSaving] = useState(false);
  const [editingSnapshot, setEditingSnapshot] = useState<AdminProduct | null>(
    null
  );

  useEffect(() => {
    if (!open) return;
    setSaving(false);
  }, [open, mode, product?.id]);

  useEffect(() => {
    if (mode !== "edit") {
      setEditingSnapshot(null);
      return;
    }

    setEditingSnapshot(product);
  }, [mode, product]);

  const defaultValues = useMemo(() => {
    const sourceProduct = mode === "edit" ? editingSnapshot ?? product : product;
    if (!sourceProduct) return undefined;
    return mapProductToFormValues(sourceProduct);
  }, [mode, editingSnapshot, product]);

  async function handleSubmit(values: ProductFormValues) {
    try {
      setSaving(true);

      const isEdit = mode === "edit" && product;
      const res = await fetch("/api/admin/products", {
        method: isEdit ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          isEdit
            ? {
                ...values,
                id: product.id,
              }
            : values
        ),
      });

      const json = (await res.json().catch(() => null)) as ProductMutationResponse | null;

      if (!res.ok || !json?.success) {
        throw new Error(json?.message ?? "Failed to save product");
      }

      toast.success(isEdit ? "Product updated successfully" : "Product created successfully");
      invalidateCouponRuleOptionsCache();
      if (isEdit && json.data) {
        setEditingSnapshot(json.data);
      }
      onSaved();
      if (!isEdit) {
        onClose();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminDrawer
      open={open}
      onClose={onClose}
      title={MODE_TITLE[mode]}
      description={MODE_DESCRIPTION[mode]}
      width={700}
    >
      {mode === "view" && product ? (
        <ProductView product={product} onClose={onClose} onEdit={() => onModeChange("edit")} />
      ) : null}

      {(mode === "create" || mode === "edit") && (
        <ProductForm
          key={
            mode === "edit" && (editingSnapshot ?? product)
              ? `${mode}-${(editingSnapshot ?? product)?.id}-${(editingSnapshot ?? product)?.updatedAt}`
              : "create-product"
          }
          defaultValues={defaultValues}
          locations={locations}
          submitting={saving}
          submitLabel={mode === "edit" ? "Save Changes" : "Add Product"}
          onCancel={onClose}
          onSubmit={(values) => void handleSubmit(values)}
        />
      )}
    </AdminDrawer>
  );
}
