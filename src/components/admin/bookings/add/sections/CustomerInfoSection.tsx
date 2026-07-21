import { Minus, Plus } from "lucide-react";

import {
  inputClass,
  sectionClass,
  type TheatreOption,
} from "@/components/admin/bookings/add/shared";

type CustomerInfoSectionProps = {
  name: string;
  phone: string;
  email: string;
  errors: Record<string, string>;
  lookingUpUser: boolean;
  existingUserId: string | null;
  existingUserName: string | null;
  selectedTheatre: TheatreOption | null;
  guestsForControl: number;
  canDecreaseGuests: boolean;
  canIncreaseGuests: boolean;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onPhoneBlur: () => void;
  onEmailChange: (value: string) => void;
  onDecrementGuests: () => void;
  onIncrementGuests: () => void;
};

export function CustomerInfoSection({
  name,
  phone,
  email,
  errors,
  lookingUpUser,
  existingUserId,
  existingUserName,
  selectedTheatre,
  guestsForControl,
  canDecreaseGuests,
  canIncreaseGuests,
  onNameChange,
  onPhoneChange,
  onPhoneBlur,
  onEmailChange,
  onDecrementGuests,
  onIncrementGuests,
}: CustomerInfoSectionProps) {
  const guestStepButtonClass =
    "inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-150 active:scale-95 sm:h-8 sm:w-8";
  const guestStepButtonEnabledClass =
    "border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50";
  const guestStepButtonDisabledClass =
    "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed";

  return (
    <section className={sectionClass}>
      <h2 className="text-sm font-semibold text-slate-900">2. Customer Details</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            name="customer_name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            className={inputClass}
            placeholder="Customer full name"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            name="customer_phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => onPhoneChange(event.target.value)}
            onBlur={onPhoneBlur}
            maxLength={11}
            inputMode="tel"
            className={inputClass}
            placeholder="e.g. 3055550100"
          />
          {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
          {lookingUpUser && <p className="mt-1 text-xs text-slate-500">Looking up customer…</p>}
          {existingUserId && existingUserName && !lookingUpUser && (
            <p className="mt-1 text-xs text-emerald-700">Linked to existing customer: {existingUserName}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Email (optional)</label>
          <input
            name="customer_email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            className={inputClass}
            placeholder="name@example.com"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Guest Count</label>
          <div className="flex h-11 items-center justify-between rounded-lg border border-slate-300 bg-white px-1 sm:h-10 sm:rounded-md">
            <button
              type="button"
              disabled={!canDecreaseGuests}
              onClick={onDecrementGuests}
              className={`${guestStepButtonClass} ${
                canDecreaseGuests ? guestStepButtonEnabledClass : guestStepButtonDisabledClass
              }`}
            >
              <Minus size={16} />
            </button>

            <span className="min-w-[40px] text-center text-sm font-semibold tabular-nums text-slate-900">
              {guestsForControl}
            </span>

            <div className="group relative">
              <button
                type="button"
                disabled={!canIncreaseGuests}
                onClick={onIncrementGuests}
                className={`${guestStepButtonClass} ${
                  canIncreaseGuests ? guestStepButtonEnabledClass : guestStepButtonDisabledClass
                }`}
              >
                <Plus size={16} />
              </button>
              {selectedTheatre && !canIncreaseGuests && (
                <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black px-3 py-1 text-xs text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  Max capacity reached
                </div>
              )}
            </div>
          </div>

          {selectedTheatre ? (
            <p className="mt-1 text-xs text-slate-500">
              {selectedTheatre.baseGuests} included · up to {selectedTheatre.capacity} at no extra charge
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">Select a venue to manage guests</p>
          )}
        </div>
      </div>

    </section>
  );
}
