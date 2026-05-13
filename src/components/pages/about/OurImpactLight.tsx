"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type CounterProps = {
  to: number;
  suffix?: string;
  duration?: number;
};

function Counter({ to, suffix = "", duration = 1200 }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;

    let start = 0;
    const increment = Math.ceil(to / (duration / 16));

    const timer = setInterval(() => {
      start += increment;
      if (start >= to) {
        setValue(to);
        clearInterval(timer);
      } else {
        setValue(start);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [inView, to, duration]);

  return (
    <span ref={ref}>
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}

export default function OurImpactLight() {
  return (
    <section className="bg-[#FAFAF8] py-28">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <div className="max-w-3xl mb-20">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-semibold text-[#111111]"
          >
            Measured by Moments, Not Just Numbers
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-[#5F6368] text-lg leading-relaxed"
          >
            Every celebration we host represents trust. These numbers reflect
            years of creating private, meaningful experiences — one guest at a
            time.
          </motion.p>
        </div>

        {/* Impact Rows */}
        <div className="divide-y divide-[#E6E6E3]">

          {/* Row 1 */}
          <div className="py-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            <p className="text-[#5F6368] uppercase tracking-wide text-sm">
              Celebrations Curated
            </p>
            <p className="text-5xl font-semibold text-[#111111]">
              <Counter to={3500} suffix="+" />
            </p>
            <p className="text-[#8B8F9A] text-sm">
              Birthdays, proposals, anniversaries & private surprises
            </p>
          </div>

          {/* Row 2 */}
          <div className="py-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            <p className="text-[#5F6368] uppercase tracking-wide text-sm">
              Private Screenings Hosted
            </p>
            <p className="text-5xl font-semibold text-[#111111]">
              <Counter to={5000} suffix="+" />
            </p>
            <p className="text-[#8B8F9A] text-sm">
              Fully private, distraction-free cinema experiences
            </p>
          </div>

          {/* Row 3 */}
          <div className="py-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            <p className="text-[#5F6368] uppercase tracking-wide text-sm">
              Average Guest Rating
            </p>
            <p className="text-5xl font-semibold text-[#111111]">
              <Counter to={49} suffix="/5" />
            </p>
            <p className="text-[#8B8F9A] text-sm">
              Based on consistent 5-star guest feedback
            </p>
          </div>

          {/* Row 4 */}
          <div className="py-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            <p className="text-[#5F6368] uppercase tracking-wide text-sm">
              Cities Served
            </p>
            <p className="text-5xl font-semibold text-[#111111]">
              Multiple
            </p>
            <p className="text-[#8B8F9A] text-sm">
              Expanding carefully while maintaining quality
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
