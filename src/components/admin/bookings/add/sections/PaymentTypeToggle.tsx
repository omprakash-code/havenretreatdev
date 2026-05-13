type PaymentTypeToggleProps = {
  value: "OFFLINE" | "ONLINE";
  onChange: (value: "OFFLINE" | "ONLINE") => void;
};

export function PaymentTypeToggle({ value, onChange }: PaymentTypeToggleProps) {
  return (
    <div className="rounded-xl border border-slate-300 bg-slate-100 p-0.5">
      <div className="relative grid h-11 grid-cols-2 items-stretch sm:h-12">
        <div
          className={`pointer-events-none absolute left-0.5 top-0.5 h-[calc(100%-4px)] w-[calc(50%-2px)] rounded-md border border-slate-300 bg-white shadow-sm transition-transform duration-200 ${
            value === "ONLINE" ? "translate-x-[calc(100%+2px)]" : "translate-x-0"
          }`}
          aria-hidden
        />

        <button
          type="button"
          onClick={() => onChange("OFFLINE")}
          aria-pressed={value === "OFFLINE"}
          className={`relative z-10 flex h-full items-center justify-center rounded-md px-3 text-sm font-semibold leading-none transition ${
            value === "OFFLINE" ? "text-slate-900" : "text-slate-600 hover:text-slate-800"
          }`}
        >
          Offline
        </button>
        <button
          type="button"
          onClick={() => onChange("ONLINE")}
          aria-pressed={value === "ONLINE"}
          className={`relative z-10 flex h-full items-center justify-center rounded-md px-3 text-sm font-semibold leading-none transition ${
            value === "ONLINE" ? "text-slate-900" : "text-slate-600 hover:text-slate-800"
          }`}
        >
          Online
        </button>
      </div>
    </div>
  );
}
