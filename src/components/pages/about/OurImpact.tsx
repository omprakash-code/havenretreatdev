"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  PartyPopper,
  Film,
  Star,
  MapPin,
} from "lucide-react";

/* ---------- Counter ---------- */
function Counter({
  to,
  decimals = 0,
  suffix = "",
  duration = 1200,
}: {
  to: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;

    const startTime = performance.now();

    const animate = (time: number) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const current = to * progress;
      setValue(Number(current.toFixed(decimals)));

      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [inView, to, decimals, duration]);

  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  );
}

/* ---------- Data ---------- */
const impact = [
  {
    icon: PartyPopper,
    label: "Celebrations Curated",
    value: 3500,
    suffix: "+",
    note: "Birthdays, proposals, anniversaries & surprises",
  },
  {
    icon: Film,
    label: "Private Screenings Hosted",
    value: 5000,
    suffix: "+",
    note: "Intimate, distraction-free cinema experiences",
  },
  {
    icon: Star,
    label: "Average Guest Rating",
    value: 4.9,
    decimals: 1,
    suffix: " / 5",
    note: "Based on verified Google reviews",
  },
  {
    icon: MapPin,
    label: "Cities Served",
    value: 1,
    suffix: "+",
    note: "Expanding carefully while maintaining quality",
  },
];

export default function OurImpactLight() {
  return (
    <section className="bg-[#FAFAF8] py-11 sm:py-8 lg:py-[50px]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">

        {/* Header */}
        <div className="max-w-3xl mb-10 sm:mb-12 lg:mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-[#111111]"
          >
            Our Impact, Built with Care
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-[#5F6368] text-sm sm:text-base lg:text-lg leading-relaxed"
          >
            These numbers represent real people trusting us with their most
            meaningful celebrations — each one handled with intention and care.
          </motion.p>
        </div>

        {/* Impact Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-10">
          {impact.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="relative"
            >
              {/* Icon */}
              <div
                className="mb-4 sm:mb-6 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#ECECEC] border border-[#D6D6D6] flex items-center justify-center"
              >
                <item.icon size={22} className="text-[#2A2A2E]" />
              </div>


              {/* Label */}
              <p className="text-[#5F6368] text-xs sm:text-sm uppercase tracking-wide">
                {item.label}
              </p>

              {/* Value */}
              <p className="mt-2 sm:mt-3 text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#111111]">
                <Counter
                  to={item.value}
                  decimals={item.decimals ?? 0}
                  suffix={item.suffix}
                />
              </p>

              {/* Note */}
              <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-[#8B8F9A] leading-relaxed">
                {item.note}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
