"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function FoundersMessage() {
  return (
    <section className="bg-white py-11 sm:py-14 lg:py-[76px] overflow-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-16 items-center">

          {/* LEFT: Founder Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative"
          >
            <div className="relative w-full h-[300px] sm:h-[420px] lg:h-[520px] rounded-3xl overflow-hidden shadow-xl">
              <Image
                src="/media/site/about/havenretreat-logo-on-wall.webp"
                alt="Founder of Haven Retreat"
                fill
                className="object-cover"
              />
            </div>

            {/* Soft neutral glow */}
            <div className="absolute -bottom-5 -left-5 w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-[#ECECEC] blur-2xl pointer-events-none" />
          </motion.div>

          {/* RIGHT: Message */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-xl"
          >
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-[#111111]">
              A Note from the Founder
            </h2>

            <p className="mt-4 sm:mt-6 text-[#5F6368] text-sm sm:text-base lg:text-lg leading-relaxed">
              Haven Retreat was born from a simple thought — celebrations
              should feel personal, private, and thoughtfully created. I wanted
              to build a space where people could slow down, be present, and
              truly enjoy moments that matter.
            </p>

            <p className="mt-3 sm:mt-4 text-[#5F6368] text-sm sm:text-base lg:text-lg leading-relaxed">
              Every experience we design is guided by care, attention to detail,
              and respect for the emotions behind each celebration. From a
              quiet proposal to a joyful birthday surprise, our goal has always
              been the same — to make it feel effortless for you.
            </p>

            <p className="mt-3 sm:mt-4 text-[#5F6368] text-sm sm:text-base lg:text-lg leading-relaxed">
              Thank you for trusting us with your memories. It’s a privilege we
              never take lightly.
            </p>

            {/* Signature */}
            <div className="mt-6 sm:mt-8">
              <p className="text-[#111111] font-medium">
                — Founder, Haven Retreat
              </p>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
