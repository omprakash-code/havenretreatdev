"use client";

import {
  MapPin,
  Film,
  WandSparkles,
  Heart,
} from "lucide-react";
import { motion } from "framer-motion";
import { BOOKING_ROUTES } from "@/constants/routes";
import { HomeOutlineButton } from "@/components/ui/HomeButtons";

export default function HowItWorksSection() {
  const steps = [
    {
      icon: MapPin,
      title: "Choose Location & Date",
      description: "Select your city and preferred date for the celebration",
    },
    {
      icon: Film,
      title: "Pick Theatre & Slot",
      description: "Choose a private theatre and available time slot",
    },
    {
      icon: WandSparkles,
      title: "Customize Experience",
      description: "Add guests, decor, cakes & special moments",
    },
    {
      icon: Heart,
      title: "Pay & Celebrate",
      description: "Confirm booking and enjoy your private screening",
    },
  ];

  return (
    <section className="relative py-4 sm:py-10 lg:py-10 bg-section-light overflow-hidden">
      {/* ✨ Animated Sparkle Background */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0.6 }}
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 6, repeat: Infinity }}
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(255,215,0,0.25), transparent 40%),
            radial-gradient(circle at 80% 20%, rgba(255,215,0,0.2), transparent 45%),
            radial-gradient(circle at 50% 80%, rgba(255,215,0,0.18), transparent 50%)
          `,
        }}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 relative">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-5 sm:mb-13">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-black">
            How It Works
          </h2>
          <p className="mt-3 sm:mt-4 text-sm sm:text-base md:text-lg text-gray-600">
            Book your private theatre experience in just a few easy steps
          </p>
        </div>

        {/* Desktop + Tablet Horizontal Flow */}
        <div className="hidden md:block relative">
          {/* Gold Flow Line */}
          <div className="absolute top-12 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#FFD700] to-transparent" />

          <div className="grid grid-cols-4 gap-12">
            {steps.map((step, index) => (
              <div key={index} className="text-center relative">
                {/* Icon Orb */}
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFD700] flex items-center justify-center mx-auto shadow-xl shadow-[#FFD700]/35 mb-6 relative z-10">
                  <step.icon size={34} className="text-black" />
                </div>

                <h3 className="text-xl font-bold text-black mb-3">
                  {step.title}
                </h3>
                <p className="text-gray-600 max-w-xs mx-auto">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Vertical Flow */}
        <div className="md:hidden relative space-y-10 sm:space-y-14">
          {/* Vertical Line */}
          <div className="absolute left-5 sm:left-6 top-0 bottom-0 w-[3px] bg-gradient-to-b from-transparent via-[#FFD700] to-transparent" />

          {steps.map((step, index) => (
            <div key={index} className="flex gap-4 sm:gap-6 items-start relative">
              <div className="size-11 sm:size-12 min-w-11 sm:min-w-12 shrink-0 aspect-square rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFD700] flex items-center justify-center shadow-md shadow-[#FFD700]/35 relative z-10">
                <step.icon size={22} className="text-black" />
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold text-black mb-1">
                  {step.title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Booking Message */}
        <div className="mt-12 sm:mt-20 text-center">
          <HomeOutlineButton
            href={BOOKING_ROUTES.ROOT}
            leadingIcon={<WandSparkles className="text-[#FFD700]" size={20} />}
            className="px-5 sm:px-6 py-2.5 sm:py-3 bg-white border-[#FFD700]/35 text-black text-sm sm:text-base shadow-md hover:shadow-lg"
          >
            Confirm booking with just ₹750
          </HomeOutlineButton>
        </div>

      </div>
    </section>
  );
}
