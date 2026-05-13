"use client";

import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

type ContactSubmitResponse = {
  success: boolean;
  code?: string;
  message?: string;
};

type ContactFormState = {
  name: string;
  mobile: string;
  message: string;
};

const INITIAL_FORM: ContactFormState = {
  name: "",
  mobile: "",
  message: "",
};

function normalizeIndianMobile(input: string) {
  const digits = input.replace(/\D/g, "");

  if (digits.length === 0) return "";
  if (digits.length <= 10) return digits;
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }

  return digits.slice(-10);
}

export default function ContactForm() {
  const [form, setForm] = useState<ContactFormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  function updateField<K extends keyof ContactFormState>(
    key: K,
    value: ContactFormState[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/contact/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const json = (await res.json()) as ContactSubmitResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Failed to submit inquiry.");
      }

      toast.success("We have received your message, we will contact you shortly.");
      setForm(INITIAL_FORM);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit inquiry."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bg-[#FAFAF8] py-14 sm:py-16 lg:py-20">
      <div className="max-w-3xl mx-auto px-3 sm:px-6">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl sm:text-3xl font-semibold text-[#111111] text-center"
        >
          Send Us a Message
        </motion.h2>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          autoComplete="on"
          className="mt-8 sm:mt-10 lg:mt-12 space-y-4 sm:space-y-6"
        >
          <input
            type="text"
            id="contact-name"
            name="name"
            autoComplete="name"
            autoCapitalize="words"
            placeholder="Your Name"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full px-4 sm:px-5 py-3.5 sm:py-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#FFD700]/40"
            required
          />

          <div>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">
                +91
              </span>
              <input
                type="tel"
                id="contact-mobile"
                name="tel"
                autoComplete="tel-national"
                inputMode="numeric"
                placeholder="Enter 10-digit mobile number"
                value={form.mobile}
                onChange={(e) =>
                  updateField("mobile", normalizeIndianMobile(e.target.value))
                }
                className="w-full rounded-xl border border-gray-300 py-3.5 pl-14 pr-4 sm:py-4 sm:pl-14 sm:pr-5 focus:outline-none focus:ring-2 focus:ring-[#FFD700]/40"
                required
              />
            </div>
            <p className="mt-1 text-right text-xs text-gray-400">
              {form.mobile.length}/10 digits
            </p>
          </div>

          <textarea
            rows={4}
            id="contact-message"
            name="message"
            placeholder="Tell us what you’re planning..."
            value={form.message}
            onChange={(e) => updateField("message", e.target.value)}
            className="w-full px-4 sm:px-5 py-3.5 sm:py-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#FFD700]/40"
            required
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 sm:py-4 rounded-full bg-[#FFD700] text-black font-semibold text-sm sm:text-base hover:shadow-xl hover:shadow-[#FFD700]/35 transition-all disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Submit Enquiry"}
          </button>
        </form>
      </div>
    </section>
  );
}
