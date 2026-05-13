"use client";

import Image from "next/image";

export default function AddOnsSection() {
  const addons = [
    {
      title: "Rose Heart Setup",
      description: "Romantic rose-heart floor styling for special moments.",
      img: "/media/site/home/sections/rose-heart-extra.webp",
    },
    {
      title: "LED Decoration",
      description: "Ambient LED decor to elevate your theatre atmosphere.",
      img: "/media/site/home/sections/led-decoration-extra.webp",
    },
    {
      title: "Candle Pathway",
      description: "A beautiful candle-entry path for grand arrival vibes.",
      img: "/media/site/home/sections/candel-path-extra.webp",
    },
    {
      title: "Fog Entry Effect",
      description: "Dramatic fog effect to make your entry unforgettable.",
      img: "/media/site/home/sections/fog-entry-extra.webp",
    },
  ];

  return (
    <section className="py-0 sm:py-10 bg-section-light">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Heading */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-black">
            Extra Decoration
          </h2>
          <p className="mt-3 text-gray-500 text-sm sm:text-base">
            Premium decoration upgrades to personalize your private theatre celebration.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-2  md:grid-cols-4 gap-2 sm:gap-4">
          {addons.map((addon, index) => (
            <div
              key={index}
              className="rounded-xl border border-gray-200 bg-white overflow-hidden"
            >
              {/* Image */}
              <div className="relative aspect-square overflow-hidden">
                <Image
                  src={addon.img}
                  alt={addon.title}
                  fill
                  className="object-cover"
                />
              </div>

              {/* Content */}
              <div className="px-3 sm:px-4 py-3">
                <h3 className="text-[18px] leading-[24px] sm:text-[22px] sm:leading-[30px] md:text-[24px] md:leading-[32px] font-semibold text-black mb-1">
                  {addon.title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-snug sm:leading-relaxed">
                  {addon.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
