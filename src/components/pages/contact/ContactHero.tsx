"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function ContactHero() {
  return (
    <section className="relative overflow-hidden pb-12 pt-[150px] sm:pb-14 sm:pt-[170px] lg:pb-16 lg:pt-[190px]">
      <div className="absolute inset-0 pointer-events-none">
        <Image
          src="/media/site/contact/niidhi-singh.webp"
          alt="Haven Retreat team support"
          fill
          priority
          className="object-cover object-[center_18%]"
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
          Let’s Plan Something Special
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-4 sm:mt-6 max-w-3xl mx-auto text-sm sm:text-base lg:text-lg text-white/90 leading-relaxed"
        >
          Whether you’re planning a celebration or need help with a booking,
          our team is here to guide you — quickly and personally.
        </motion.p>
      </div>
    </section>
  );
}
