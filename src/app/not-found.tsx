"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, Home } from "lucide-react";
import { BOOKING_ROUTES } from "@/constants/routes";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#f6f8f7] px-4 py-8 text-[#101828] sm:px-6">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
        className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center text-center"
      >
        <Link href="/" aria-label="Haven Retreat home">
          <Image
            src="/assets/logo.png"
            alt="Haven Retreat"
            width={210}
            height={210}
            className="h-auto w-[210px]"
            priority
          />
        </Link>

        <Image
          src="/media/site/shared/404.svg"
          alt="A person searching for the right page"
          width={371}
          height={311}
          className="mt-5 h-auto w-full max-w-[210px]"
          priority
        />

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[#245e5b]">
          404 Error
        </p>
        <h1 className="mt-2 font-playfair text-3xl font-semibold leading-tight text-[#101828] sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-[#667085]">
          This page may have moved or expired. Continue your booking or return
          home to find the right place.
        </p>

        <div className="mt-7 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href={BOOKING_ROUTES.ROOT}
            className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#347f7c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#245e5b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#347f7c]"
          >
            <CalendarCheck size={16} aria-hidden="true" />
            Book Venue
          </Link>
          <Link
            href="https://havenretreatmiami.com/"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#d7e4e1] bg-white px-4 py-2.5 text-sm font-semibold text-[#245e5b] transition hover:bg-[#edf3f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#347f7c]"
          >
            <Home size={16} aria-hidden="true" />
            Home
          </Link>
        </div>
      </motion.section>
    </main>
  );
}
