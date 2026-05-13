"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { BOOKING_ROUTES } from "@/constants/routes";

export default function AboutHero() {
  return (
    <section className="relative overflow-hidden pb-12 pt-[150px] sm:pb-14 sm:pt-[170px] lg:pb-16 lg:pt-[190px]">
      <div className="absolute inset-0 pointer-events-none">
        <Image
          src="/media/site/about/havenretreat-1.webp"
          alt="Private theatre celebration at Haven Retreat"
          fill
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.5)_0%,rgba(0,0,0,0.4)_45%,rgba(0,0,0,0.58)_100%)]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-3 sm:px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-white leading-tight"
        >
          Creating Moments That Last a Lifetime
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-4 sm:mt-6 max-w-3xl mx-auto text-sm sm:text-base lg:text-lg text-white/90 leading-relaxed"
        >
          Haven Retreat is a premium private theatre experience designed
          for celebrations, surprises, and intimate moments. We combine
          cinema, comfort, and customization to turn special occasions into
          unforgettable memories.
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mt-3 sm:mt-4 text-xs sm:text-sm text-white/75"
        >
          Trusted by thousands of happy guests for proposals, birthdays,
          anniversaries, and private celebrations.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-7 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
        >
          <Link
            href={BOOKING_ROUTES.ROOT}
            className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 rounded-full bg-[#FFD700] text-black font-semibold text-sm sm:text-base hover:shadow-xl hover:shadow-[#FFD700]/35 transition-all"
          >
            Start Your Celebration
          </Link>

          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 rounded-full border border-white/70 text-white font-medium text-sm sm:text-base hover:bg-white/10 transition-all"
          >
            Talk to Our Team
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
