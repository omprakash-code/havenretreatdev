"use client";

import { PhoneCall, X } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsApp";
import { useHomeFloatingActions } from "@/components/pages/home/HomeFloatingActionsContext";

const CALL_PHONE_NUMBER = "9289289696";
const WHATSAPP_PHONE_NUMBER = "9289289696";

function normalizeIndianPhone(input: string) {
  const digits = input.replace(/\D/g, "");

  if (digits.length === 10) {
    return {
      tel: digits,
      whatsapp: `91${digits}`,
    };
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return {
      tel: digits,
      whatsapp: digits,
    };
  }

  return {
    tel: digits,
    whatsapp: digits,
  };
}

export default function HeroFloatingContacts() {
  const { collapsed, collapseActions } = useHomeFloatingActions();
  const callNumber = normalizeIndianPhone(CALL_PHONE_NUMBER);
  const whatsappNumber = normalizeIndianPhone(WHATSAPP_PHONE_NUMBER);

  if (!callNumber.tel && !whatsappNumber.whatsapp) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-[4.875rem] right-4 z-40 sm:bottom-28 sm:right-4 md:bottom-8 md:right-6">
      <div
        className={`flex flex-col items-center gap-2.5 transition-all duration-300 md:items-end ${
          collapsed
            ? "translate-x-5 opacity-0 pointer-events-none md:translate-x-0 md:opacity-100 md:pointer-events-auto"
            : "translate-x-0 opacity-100 pointer-events-auto"
        }`}
      >
        <button
          type="button"
          onClick={collapseActions}
          aria-label="Hide quick actions"
          className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center bg-transparent text-white/80 transition-colors duration-200 hover:text-white md:hidden"
        >
          <X className="h-5 w-5" />
        </button>

        {callNumber.tel ? (
          <a
            href={`tel:${callNumber.tel}`}
            aria-label="Call Haven Retreat"
            className="pointer-events-auto relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/90 text-slate-900 shadow-[0_16px_35px_rgba(15,23,42,0.18)] backdrop-blur transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white">
            <PhoneCall className="relative z-10 h-5 w-5 shrink-0" />
          </a>
        ) : null}

        {whatsappNumber.whatsapp ? (
          <a
            href={`https://wa.me/${whatsappNumber.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat on WhatsApp"
            className="pointer-events-auto relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500 text-white shadow-[0_16px_35px_rgba(22,163,74,0.3)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-emerald-600"
          >
            <WhatsAppIcon size={20} className="relative z-10 shrink-0 text-white" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
