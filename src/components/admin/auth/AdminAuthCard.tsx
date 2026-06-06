"use client";

import { motion } from "framer-motion";
import AdminLoginForm from "./AdminLoginForm";
import Image from "next/image";

export default function AdminAuthCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="flex w-full max-w-[460px] flex-col items-center"
    >
      {/* ========================= */}
      {/* Branding Section (Outside Card) */}
      {/* ========================= */}
      <div className="mb-7 text-center">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative mx-auto mb-5 h-28 w-40"
        >
          <Image
            src="/assets/logo.png"
            alt="Haven Retreat"
            fill
            sizes="160px"
            className="object-contain"
            priority
          />
        </motion.div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#347f7c]">
          Haven Retreat
        </p>

        <h1 className="font-playfair text-3xl font-semibold text-[#101828]">
          Welcome back
        </h1>

        <p className="mt-2 text-sm text-[#667085]">
          Sign in to manage reservations and operations.
        </p>
      </div>

      {/* ========================= */}
      {/* Login Card (Form Only) */}
      {/* ========================= */}
      <div className="w-full border border-[#cbded9] bg-white p-7 shadow-[0_24px_70px_rgba(30,73,69,0.14)] sm:p-9">
        <AdminLoginForm />
      </div>
    </motion.div>
  );
}
