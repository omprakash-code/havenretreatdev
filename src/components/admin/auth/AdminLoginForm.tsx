"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Lock, Eye, EyeOff, Shield, Loader2 } from "lucide-react";

export default function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /* -----------------------------
     Autofocus Phone 
  ------------------------------ */
  useEffect(() => {
    phoneInputRef.current?.focus();
  }, []);

  /* -----------------------------
     Capture Secure Error Code (?e=)
  ------------------------------ */
  useEffect(() => {
    const code = searchParams.get("e");

    if (!code) return;

    const errorMap: Record<string, string> = {
      INV: "Invalid credentials.",
      LOCK: "Account temporarily locked. Please try later.",
      RATE: "Too many login attempts. Please wait.",
      SYS: "Authentication failed. Please try again.",
    };

    if (errorMap[code]) {
      setError(errorMap[code]);
    } else {
      setError("Authentication failed.");
    }
  }, [searchParams]);


  /* -----------------------------
     Submit Handler
  ------------------------------ */
  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    e.preventDefault();

    if (isLoading) return;

    setError(null);
    setIsLoading(true);

    try {
      const formData = new FormData(e.currentTarget);

      const res = await fetch("/api/admin/login", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (res.ok) {
        await fetch("/api/admin/session", {
          credentials: "include",
          cache: "no-store",
        });

        router.replace("/admin");
        router.refresh();
        return;
      }

      // Error handling
      let message = "Authentication failed.";

      try {
        const data = await res.json();
        if (data?.message) {
          message = data.message;
        }
      } catch {
        // ignore
      }

      switch (res.status) {
        case 400:
          message = "Phone and password are required.";
          break;
        case 401:
          message = "Invalid credentials.";
          break;
        case 403:
          message = "Account temporarily locked.";
          break;
        case 429:
          message = "Too many login attempts. Please wait.";
          break;
      }

      setError(message);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  }
  return (
    <form
      onSubmit={handleSubmit}
      method="POST"
      autoComplete="on"
      className="space-y-5"
    >
      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phone */}
      <div>
        <label
          htmlFor="phone"
          className="mb-2 block text-sm font-semibold text-[#344054]"
        >
          Phone Number
        </label>

        <div className="relative">
          <Phone
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#347f7c]"
          />

          <input
            ref={phoneInputRef}
            id="phone"
            name="phone"
            type="tel"
            autoComplete="username"
            required
            disabled={isLoading}
            placeholder="Enter your phone number"
            className="h-12 w-full border border-[#d0d5dd] bg-[#fbfcfc] pl-11 pr-4 text-[#101828] outline-none transition placeholder:text-[#98a2b3] hover:border-[#a8c7c2] focus:border-[#347f7c] focus:bg-white focus:ring-1 focus:ring-[#347f7c]/15 disabled:opacity-50"
          />
        </div>
      </div>


      {/* Password */}
      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-semibold text-[#344054]"
        >
          Password
        </label>

        <div className="relative">
          <Lock
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#347f7c]"
          />

          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={isLoading}
            placeholder="Enter your password"
            className="h-12 w-full border border-[#d0d5dd] bg-[#fbfcfc] pl-11 pr-12 text-[#101828] outline-none transition placeholder:text-[#98a2b3] hover:border-[#a8c7c2] focus:border-[#347f7c] focus:bg-white focus:ring-1 focus:ring-[#347f7c]/15 disabled:opacity-50"
          />

          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            disabled={isLoading}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer text-[#667085] transition hover:text-[#347f7c] disabled:opacity-50"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {/* Submit */}
      <motion.button
        type="submit"
        disabled={isLoading}
        whileHover={!isLoading ? { scale: 1.02 } : {}}
        whileTap={!isLoading ? { scale: 0.98 } : {}}
        className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 bg-[#347f7c] font-semibold text-white shadow-[0_12px_28px_rgba(52,127,124,0.22)] transition hover:bg-[#286c69] disabled:cursor-not-allowed disabled:bg-[#98a2b3] disabled:shadow-none"
      >
        {isLoading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Signing In...
          </>
        ) : (
          "Sign In Securely"
        )}
      </motion.button>

      {/* Security Badge */}
      <div className="flex items-center justify-center gap-2 border-t border-[#eaecf0] pt-4 text-xs text-[#667085]">
        <Shield size={14} />
        Secure Admin Access
      </div>
    </form>
  );
}
