import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { Info } from "@/components/icons";

export function SectionCard({
  title,
  description,
  children,
  rightContent,
  keepHeaderInlineOnMobile = false,
}: {
  title: ReactNode;
  description?: string;
  children: ReactNode;
  rightContent?: ReactNode;
  keepHeaderInlineOnMobile?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3.5">
      <div
        className={`mb-3 flex gap-3 ${keepHeaderInlineOnMobile
          ? "flex-row items-start justify-between"
          : "flex-col sm:flex-row sm:items-start sm:justify-between"
          }`}
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
        </div>
        {rightContent}
      </div>
      {children}
    </div>
  );
}

export function Label({ text }: { text: string }) {
  return <div className="text-xs font-medium text-slate-500">{text}</div>;
}

export function LabelWithInfo({
  text,
  info,
  required = false,
}: {
  text: string;
  info?: string;
  required?: boolean;
}) {
  return (
    <div className="mb-0.5 flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        <Label text={text} />
        {required ? <span className="text-xs font-semibold text-red-500">*</span> : null}
      </div>
      {info ? <InfoTooltipButton label={text} content={info} /> : null}
    </div>
  );
}

export function Input({
  label,
  info,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
}: {
  label: string;
  info?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  min?: string;
  max?: string;
}) {
  return (
    <div>
      <LabelWithInfo text={label} info={info} />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        className="mt-1 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-300"
      />
    </div>
  );
}

export function DateTimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <LabelWithInfo text={label} />
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-300"
      />
    </div>
  );
}

export function NumberInput({
  label,
  info,
  required = false,
  value,
  onChange,
  allowZeroAsNull = false,
  allowEmpty = false,
  placeholder,
}: {
  label: string;
  info?: string;
  required?: boolean;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  allowZeroAsNull?: boolean;
  allowEmpty?: boolean;
  placeholder?: string;
}) {
  const inputValue =
    value == null
      ? allowEmpty
        ? ""
        : 0
      : Number.isFinite(value)
      ? value
      : allowEmpty
      ? ""
      : 0;

  return (
    <div>
      <LabelWithInfo text={label} info={info} required={required} />
      <input
        type="number"
        min={0}
        value={inputValue}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          if (allowEmpty && raw === "") {
            onChange(null);
            return;
          }

          const num = Number(raw);
          if (!Number.isFinite(num)) {
            onChange(allowEmpty ? null : 0);
            return;
          }
          onChange(allowZeroAsNull && num <= 0 ? 0 : num);
        }}
        className="mt-1 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-300"
      />
    </div>
  );
}

export function Select({
  label,
  info,
  required = false,
  value,
  onChange,
  options,
}: {
  label: string;
  info?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <LabelWithInfo text={label} info={info} required={required} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-11 w-full cursor-pointer rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-300"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ToggleRow({
  label,
  info,
  description,
  checked,
  onChange,
}: {
  label: string;
  info?: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-md border border-slate-200 p-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium text-slate-900">{label}</p>
          {info ? <InfoTooltipButton label={label} content={info} /> : null}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );
}

export function InfoTooltipButton({
  label,
  content,
}: {
  label: string;
  content: string;
}) {
  const [open, setOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [positionReady, setPositionReady] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const pointerInteractionRef = useRef(false);
  const tooltipId = useId();
  const supportsHover =
    typeof window !== "undefined"
      ? window.matchMedia("(hover: hover) and (pointer: fine)").matches
      : false;

  useLayoutEffect(() => {
    if (!open) return;

    const computePlacement = () => {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (!trigger || !tooltip) return;

      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const viewportPadding = 8;
      const tooltipWidth = Math.min(tooltip.offsetWidth || 256, viewportWidth - viewportPadding * 2);
      const tooltipHeight = tooltip.offsetHeight || 0;

      const anchorOffset = 16;
      const canAnchorRight =
        rect.left - anchorOffset + tooltipWidth + viewportPadding <= viewportWidth;
      const preferredLeft = canAnchorRight
        ? rect.left - anchorOffset
        : rect.right - tooltipWidth + anchorOffset;
      const maxLeft = viewportWidth - tooltipWidth - viewportPadding;
      const left = Math.min(Math.max(preferredLeft, viewportPadding), maxLeft);

      const spaceBelow = viewportHeight - rect.bottom;
      const top =
        spaceBelow >= tooltipHeight + 8
          ? rect.bottom + 6
          : Math.max(rect.top - tooltipHeight - 6, viewportPadding);

      setTooltipPosition({ top, left });
      setPositionReady(true);
    };

    computePlacement();
    window.addEventListener("resize", computePlacement);
    window.addEventListener("scroll", computePlacement, true);
    return () => {
      window.removeEventListener("resize", computePlacement);
      window.removeEventListener("scroll", computePlacement, true);
    };
  }, [content, open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (tooltipRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <span className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`More info about ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={tooltipId}
        className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-slate-400 outline-none transition hover:text-slate-600 focus-visible:text-slate-700"
        onPointerDown={() => {
          pointerInteractionRef.current = true;
        }}
        onMouseEnter={() => {
          if (!supportsHover) return;
          setPositionReady(false);
          setOpen(true);
        }}
        onMouseLeave={() => {
          if (!supportsHover) return;
          setOpen(false);
        }}
        onFocus={() => {
          if (pointerInteractionRef.current) return;
          setPositionReady(false);
          setOpen(true);
        }}
        onBlur={(event) => {
          pointerInteractionRef.current = false;
          const next = event.relatedTarget as Node | null;
          if (next && tooltipRef.current?.contains(next)) return;
          setOpen(false);
        }}
        onClick={() => {
          if (!open) {
            setPositionReady(false);
          }
          setOpen((prev) => !prev);
          pointerInteractionRef.current = false;
        }}
      >
        <Info size={12} />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              tabIndex={-1}
              style={{
                position: "fixed",
                top: tooltipPosition.top,
                left: tooltipPosition.left,
                visibility: positionReady ? "visible" : "hidden",
              }}
              className={`z-[70] w-64 max-w-[calc(100vw-1rem)] rounded-md border border-slate-200 bg-white p-2 text-[11px] font-medium text-slate-700 shadow-sm transition-[opacity,transform] duration-200 ease-out ${
                open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0 pointer-events-none"
              }`}
            >
              {content}
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
