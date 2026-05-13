"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { BOOKING_ROUTES } from "@/constants/routes";

export default function AboutCTA() {
  return (
    <section className="relative overflow-hidden py-8 sm:py-10 lg:py-14">
      {/* Celebration Background Image */}
      <div
        className="absolute inset-0 pointer-events-none bg-fixed bg-cover bg-center"
        style={{
          backgroundImage: "url('/media/site/shared/call-to-action-bg.webp')",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="absolute inset-0 bg-black/50" />
      </div>

      <div className="relative max-w-7xl mx-auto px-3 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="mx-auto max-w-3xl text-center"
        >
          {/* Small Eyebrow */}
          <p className="mb-2 sm:mb-3 text-[11px] sm:text-xs uppercase tracking-widest text-white/80">
            Your celebration, your way
          </p>

          {/* Headline */}
          <h2 className="text-[1.45rem] sm:text-[1.9rem] lg:text-[2.4rem] font-semibold text-white leading-tight">
            Turn Every Occasion Into
            <span className="block">a Lasting Memory</span>
          </h2>

          {/* Subtext */}
          <p className="mt-3 sm:mt-4 text-[13px] sm:text-sm lg:text-base text-white/85 leading-[1.5] sm:leading-relaxed">
            From intimate movie nights to once-in-a-lifetime surprises,
            Haven Retreat offers private theatre experiences designed
            around emotion, comfort, and thoughtful details.
          </p>

          {/* CTA Buttons */}
          <div className="mt-5 sm:mt-6 lg:mt-8 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 lg:gap-4">
            <Link
              href={BOOKING_ROUTES.ROOT}
              className="inline-flex items-center justify-center px-5 sm:px-6 lg:px-8 py-2.5 sm:py-3 lg:py-3 rounded-full bg-[#FFD700] text-black font-semibold text-[13px] sm:text-sm lg:text-base hover:shadow-xl hover:shadow-[#FFD700]/35 transition-all">
              Start Your Booking
            </Link>

            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-5 sm:px-6 lg:px-8 py-2.5 sm:py-3 lg:py-3 rounded-full border border-white/65 text-white font-medium text-[13px] sm:text-sm lg:text-base hover:bg-white/10 hover:border-white transition-all">
              Talk to Our Team
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
