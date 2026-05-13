"use client";

import { Phone, Mail } from "lucide-react";
// import { FaWhatsapp } from "react-icons/fa";
import { motion } from "framer-motion";
import { WhatsAppIcon } from "@/components/icons/WhatsApp";
import { BOOKING_ROUTES } from "@/constants/routes";
import { HomeOutlineButton, HomePrimaryButton } from "@/components/ui/HomeButtons";

export default function CtaSection() {
  return (
    <section className="relative overflow-hidden py-8 sm:py-14 lg:py-28">
      {/* Fixed Background Image */}
      <div
        className="absolute inset-0 pointer-events-none bg-fixed bg-cover bg-center"
        style={{
          backgroundImage: "url('/media/site/shared/call-to-action-bg.webp')",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="absolute inset-0 bg-black/58" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center"
        >
          {/* Heading */}
          <h2 className="mb-3 text-2xl font-semibold text-white sm:mb-4 sm:text-3xl md:text-4xl">
            Ready to Celebrate?
          </h2>

          <p className="mx-auto mb-5 max-w-2xl text-sm text-white/85 sm:mb-6 sm:text-base md:text-lg">
            Book your private theatre experience in just a few clicks.
            Our team is always available if you need help.
          </p>

          {/* Primary CTA */}
          <div className="mb-5 mx-auto flex w-full max-w-[340px] flex-col items-center justify-center gap-2.5 sm:mb-6 sm:max-w-none sm:flex-row sm:gap-3 lg:gap-4">
            <HomePrimaryButton
              href={BOOKING_ROUTES.ROOT}
              trackingName="Start Booking"
              trackingLocation="Home CTA"
              className="w-full max-w-[250px] sm:w-auto sm:max-w-none px-5 sm:px-6 lg:px-8 py-2.5 sm:py-3 lg:py-3 text-[13px] sm:text-sm lg:text-base"
            >
              Start Booking
            </HomePrimaryButton>

            <HomeOutlineButton
              href="https://wa.me/919289289696?text=Hi%20Haven%20Retreat%20%0A%0AI%27m%20interested%20in%20booking%20your%20venue%20for%20a%20special%20occasion.%20Could%20you%20please%20guide%20me%20with%20availability%2C%20pricing%2C%20and%20options%3F%0A%0AThanks!"
              target="_blank"
              rel="noopener noreferrer"
              leadingIcon={<WhatsAppIcon size={22} className="text-green-500" />}
              className="w-full max-w-[250px] sm:w-auto sm:max-w-none px-5 sm:px-6 lg:px-8 py-2.5 sm:py-3 lg:py-3 border-white/60 bg-white/5 !text-white text-[13px] sm:text-sm lg:text-base hover:border-[#00C951] hover:bg-white/10 hover:!text-white"
            >
              Chat on WhatsApp
            </HomeOutlineButton>

          </div>

          {/* Support Info */}
          <div className="flex flex-col items-center justify-center gap-4 text-xs text-white/75 sm:flex-row sm:gap-6 sm:text-sm">
            <a
              href="tel:+919876543210"
              className="flex items-center gap-2 transition hover:text-[#FFD700]">
              <Phone size={16} />
              +91 92892 89696
            </a>

            <span className="hidden sm:block">•</span>

            <a
              href="mailto:hello@havenretreat.com"
              className="flex items-center gap-2 transition hover:text-[#FFD700]"
            >
              <Mail size={16} />
              hello@havenretreat.com
            </a>

            <span className="hidden sm:block">•</span>

            <span className="font-medium">
              Replies under 5 minutes
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
