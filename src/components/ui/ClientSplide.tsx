"use client";

import dynamic from "next/dynamic";
import type { ComponentType, PropsWithChildren } from "react";

/* -------------------------------------------
   Minimal safe prop definitions
------------------------------------------- */

type SplideBaseProps = {
  className?: string;
  options?: Record<string, unknown>;
};

type SplideSlideBaseProps = {
  className?: string;
};

/* -------------------------------------------
   Client-only Splide wrappers
------------------------------------------- */

export const ClientSplide = dynamic(
  () =>
    import("@splidejs/react-splide").then(
      (mod) =>
        mod.Splide as ComponentType<PropsWithChildren<SplideBaseProps>>
    ),
  { ssr: false }
);

export const ClientSplideSlide = dynamic(
  () =>
    import("@splidejs/react-splide").then(
      (mod) =>
        mod.SplideSlide as ComponentType<
          PropsWithChildren<SplideSlideBaseProps>
        >
    ),
  { ssr: false }
);
