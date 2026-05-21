"use client";

export default function AgreementSection({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <section className="border-b border-[#edf1ef] py-4 last:border-b-0">
      <p className="text-[10px] font-semibold tracking-[0.16em] text-[#7b7f85] uppercase">
        {eyebrow}
      </p>
      <h3 className="mt-1.5 text-[13px] font-semibold text-[#1f2937]">
        {title}
      </h3>
      <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-[#475467]">
        {body}
      </p>
    </section>
  );
}
