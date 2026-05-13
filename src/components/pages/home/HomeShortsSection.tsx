"use client";

import Script from "next/script";
import { Splide, SplideSlide } from "@splidejs/react-splide";
import { useEffect, useRef } from "react";
import type { ElementType } from "react";

type ReelItem = {
  id: string;
};

const reels: ReelItem[] = [
  { id: "qzgmSsffle4" },
  { id: "RPHpJHs2QnY" },
  { id: "vFtryYj1IFU" },
  { id: "xGjATFfaJW0" },
  { id: "rO8TdoG0Fj8" },
  { id: "h0v8C1TvUdU" },
  { id: "Vl_OzlOEb_8" },
  { id: "_twDwB75YO8" },
  { id: "uVvUtimT_wc" },
];

const LiteYouTube = "lite-youtube" as ElementType;

function buildVideoParams(videoId: string, autoplay: boolean) {
  const query = new URLSearchParams({
    rel: "0",
    playsinline: "1",
    modestbranding: "1",
    controls: "1",
    mute: "1",
    loop: "1",
    playlist: videoId,
  });

  if (autoplay) {
    query.set("autoplay", "1");
  }

  return query.toString();
}

export default function HomeShortsSection() {
  const firstVideoRef = useRef<HTMLElement | null>(null);
  const firstAutoPlayStartedRef = useRef(false);
  const firstAutoPlayTimerRef = useRef<number | null>(null);

  const scheduleFirstAutoplay = () => {
    if (typeof window === "undefined") return;
    if (firstAutoPlayStartedRef.current) return;
    const firstVideo = firstVideoRef.current;
    if (!firstVideo) return;

    if (firstAutoPlayTimerRef.current !== null) {
      window.clearTimeout(firstAutoPlayTimerRef.current);
    }

    firstAutoPlayTimerRef.current = window.setTimeout(() => {
      firstVideo.click();
      firstAutoPlayStartedRef.current = true;
    }, 250);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.customElements.get("lite-youtube")) {
      scheduleFirstAutoplay();
    }
    return () => {
      if (firstAutoPlayTimerRef.current !== null) {
        window.clearTimeout(firstAutoPlayTimerRef.current);
      }
    };
  }, []);

  return (
    <section className="bg-section-light px-3 py-10 sm:px-6 sm:py-12">
      <Script
        src="https://cdn.jsdelivr.net/npm/lite-youtube-embed@0.3.3/src/lite-yt-embed.js"
        strategy="afterInteractive"
        onLoad={scheduleFirstAutoplay}
      />

      <div className="mx-auto max-w-7xl">
        <div className="mb-5 text-center sm:mb-8">
          <h2 className="text-2xl font-bold text-black sm:text-3xl md:text-4xl">
            A Look Inside Haven Retreat
          </h2>
          <p className="mt-2 text-sm text-gray-600 sm:text-base">
            Watch quick highlights from real celebrations in our private theatres.
          </p>
        </div>

        <div className="home-shorts-carousel pb-8 sm:pb-10">
          <Splide
            options={{
              mediaQuery: "max",
              type: "slide",
              perPage: 4,
              perMove: 1,
              gap: "1rem",
              arrows: true,
              pagination: true,
              drag: true,
              padding: { left: "0.75rem", right: "0.75rem" },
              breakpoints: {
                1280: {
                  perPage: 3,
                },
                1024: {
                  perPage: 2,
                  gap: "0.875rem",
                },
                768: {
                  perPage: 1.1,
                  focus: 0,
                  gap: "0.75rem",
                  trimSpace: false,
                  padding: { left: "0.5rem", right: "0.5rem" },
                },
              },
            }}
            aria-label="Haven Retreat celebration videos"
          >
            {reels.map((reel, index) => (
              <SplideSlide key={reel.id}>
                <article className="overflow-hidden rounded-2xl border border-2 border-slate-700 bg-white">
                  <div className="relative aspect-[9/16] overflow-hidden rounded-1xl bg-slate-800">
                    <LiteYouTube
                      videoid={reel.id}
                      nocookie="true"
                      playlabel="Play video"
                      params={
                        index === 0
                          ? buildVideoParams(reel.id, true)
                          : buildVideoParams(reel.id, false)
                      }
                      className="home-shorts-lite"
                      ref={(el: HTMLElement | null) => {
                        if (index === 0) {
                          firstVideoRef.current = el;
                        }
                      }}
                    />
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
