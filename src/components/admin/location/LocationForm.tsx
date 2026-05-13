"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { locationSchema, type LocationFormValues } from "./location.schema";

type LocationFormProps = {
  mode: "create" | "edit";
  defaultValues?: Partial<LocationFormValues>;
  loading?: boolean;
  onSubmit: (values: LocationFormValues) => void;
};

const BASE_DEFAULTS: LocationFormValues = {
  name: "",
  city: "",
  sortOrder: 0,
  isActive: true,
};

export default function LocationForm({
  mode,
  defaultValues,
  loading = false,
  onSubmit,
}: LocationFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      ...BASE_DEFAULTS,
      ...defaultValues,
    },
  });

  const isActive = useWatch({ control, name: "isActive" });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700">
            Location Name <span className="text-red-500">*</span>
          </label>
          <input
            {...register("name")}
            placeholder="e.g. Pitampura"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black/5"
          />
          {errors.name && (
            <p className="text-xs text-red-600">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700">
            City <span className="text-red-500">*</span>
          </label>
          <input
            {...register("city")}
            placeholder="e.g. Delhi"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black/5"
          />
          {errors.city && (
            <p className="text-xs text-red-600">{errors.city.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700">
            Display Order <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            {...register("sortOrder", { valueAsNumber: true })}
            placeholder="0"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black/5"
          />
          {errors.sortOrder && (
            <p className="text-xs text-red-600">{errors.sortOrder.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div>
              <p className="text-xs font-medium text-slate-700">Location Status</p>
              <p className="text-xs text-slate-500">
                {isActive ? "Active location" : "Inactive location"}
              </p>
            </div>
            <ToggleSwitch
              checked={isActive}
              onChange={(checked) => setValue("isActive", checked, { shouldDirty: true })}
            />
          </div>
          {errors.isActive && (
            <p className="text-xs text-red-600">{errors.isActive.message}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end border-t border-slate-200 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex cursor-pointer items-center rounded-md bg-[#27272a] px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? mode === "edit"
              ? "Updating..."
              : "Creating..."
            : mode === "edit"
              ? "Update Location"
              : "Create Location"}
        </button>
      </div>
    </form>
  );
}
