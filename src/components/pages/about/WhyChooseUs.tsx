"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck,
  Sparkles,
  HeartHandshake,
  Film,
  PartyPopper,
  Clock,
} from "lucide-react";
import Image from "next/image";

const features = [
  {
    icon: Film,
    title: "Private Premium Theatres",
    desc: "Enjoy a completely private cinema experience designed for comfort, intimacy, and exclusivity.",
  },
  {
    icon: PartyPopper,
    title: "Celebration-First Experience",
    desc: "From birthdays to proposals, every setup is thoughtfully curated to match your occasion.",
  },
  {
    icon: Sparkles,
    title: "Personalized Touch",
    desc: "Customized LED messages, décor themes, and ambience that make your moment truly yours.",
  },
  {
    icon: HeartHandshake,
    title: "Warm & Professional Support",
    desc: "Our team handles everything seamlessly so you can focus on enjoying your celebration.",
  },
  {
    icon: ShieldCheck,
    title: "Hygiene & Quality Assured",
    desc: "Clean, comfortable spaces with high-quality food and refreshments you can trust.",
  },
  {
    icon: Clock,
    title: "Effortless Booking",
    desc: "Simple booking flow with quick confirmations and transparent pricing.",
  },
];

export default function WhyChooseUs() {
  return (
    <section className="bg-section-light py-0 sm:py-10 lg:py-[20px] lg:pb-[50px] overflow-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12 lg:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-black">
            Why Choose Haven Retreat
          </h2>
          <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base lg:text-lg">
            We combine privacy, personalization, and premium service to create
            celebrations that feel effortless and unforgettable.
          </p>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-16 items-center">

          {/* LEFT: Feature List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 lg:gap-8">
            {features.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="flex gap-3 sm:gap-4"
              >
                <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded-full bg-[#ECECEC] border border-[#D6D6D6] flex items-center justify-center">
                  <item.icon size={22} className="text-[#2A2A2E]" />
                </div>

                <div className="min-w-0">
                  <h3 className="font-semibold text-black text-sm sm:text-base">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-gray-600 text-xs sm:text-sm leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* RIGHT: Image Placeholder */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative w-full max-w-[560px] mx-auto lg:max-w-none"
          >
            <div className="relative w-full h-[260px] sm:h-[340px] lg:h-[420px] rounded-3xl overflow-hidden shadow-xl">
              <Image
                src="/media/site/home/reviews/life-of-paetoo/5.webp"
                alt="Premium private theatre celebration"
                fill
                className="object-cover"
              />
            </div>

            {/* Soft gold glow */}
            <div className="absolute -top-5 -left-5 w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-[#FFD700]/20 blur-2xl pointer-events-none" />
          </motion.div>

        </div>
      </div>
    </section>
  );
}
