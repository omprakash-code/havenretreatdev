"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BOOKING_ROUTES } from "@/constants/routes";
import { HomePrimaryButton } from "@/components/ui/HomeButtons";
import HeroFloatingContacts from "@/components/pages/home/HeroFloatingContacts";

export default function HeroSection() {
  const heroBackgroundImages = [
    "/media/site/home/hero/ANMC3603.avif",
    "/media/site/home/hero/ANMC3885.avif",
    "/media/site/home/hero/candel-pathANMC3778.avif",
    "/media/site/home/hero/happy-birthday-decor.avif",
    "/media/site/home/hero/hero-background-1.jpg",
  ];

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveImageIndex((prevIndex) => (prevIndex + 1) % heroBackgroundImages.length);
    }, 4200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [heroBackgroundImages.length]);

  const stripItems = [
    "Food & Drink",
    "Photography",
    "Birthday",
    "Anniversary",
    "Date Night",
    "Proposal",
    "Bride To Be",
    "Farewell",
    "Decoration",
    "Celebration",
  ];

  return (
    <section className="relative min-h-[88svh] sm:min-h-screen flex items-center justify-center overflow-hidden bg-white pt-[72px] sm:pt-[80px]">
      
      {/* Background Image Carousel */}
      <div className="absolute inset-0 z-0">
        {heroBackgroundImages.map((imageSrc, index) => (
          <Image
            key={imageSrc}
            src={imageSrc}
            alt={`Private Theatre Celebration ${index + 1}`}
            fill
            priority={index === 0}
            className={`object-cover transition-opacity duration-[1200ms] ease-in-out ${
              activeImageIndex === index ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        {/* Header readability gradient (top -> bottom, ~300px) */}
        <div className="absolute inset-x-0 top-0 h-[300px] bg-gradient-to-b from-black/60 via-black/28 to-transparent" />
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-3 sm:px-6 md:px-8">
        <div className="relative mx-auto max-w-[480px] overflow-hidden rounded-2xl border border-white/30 bg-white/12 text-center shadow-[0_18px_48px_rgba(0,0,0,0.38)] backdrop-blur-sm  px-3 py-4 pb-6 md:pb-8 sm:px-4 sm:py-5 md:max-w-[600px] md:px-6 md:py-6 lg:max-w-[760px]">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-black/40 to-black/30" />
          <div className="relative">

            {/* Heading */}
            <h1 className="hero-big-title mb-2 font-bold leading-tight text-[1.7rem] drop-shadow-[0_3px_12px_rgba(0,0,0,0.85)] sm:text-4xl md:text-5xl"
            >
              Celebrate in Your Private Theatre
            </h1>

            {/* Description */}
            <p className="mx-auto mb-4 max-w-2xl text-sm text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] sm:mb-5 sm:text-base md:text-lg">
              Luxury private cinema moments, crafted for celebrations.
              <span className="block mt-0.5">
                Birthdays, anniversaries, proposals and date nights in a premium private screening room.
              </span>
            </p>

            {/* Actions */}
            <div className="flex items-center justify-center">

              {/* Book Button */}
              <HomePrimaryButton
                href={BOOKING_ROUTES.ROOT}
                className="w-[240px] sm:w-[270px] px-5 py-3 md:py-2.5 lg:py-3 font-semibold text-md whitespace-nowrap"
              >
                Book Your Private Theatre
              </HomePrimaryButton>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-scrolling strip */}
      <div className="hero-bottom-strip z-20 pointer-events-none">
        <div className="hero-bottom-strip__track">
          {[0, 1].map((copyIndex) => (
            <div className="hero-bottom-strip__group" key={copyIndex}>
              {stripItems.map((item, itemIndex) => (
                <div
                  className="hero-bottom-strip__chunk"
                  key={`${copyIndex}-${item}-${itemIndex}`}
                >
                  <span className="hero-bottom-strip__item">{item}</span>
                  <span className="hero-bottom-strip__dot">✦</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <HeroFloatingContacts />
    </section>
  );
}
