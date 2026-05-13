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
      className="w-full max-w-md flex flex-col items-center"
    >
      {/* ========================= */}
      {/* Branding Section (Outside Card) */}
      {/* ========================= */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative w-20 h-20 mx-auto mb-4"
        >
          <Image
            src="/assets/logo.png"
            alt="Haven Retreat"
            fill
            sizes="80px"
            className="object-contain"
            priority
          />
        </motion.div>

        <h1 className="text-2xl font-semibold text-white">
          Admin Portal
        </h1>

        <p className="text-sm text-gray-400 mt-2">
          Secure access to booking management
        </p>
      </div>

      {/* ========================= */}
      {/* Login Card (Form Only) */}
      {/* ========================= */}
      <div className="w-full bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-8">
        <AdminLoginForm />
      </div>
    </motion.div>
  );
}
