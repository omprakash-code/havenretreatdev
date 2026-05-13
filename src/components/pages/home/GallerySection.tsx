"use client";

import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "@/components/icons/index";
import { useState, useRef } from "react";

export default function GallerySection() {
  const images = [
    {
      src: "https://storage.googleapis.com/uxpilot-auth.appspot.com/6c41deb60a-c56e39e95aabfb6c62f7.png",
      alt: "Birthday celebration in private theatre",
    },
    {
      src: "https://storage.googleapis.com/uxpilot-auth.appspot.com/fc47ac11ae-9d150e76403cd53861ea.png",
      alt: "Romantic anniversary setup",
    },
    {
      src: "https://storage.googleapis.com/uxpilot-auth.appspot.com/38356db480-62f7909c6ed1deeffedb.png",
      alt: "Surprise proposal in private cinema",
    },
    {
      src: "https://storage.googleapis.com/uxpilot-auth.appspot.com/fb1769b41e-21ea08f4345a99ec52e4.png",
      alt: "Luxury private theatre interior",
    },
    {
      src: "https://storage.googleapis.com/uxpilot-auth.appspot.com/6becf2f266-5df51f251b6ecd3a367f.png",
      alt: "Family movie night experience",
    },
    {
      src: "https://storage.googleapis.com/uxpilot-auth.appspot.com/e9ee63bc95-d0f250fc54bfbad7b56b.png",
      alt: "Cake cutting celebration",
    },
    {
      src: "https://storage.googleapis.com/uxpilot-auth.appspot.com/2d9ab76e86-1092e8898d4aade8bdf4.png",
      alt: "Friends celebrating together",
    },
    {
      src: "https://storage.googleapis.com/uxpilot-auth.appspot.com/d78c5d06ee-0c085a0cf3a38debb90e.png",
      alt: "Premium theatre seating setup",
    },
  ];

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const close = () => setActiveIndex(null);

  const next = () =>
    setActiveIndex((i) => (i! + 1) % images.length);

  const prev = () =>
    setActiveIndex((i) => (i! - 1 + images.length) % images.length);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartX.current) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50) next();
    if (diff < -50) prev();
    touchStartX.current = null;
  };

  return (
    <section className="py-8 sm:py-10 bg-section-light">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Heading */}
        <div className="text-center max-w-2xl mx-auto mb-4 sm:mb-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-black">
            Experience Gallery
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-500">
            A glimpse into unforgettable private theatre moments
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
          {images.map((img, index) => (
            <div
              key={index}
              onClick={() => setActiveIndex(index)}
              className="group cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white hover:shadow-xl transition"
            >
              <Image
                src={img.src}
                alt={img.alt}
                width={500}
                height={350}
                className="h-32 sm:h-56 w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {activeIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"
          onClick={close}
        >
          <button
            onClick={close}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/70 hover:text-white"
          >
            <X size={28} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-2 sm:left-6 text-white/70 hover:text-white"
          >
            <ChevronLeft size={36} />
          </button>

          <div
            className="max-w-5xl w-full px-4 sm:px-6"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <Image
              src={images[activeIndex].src}
              alt={images[activeIndex].alt}
              width={1600}
              height={1000}
              className="w-full max-h-[80vh] object-contain rounded-xl"
            />
            <p className="mt-4 text-center text-sm text-gray-300">
              {images[activeIndex].alt}
            </p>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-2 sm:right-6 text-white/70 hover:text-white"
          >
            <ChevronRight size={36} />
          </button>
        </div>
      )}
    </section>
  );
}
