"use client";

import Image from "next/image";

export default function TheatreImagePanel({
  theatreName,
  theatreImage,
  locationName,
  embedded = false,
}: {
  theatreName: string;
  theatreImage?: string | null;
  locationName: string;
  embedded?: boolean;
}) {
  return (
    <section
      className={
        embedded
          ? "overflow-hidden"
          : "overflow-hidden border border-zinc-200 bg-white shadow-sm"
      }
    >
      <div className="relative aspect-[4/3] w-full bg-slate-100 print:h-[220px] print:aspect-auto">
        {theatreImage ? (
          <>
            <Image
              src={theatreImage}
              alt={theatreName}
              fill
              priority
              className="object-cover object-center print:hidden"
              sizes="(max-width: 1280px) 100vw, 420px"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={theatreImage}
              alt={theatreName}
              loading="eager"
              className="absolute inset-0 hidden h-full w-full object-cover print:block"
            />
          </>
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-slate-200 to-slate-100" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent print:hidden" />
        <div className="absolute bottom-3 left-3 right-3 print:hidden">
          <p className="text-[11px] text-[#b7d5cf] font-semibold uppercase tracking-widest">
            Package
          </p>
          <h3 className="text-base font-bold text-white">{theatreName}</h3>
          <p className="text-xs text-white/80">{locationName}</p>
        </div>
      </div>
    </section>
  );
}
