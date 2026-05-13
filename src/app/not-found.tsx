"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import CurtainReveal from "@/components/pages/404/CurtainReveal";

const BRAND_COLOR = "#FCD308";

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-black p-4">
      <CurtainReveal />
      <div className="mx-auto bg-white flex min-h-[96vh] rounded-[30px] w-full  items-center justify-center px-4 py-4">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-lg text-center"
        >
          <div className="relative mx-auto mb-8 w-fit">
            <p
              aria-hidden="true"
              className="pointer-events-none select-none text-[clamp(10.5rem,48vw,22rem)] font-black leading-[0.78] tracking-[-0.08em] text-slate-900/[0.08]"
            >
              404
            </p>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.08, duration: 0.45 }}
              className="pointer-events-none absolute left-[52%] top-1/2 ml-[3px] w-[clamp(5.5rem,15vw,8.5rem)] -translate-x-1/2 -translate-y-[44%]"
            >
              <Image
                src="/media/site/shared/404.svg"
                alt="404 illustration"
                width={371}
                height={311}
                className="h-auto w-full"
                priority
              />
            </motion.div>
          </div>

          <h1 className="mb-2 text-3xl font-bold text-slate-900 md:text-4xl">Oops... This screen isn&apos;t available</h1>
          <p className="text-sm text-slate-600 md:text-base">
            Your celebration is still on. Pick a theatre and continue booking.
          </p>

          <div className="mx-auto mt-8 grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => router.push("/booking")}
              className="w-full cursor-pointer rounded-full px-6 py-3.5 text-base font-semibold text-slate-900 shadow-sm transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: BRAND_COLOR }}
            >
              Start New Booking
            </button>

            <button
              onClick={() => router.push("/")}
              className="w-full cursor-pointer rounded-full border border-slate-300 bg-white px-6 py-3.5 text-base font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
            >
              Back to Home
            </button>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
