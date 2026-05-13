"use client";

import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import type { ReactNode } from "react";
import { trackMetaCtaClick } from "@/lib/meta/browser";

type HomeButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  target?: string;
  rel?: string;
  leadingIcon?: ReactNode;
  showArrow?: boolean;
  type?: "button" | "submit" | "reset";
  trackingName?: string;
  trackingLocation?: string;
  trackingDestination?: string;
};

function ButtonContent({
  children,
  leadingIcon,
  showArrow = true,
}: Pick<HomeButtonProps, "children" | "leadingIcon" | "showArrow">) {
  return (
    <>
      {leadingIcon ? (
        <span className="mr-2 inline-flex items-center">{leadingIcon}</span>
      ) : null}
      <span>{children}</span>
      {showArrow ? (
        <ArrowRight
          size={18}
          className="ml-0 w-0 opacity-0 overflow-hidden transition-all duration-200 group-hover:ml-2 group-hover:w-[18px] group-hover:opacity-100"
        />
      ) : null}
    </>
  );
}

function classes(base: string, custom?: string) {
  return custom ? `${base} ${custom}` : base;
}

export function HomePrimaryButton({
  children,
  href,
  onClick,
  className,
  target,
  rel,
  leadingIcon,
  showArrow = true,
  type = "button",
  trackingName,
  trackingLocation,
  trackingDestination,
}: HomeButtonProps) {
  const base =
    "group inline-flex items-center justify-center rounded-full bg-[#FFD700] text-black font-semibold transition-all hover:shadow-xl hover:shadow-[#FFD700]/35";
  const merged = classes(base, className);
  const handleClick = () => {
    if (trackingName && trackingLocation) {
      trackMetaCtaClick({
        ctaName: trackingName,
        ctaLocation: trackingLocation,
        destination: trackingDestination ?? href,
      });
    }
    onClick?.();
  };

  if (href) {
    return (
      <Link href={href} target={target} rel={rel} onClick={handleClick} className={merged}>
        <ButtonContent leadingIcon={leadingIcon} showArrow={showArrow}>
          {children}
        </ButtonContent>
      </Link>
    );
  }

  return (
    <button type={type} onClick={handleClick} className={merged}>
      <ButtonContent leadingIcon={leadingIcon} showArrow={showArrow}>
        {children}
      </ButtonContent>
    </button>
  );
}

export function HomeOutlineButton({
  children,
  href,
  onClick,
  className,
  target,
  rel,
  leadingIcon,
  showArrow = true,
  type = "button",
  trackingName,
  trackingLocation,
  trackingDestination,
}: HomeButtonProps) {
  const base =
    "group inline-flex items-center justify-center rounded-full border-1 border-[#C9CCD6] bg-transparent font-semibold transition-all hover:bg-[#FFD700] hover:text-black hover:border-[#FFD700]";
  const merged = classes(base, className);
  const handleClick = () => {
    if (trackingName && trackingLocation) {
      trackMetaCtaClick({
        ctaName: trackingName,
        ctaLocation: trackingLocation,
        destination: trackingDestination ?? href,
      });
    }
    onClick?.();
  };

  if (href) {
    return (
      <Link href={href} target={target} rel={rel} onClick={handleClick} className={merged}>
        <ButtonContent leadingIcon={leadingIcon} showArrow={showArrow}>
          {children}
        </ButtonContent>
      </Link>
    );
  }

  return (
    <button type={type} onClick={handleClick} className={merged}>
      <ButtonContent leadingIcon={leadingIcon} showArrow={showArrow}>
        {children}
      </ButtonContent>
    </button>
  );
}
