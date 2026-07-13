"use client";

import { Check } from "@/components/icons";

export default function AgreementSection({
  clauseNumber,
  eyebrow,
  title,
  body,
  acknowledged,
  highlighted = false,
  onToggle,
}: {
  clauseNumber: number;
  eyebrow: string;
  title: string;
  body: string;
  acknowledged: boolean;
  highlighted?: boolean;
  onToggle: () => void;
}) {
  return (
    // The accent rail is always laid out, transparent when idle, so drawing
    // attention to a clause slides it aside instead of reflowing the column.
    <section
      className={`border-b border-l-2 border-[#edf1ef] border-l-transparent py-4 pl-0 transition-all duration-500 ease-out last:border-b-0 ${
        highlighted ? "border-l-[#347f7c] bg-[#f4f9f8] pl-3.5" : ""
      }`}
    >
      <button
        type="button"
        aria-pressed={acknowledged}
        onClick={onToggle}
        className="grid w-full cursor-pointer grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-2.5 text-left"
      >
        <span
          className={`flex h-4 w-4 items-center justify-center self-start border transition ${
            acknowledged
              ? "border-[#347f7c] bg-[#347f7c] text-white"
              : "border-gray-400 bg-white"
          }`}
        >
          {acknowledged ? <Check size={11} strokeWidth={2.5} /> : null}
        </span>

        <span className="min-w-0">
          <span className="block h-4 text-[10px] font-semibold leading-4 tracking-[0.16em] text-[#7b7f85] uppercase">
            {eyebrow}
          </span>
          <span className="mt-1.5 block text-[13px] font-semibold text-[#1f2937]">
            {title}
          </span>
          <span className="mt-2 block whitespace-pre-wrap text-[11px] leading-5 text-[#475467]">
            {body}
          </span>
          <span
            className={`mt-2 block text-[10px] font-semibold ${
              acknowledged ? "text-[#347f7c]" : "text-[#b42318]"
            }`}
          >
            {acknowledged ? "Acknowledged" : "Acknowledgment required"}
          </span>
        </span>
      </button>
    </section>
  );
}
