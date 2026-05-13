"use client";

import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsApp";

export default function ContactMethods() {
    return (
        <section className="bg-white py-8 sm:py-16 lg:py-10">
            <div className="max-w-6xl mx-auto px-3 sm:px-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 lg:gap-8 text-center">

                {/* WhatsApp */}
                <Link
                    href="https://wa.me/919289289696?text=Hi%20Haven%20Retreat%20👋%0A%0AI%27d%20like%20to%20know%20more%20about%20booking%20your%20venue."
                    target="_blank"
                    className="flex align-center flex-col content-center justify-center h-full p-4 sm:p-4 rounded-xl sm:rounded-2xl border border-[#E5E7EB] hover:shadow-lg transition">
                    <WhatsAppIcon size={28} className="mx-auto mb-2 sm:mb-4 text-green-500" />
                    <h3 className="font-semibold text-black text-sm sm:text-lg leading-tight">Chat on WhatsApp</h3>
                    <p className="mt-1 sm:mt-2 text-xs sm:text-base text-gray-600 leading-snug">
                        Fastest way to reach us
                    </p>
                </Link>

                {/* Call */}
                <a
                    href="tel:+919289289696"
                    className="flex align-center flex-col content-center justify-center h-full p-4 sm:p-4 rounded-xl sm:rounded-2xl border border-[#E5E7EB] hover:shadow-lg transition">
                    <Phone size={28} className="mx-auto mb-2 sm:mb-4 text-[#2A2A2E]" />
                    <h3 className="font-semibold text-black text-sm sm:text-lg leading-tight">Call Us</h3>
                    <p className="mt-1 sm:mt-2 text-xs sm:text-base text-gray-600 leading-snug">
                        +91 92892 89696
                    </p>
                </a>

                {/* Email */}
                <a
                    href="mailto:havenretreat@gmail.com"
                    className="flex align-center flex-col content-center justify-center h-full p-4 sm:p-4 rounded-xl sm:rounded-2xl border border-[#E5E7EB] hover:shadow-lg transition">
                    <Mail size={28} className="mx-auto mb-2 sm:mb-4 text-[#2A2A2E]" />
                    <h3 className="font-semibold text-black text-sm sm:text-lg leading-tight">Email</h3>
                    <p className="mt-1 sm:mt-2 text-xs sm:text-base text-gray-600 break-all leading-snug">
                        havenretreat@gmail.com
                    </p>
                </a>

                {/* Address */}
                <a
                    href="https://maps.google.com/?q=B-299, Outer Ring Rd, Block B, Saraswati Vihar, Pitampura, Delhi, 110034"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex align-center flex-col content-center justify-center h-full p-4 sm:p-4 rounded-xl sm:rounded-2xl border border-[#E5E7EB] hover:shadow-lg transition">
                    <MapPin size={28} className="mx-auto mb-2 sm:mb-4 text-[#2A2A2E]" />
                    <h3 className="font-semibold text-black text-sm sm:text-lg leading-tight">Visit Us</h3>
                    <p className="mt-1 sm:mt-2 text-xs sm:text-base text-gray-600 leading-snug">
                        B-299, Outer Ring Rd, Block B, Saraswati Vihar,
                        Pitampura, Delhi – 110034
                    </p>
                </a>


            </div>
        </section>
    );
}
