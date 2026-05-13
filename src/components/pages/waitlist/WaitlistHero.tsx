"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function WaitlistHero() {
  return (
    <section className="relative overflow-hidden bg-[#F3F4F6] pb-11 pt-[150px] sm:pb-14 lg:pb-20 lg:pt-[180px]">
      <div className="absolute inset-0 pointer-events-none">
        <Image
          src="/media/site/waitlist/151067070.avif"
          alt="Waitlist hero background"
          fill
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/50" />
      </div>

      <div className="relative max-w-4xl mx-auto px-3 sm:px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-white"
        >
          Join the Waitlist
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-4 sm:mt-6 max-w-3xl mx-auto text-sm sm:text-base lg:text-lg text-white/90 leading-relaxed"
        >
          If your preferred slot is unavailable or you have a special request,
          leave your details here. Our team will reach out as soon as we can
          accommodate you.
        </motion.p>
      </div>
    </section>
  );
}
