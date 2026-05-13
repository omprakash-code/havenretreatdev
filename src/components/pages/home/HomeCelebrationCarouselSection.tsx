"use client";

import Image from "next/image";
import { Splide, SplideSlide } from "@splidejs/react-splide";

const slides = [
  {
    code: "001",
    label: "Floral Styling",
    title: "BOUQUET",
    image: "/media/site/home/sections/bouquet.jpg",
    alt: "Bouquet add-on for private theatre celebrations",
  },
  {
    code: "002",
    label: "Private Screening",
    title: "BIRTHDAY",
    image: "/media/site/home/sections/private-screening.webp",
    alt: "Private screening celebration setup",
  },
  {
    code: "003",
    label: "Captured Memories",
    title: "PHOTOSHOOT",
    image: "/media/site/home/sections/photoshoot.webp",
    alt: "Couple photoshoot in private theatre",
  },
  {
    code: "004",
    label: "Premium Styling",
    title: "DECOR",
    image: "/media/site/home/sections/decoration.webp",
    alt: "Decorated private theatre experience",
  },
  {
    code: "005",
    label: "Sweet Celebrations",
    title: "CAKE",
    image: "/media/site/home/sections/cake.webp",
    alt: "Celebration cake add-on",
  },
  {
    code: "006",
    label: "Thoughtful Moments",
    title: "GIFTS",
    image: "/media/site/home/sections/gits.webp",
    alt: "Gift add-ons for celebrations",
  },
];

export default function HomeCelebrationCarouselSection() {
  return (
    <section className="bg-[#f8f5ef] px-3 py-10 sm:px-6 sm:py-12 lg:py-14">
      <div className="relative max-w-[1680px] mx-auto">
        <div className="mb-5 text-center sm:mb-6">
          <h2 className="text-2xl font-bold text-black sm:text-3xl md:text-4xl">
            Our Services
          </h2>
        </div>

        <div
          id="home-celebration-carousel"
          className="relative overflow-hidden rounded-[5px] border-y border-black/10 bg-[#ffffff] px-6 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-9"
        >
          <div
            aria-hidden
            className="home-celebration-carousel__perforation home-celebration-carousel__perforation--left"
          />
          <div
            aria-hidden
            className="home-celebration-carousel__perforation home-celebration-carousel__perforation--right"
          />

          <Splide
            options={{
              type: "loop",
              rewind: false,
              perPage: 4,
              perMove: 1,
              gap: "1rem",
              arrows: true,
              pagination: true,
              speed: 700,
              autoplay: true,
              interval: 3200,
              pauseOnHover: true,
              pauseOnFocus: true,
              breakpoints: {
                1400: { perPage: 3, gap: "0.9rem" },
                1024: { perPage: 2, gap: "0.85rem" },
                768: { perPage: 1, gap: "0.75rem", arrows: true },
              },
            }}
          >
            {slides.map((slide) => (
              <SplideSlide key={slide.code}>
                <article className="flex h-full flex-col">
                  <header className="mb-2 flex items-center justify-between gap-3 text-[12px] tracking-[0.03em] text-black/75 sm:text-[14px]">
                    <span className="font-mono">[{slide.code}</span>
                    <span className="truncate text-right font-mono">{slide.label}]</span>
                  </header>

                  <div className="relative aspect-square overflow-hidden bg-black">
                    <Image
                      src={slide.image}
                      alt={slide.alt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-center">
                    <h3 className="text-center font-sans text-[18px] font-semibold leading-none tracking-[0.04em] text-black sm:text-[22px]">
                      {slide.title}
                    </h3>
                  </div>
                </article>
              </SplideSlide>
            ))}
          </Splide>
        </div>
      </div>
    </section>
  );
}
