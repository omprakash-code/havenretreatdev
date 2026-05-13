import { ChevronDown } from "lucide-react";

import {
  inputClass,
  sectionClass,
  selectableInputClass,
  type OccasionOption,
  type SlotOption,
} from "@/components/admin/bookings/add/shared";

type OccasionSectionProps = {
  occasionKey: string;
  occasions: OccasionOption[];
  selectedOccasion: OccasionOption | null;
  selectedSlot: SlotOption | null;
  decorationRequired: boolean;
  occasionData: Record<string, string>;
  errors: Record<string, string>;
  onOccasionChange: (key: string) => void;
  onOccasionFieldChange: (key: string, value: string) => void;
  onDecorationRequiredChange: (value: boolean) => void;
};

export function OccasionSection({
  occasionKey,
  occasions,
  selectedOccasion,
  selectedSlot,
  decorationRequired,
  occasionData,
  errors,
  onOccasionChange,
  onOccasionFieldChange,
  onDecorationRequiredChange,
}: OccasionSectionProps) {
  const decorationMandatory = Boolean(selectedSlot?.decorationMandatory);
  const decorationLabel = decorationRequired ? "Yes" : "No";

  return (
    <section className={sectionClass}>
      <h2 className="text-sm font-semibold text-slate-900">3. Decoration & Occasion</h2>
      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-slate-700">
          Decoration{" "}
          <span className={decorationMandatory ? "text-red-600" : "text-slate-500"}>
            ({decorationMandatory ? "Mandatory" : "Optional"})
          </span>
        </label>
        <div className="relative mt-1">
          <select
            value={decorationRequired ? "YES" : "NO"}
            onChange={(event) => onDecorationRequiredChange(event.target.value === "YES")}
            disabled={decorationMandatory}
            aria-label="Decoration"
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          >
            <option value="YES">Yes</option>
            <option value="NO">No</option>
          </select>
          <div
            className={`${inputClass} flex items-center justify-between ${
              decorationMandatory ? "cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            <span className={decorationMandatory ? "text-slate-500" : "text-slate-900"}>
              {decorationLabel}
            </span>
            <ChevronDown size={16} className="shrink-0 text-slate-500" />
          </div>
        </div>
      </div>

      {decorationRequired ? (
        <>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-slate-700">Occasion</label>
            <select
              value={occasionKey}
              onChange={(event) => onOccasionChange(event.target.value)}
              className={selectableInputClass}
            >
              <option value="">No occasion selected</option>
              {occasions.map((occasion) => (
                <option key={occasion.id} value={occasion.key}>
                  {occasion.label}
                </option>
              ))}
            </select>
          </div>

          {selectedOccasion && selectedOccasion.fields.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {selectedOccasion.fields.map((field) => (
                <div key={field.key}>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    {field.label}
                    {field.isRequired ? <span className="text-red-500"> *</span> : null}
                  </label>
                  <input
                    value={occasionData[field.key] ?? ""}
                    onChange={(event) => onOccasionFieldChange(field.key, event.target.value)}
                    className={inputClass}
                    placeholder={field.placeholder || field.label}
                  />
                  {errors[`occasion.${field.key}`] && (
                    <p className="mt-1 text-xs text-red-600">{errors[`occasion.${field.key}`]}</p>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
