"use client";

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ease-in-out
        cursor-pointer
        focus:outline-none focus:ring-2 focus:ring-black/10 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${checked ? "bg-[#27272a]" : "bg-slate-300"}
      `}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out
          ${checked ? "translate-x-5.5" : "translate-x-0.5"}
        `}
      />
    </button>
  );
}
