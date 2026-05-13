"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

export default function GalleryHero() {
  return (
    <section className="relative overflow-hidden pb-12 pt-[150px] sm:pb-14 sm:pt-[170px] lg:pb-16 lg:pt-[190px]">
      <div className="absolute inset-0 pointer-events-none">
        <Image
          src="/media/site/home/reviews/satinderjit-kaur/2.webp"
          alt="Private theatre setup with decor and projection screen"
          fill
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.5)_0%,rgba(0,0,0,0.4)_45%,rgba(0,0,0,0.58)_100%)]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-3 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs sm:text-sm font-semibold tracking-[0.18em] text-[#FFD700]/95 uppercase">
            Private Theatre Gallery
          </p>

          <h1 className="mt-3 text-3xl leading-tight sm:text-4xl lg:text-5xl text-white font-semibold">
            Real Celebrations Inside
            <span className="block text-[#FFD700]">Your Private Theatre</span>
          </h1>

          <p className="mt-4 sm:mt-6 max-w-3xl mx-auto text-sm sm:text-base lg:text-lg text-white/90 leading-relaxed">
            Explore birthday surprises, romantic date nights, proposals, and
            custom events hosted in our private cinema spaces with premium
            screen, sound, and decor.
          </p>

          <ul className="mt-5 sm:mt-6 space-y-2 text-sm sm:text-base text-white/95">
            <li className="flex items-center justify-center gap-2">
              <span className="text-[#FFD700]">•</span>
              <span>100% private screening experience</span>
            </li>
            <li className="flex items-center justify-center gap-2">
              <span className="text-[#FFD700]">•</span>
              <span>Decor, cakes, and add-ons available</span>
            </li>
          </ul>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/booking"
              className="rounded-full bg-[#FFD700] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#FFD700]/30"
            >
              Book Your Slot
            </Link>
            <Link
              href="/contact"
              className="rounded-full border border-white/40 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Plan Custom Event
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
