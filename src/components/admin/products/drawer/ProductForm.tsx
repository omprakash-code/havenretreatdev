"use client";

import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch, type FieldErrors, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash } from "@/components/icons";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import ProductImageUploader from "./ProductImageUploader";
import {
  createEmptyVariant,
  getDefaultProductFormValues,
  PRODUCT_CATEGORIES,
  productFormSchema,
  type ProductFormValues,
} from "./product.schema";

type LocationOption = {
  id: string;
  name: string;
};

type ProductFormProps = {
  defaultValues?: ProductFormValues;
  locations: LocationOption[];
  submitting?: boolean;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (values: ProductFormValues) => void;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fieldClass(hasError: boolean, extra = "") {
  return `mt-1 w-full rounded-md border px-3 text-sm ${
    hasError
      ? "border-red-500 bg-red-50/70 text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-200"
      : "border-neutral-200 bg-white"
  } ${extra}`;
}

function getFirstError(
  errors: unknown,
  path = ""
): { path: string; message: string } | null {
  if (!errors || typeof errors !== "object") return null;
  const record = errors as Record<string, unknown>;

  if (typeof record.message === "string") {
    return { path, message: record.message };
  }

  for (const key of Object.keys(record)) {
    if (["type", "types", "ref"].includes(key)) continue;
    const child = record[key];
    const nextPath = path ? `${path}.${key}` : key;
    const found = getFirstError(child, nextPath);
    if (found) return found;
  }

  return null;
}

function normalizeForCompare(values: ProductFormValues | undefined) {
  if (!values) return null;

  return {
    name: String(values.name ?? "").trim(),
    slug: String(values.slug ?? "").trim(),
    image: String(values.image ?? "").trim(),
    description: (values.description ?? "").toString().trim(),
    category: values.category,
    locationId: String(values.locationId ?? "").trim(),
    isActive: Boolean(values.isActive),
    sortOrder: Number.isFinite(values.sortOrder) ? Number(values.sortOrder) : 0,
    variants: (values.variants ?? []).map((variant) => ({
      id: String(variant.id ?? "").trim(),
      label: String(variant.label ?? "").trim(),
      regularPrice: Number.isFinite(variant.regularPrice)
        ? Number(variant.regularPrice)
        : null,
      salePrice:
        variant.salePrice === null ||
        variant.salePrice === undefined
          ? null
          : Number(variant.salePrice),
      stock: Number.isFinite(variant.stock) ? Number(variant.stock) : null,
      isDefault: Boolean(variant.isDefault),
      isActive: Boolean(variant.isActive),
      sortOrder: Number.isFinite(variant.sortOrder) ? Number(variant.sortOrder) : 0,
    })),
  };
}

export default function ProductForm({
  defaultValues,
  locations,
  submitting = false,
  submitLabel = "Save Product",
  onCancel,
  onSubmit,
}: ProductFormProps) {
  const initialValues = useMemo(
    () => defaultValues ?? getDefaultProductFormValues(),
    [defaultValues]
  );
  const [activeTab, setActiveTab] = useState<"details">("details");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(() =>
    Boolean(defaultValues?.slug)
  );

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    setFocus,
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const submitForm = handleSubmit(onSubmit, (formErrors: FieldErrors<ProductFormValues>) => {
    const firstError = getFirstError(formErrors);

    if (firstError?.message) {
      toast.error(firstError.message);
    } else {
      toast.error("Please check the highlighted fields.");
    }

    if (firstError?.path) {
      const fieldPath = firstError.path as Path<ProductFormValues>;
      setFocus(fieldPath);

      const input = document.querySelector(`[name="${firstError.path}"]`) as
        | HTMLElement
        | null;
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  const {
    fields: variantFields,
    append,
    replace,
  } = useFieldArray({
    control,
    name: "variants",
  });

  const variants = useWatch({
    control,
    name: "variants",
  });
  const watchedValues = useWatch({
    control,
  });

  const isActive = useWatch({
    control,
    name: "isActive",
  });

  const imageValue = useWatch({
    control,
    name: "image",
  });

  const variantError =
    typeof errors.variants?.message === "string" ? errors.variants.message : null;

  function addVariant() {
    const current = variants ?? [];
    append(
      createEmptyVariant({
        isDefault: current.length === 0,
      })
    );
  }

  function setDefaultVariant(index: number) {
    const current = variants ?? [];
    const next = current.map((variant, i) => ({
      ...variant,
      isDefault: i === index,
    }));
    replace(next);
  }

  function removeVariant(index: number) {
    const current = variants ?? [];
    if (current.length <= 1) return;

    const wasDefault = current[index]?.isDefault;
    const next = current
      .filter((_, i) => i !== index)
      .map((variant, i) => ({
        ...variant,
        sortOrder: variant.sortOrder ?? i,
        isDefault: wasDefault ? i === 0 : variant.isDefault,
      }));

    if (!next.some((variant) => variant.isDefault) && next[0]) {
      next[0].isDefault = true;
    }

    replace(next);
  }

  const nameField = register("name");
  const slugField = register("slug");
  const hasChanges = useMemo(() => {
    if (!defaultValues) return isDirty;

    return (
      JSON.stringify(normalizeForCompare(watchedValues as ProductFormValues)) !==
      JSON.stringify(normalizeForCompare(defaultValues))
    );
  }, [defaultValues, isDirty, watchedValues]);

  return (
    <form onSubmit={submitForm} className="space-y-5">
      <div className="-mx-4 border-b border-slate-200 px-4 sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`relative px-3 py-2.5 text-sm font-medium ${
            activeTab === "details"
              ? "border-b-2 border-black text-slate-900"
              : "text-slate-500"
          }`}
        >
          Product Details
        </button>
      </div>

      {activeTab === "details" && (
        <>
          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Basic Information</h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate-700">
                Product Name
                <input
                  type="text"
                  {...nameField}
                  onChange={(event) => {
                    nameField.onChange(event);
                    if (!slugManuallyEdited) {
                      setValue("slug", slugify(event.target.value), {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                  }}
                  className={fieldClass(Boolean(errors.name), "h-10")}
                  placeholder="e.g. Chocolate Cake"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
                )}
              </label>

              <label className="text-sm text-slate-700">
                Slug
                <input
                  type="text"
                  {...slugField}
                  onChange={(event) => {
                    setSlugManuallyEdited(true);
                    slugField.onChange(event);
                  }}
                  className={fieldClass(Boolean(errors.slug), "h-10")}
                  placeholder="e.g. chocolate-cake"
                />
                {errors.slug && (
                  <p className="mt-1 text-xs text-red-600">{errors.slug.message}</p>
                )}
              </label>

              <label className="text-sm text-slate-700">
                Category
                <select
                  {...register("category")}
                  className={fieldClass(Boolean(errors.category), "h-10")}
                >
                  {PRODUCT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <p className="mt-1 text-xs text-red-600">{errors.category.message}</p>
                )}
              </label>

              <label className="text-sm text-slate-700">
                Location
                <select
                  {...register("locationId")}
                  className={fieldClass(Boolean(errors.locationId), "h-10")}
                >
                  <option value="__ALL__">All Locations</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
                {errors.locationId && (
                  <p className="mt-1 text-xs text-red-600">{errors.locationId.message}</p>
                )}
                {locations.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    No active locations available. You can still save this product for all locations.
                  </p>
                )}
              </label>

              <label className="text-sm text-slate-700 sm:col-span-2">
                Description
                <textarea
                  rows={3}
                  {...register("description")}
                  className={fieldClass(Boolean(errors.description), "py-2")}
                  placeholder="Optional description shown to customers."
                />
                {errors.description && (
                  <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
                )}
              </label>

              <label className="text-sm text-slate-700">
                Sort Order
                <input
                  type="number"
                  {...register("sortOrder", {
                    setValueAs: (value) => (value === "" ? 0 : Number(value)),
                  })}
                  className={fieldClass(Boolean(errors.sortOrder), "h-10")}
                  min={0}
                  placeholder="e.g. 1"
                />
                {errors.sortOrder && (
                  <p className="mt-1 text-xs text-red-600">{errors.sortOrder.message}</p>
                )}
              </label>
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Product Image</h3>

            <div className={errors.image ? "rounded-lg border border-red-400 p-1" : ""}>
              <ProductImageUploader
                value={imageValue ?? ""}
                disabled={submitting}
                onChange={(url) =>
                  setValue("image", url, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
            </div>
            <input type="hidden" {...register("image")} />
            {errors.image && <p className="text-xs text-red-600">{errors.image.message}</p>}
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">Variants</h3>
              <button
                type="button"
                onClick={addVariant}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Plus size={14} />
                Add Variant
              </button>
            </div>

            <div className="space-y-3">
              {variantFields.map((field, index) => {
                const rowErrors = errors.variants?.[index];
                const row = variants?.[index];

                return (
                  <div
                    key={field.id}
                    className={`rounded-lg border p-3 ${
                      rowErrors
                        ? "border-red-300 bg-red-50/40"
                        : "border-neutral-200 bg-neutral-50"
                    }`}
                  >
                    <input type="hidden" {...register(`variants.${index}.id`)} />

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <label className="text-sm text-slate-700">
                        Variation
                        <input
                          type="text"
                          {...register(`variants.${index}.label`)}
                          className={fieldClass(Boolean(rowErrors?.label), "h-9")}
                          placeholder="e.g. Standard / Premium / Red"
                        />
                        {rowErrors?.label && (
                          <p className="mt-1 text-xs text-red-600">{rowErrors.label.message}</p>
                        )}
                      </label>

                      <label className="text-sm text-slate-700">
                        Regular Price
                        <input
                          type="number"
                          {...register(`variants.${index}.regularPrice`, {
                            setValueAs: (value) => (value === "" ? Number.NaN : Number(value)),
                          })}
                          min={1}
                          className={fieldClass(Boolean(rowErrors?.regularPrice), "h-9")}
                          placeholder="e.g. 999"
                        />
                        {rowErrors?.regularPrice && (
                          <p className="mt-1 text-xs text-red-600">
                            {rowErrors.regularPrice.message}
                          </p>
                        )}
                      </label>

                      <label className="text-sm text-slate-700">
                        Sale Price
                        <input
                          type="number"
                          {...register(`variants.${index}.salePrice`, {
                            setValueAs: (value) => (value === "" ? null : Number(value)),
                          })}
                          min={1}
                          className={fieldClass(Boolean(rowErrors?.salePrice), "h-9")}
                          placeholder="Optional"
                        />
                        {rowErrors?.salePrice && (
                          <p className="mt-1 text-xs text-red-600">
                            {rowErrors.salePrice.message}
                          </p>
                        )}
                      </label>

                      <label className="text-sm text-slate-700">
                        Stock Qty
                        <input
                          type="number"
                          {...register(`variants.${index}.stock`, {
                            setValueAs: (value) => (value === "" ? Number.NaN : Number(value)),
                          })}
                          min={0}
                          className={fieldClass(Boolean(rowErrors?.stock), "h-9")}
                          placeholder="e.g. 50"
                        />
                        {rowErrors?.stock && (
                          <p className="mt-1 text-xs text-red-600">{rowErrors.stock.message}</p>
                        )}
                      </label>

                      <label className="text-sm text-slate-700">
                        Variation Sort
                        <input
                          type="number"
                          {...register(`variants.${index}.sortOrder`, {
                            setValueAs: (value) => (value === "" ? 0 : Number(value)),
                          })}
                          min={0}
                          className={fieldClass(Boolean(rowErrors?.sortOrder), "h-9")}
                          placeholder="e.g. 1"
                        />
                        {rowErrors?.sortOrder && (
                          <p className="mt-1 text-xs text-red-600">{rowErrors.sortOrder.message}</p>
                        )}
                      </label>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-3">
                      <div className="flex items-center gap-4">
                        <div>
                          <label
                            className={`inline-flex cursor-pointer items-center gap-2 text-sm ${
                              rowErrors?.isDefault ? "text-red-700" : "text-slate-700"
                            }`}
                          >
                            <input
                              type="radio"
                              checked={Boolean(row?.isDefault)}
                              onChange={() => setDefaultVariant(index)}
                              className="h-4 w-4 accent-slate-900"
                            />
                            Default Variant
                          </label>
                          {rowErrors?.isDefault && (
                            <p className="mt-1 text-xs text-red-600">
                              {rowErrors.isDefault.message}
                            </p>
                          )}
                        </div>

                        <div>
                          <div
                            className={`inline-flex items-center gap-2 text-sm ${
                              rowErrors?.isActive ? "text-red-700" : "text-slate-700"
                            }`}
                          >
                            <span>{row?.isActive ? "Active" : "Inactive"}</span>
                            <ToggleSwitch
                              checked={Boolean(row?.isActive)}
                              onChange={(checked) =>
                                setValue(`variants.${index}.isActive`, checked, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                })
                              }
                            />
                          </div>
                          {rowErrors?.isActive && (
                            <p className="mt-1 text-xs text-red-600">{rowErrors.isActive.message}</p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={(variants ?? []).length <= 1}
                        onClick={() => removeVariant(index)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash size={13} />
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {variantError && <p className="text-xs text-red-600">{variantError}</p>}
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Product Status</h3>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-700">
                  {isActive ? "Visible" : "Hidden"}
                </p>
                <ToggleSwitch
                  checked={Boolean(isActive)}
                  onChange={(checked) =>
                    setValue("isActive", checked, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </div>
            </div>
          </section>
        </>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 bg-white pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void submitForm()}
          disabled={submitting || !hasChanges}
          className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
