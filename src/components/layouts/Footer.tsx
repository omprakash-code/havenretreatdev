"use client";

import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { FacebookIcon } from "@/components/icons/FacebookIcon";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import { YoutubeIcon } from "@/components/icons/YoutubeIcon";
import { NAV_LINKS } from "@/constants/routes";
import { LEGAL_LINKS } from "@/constants/routes";


export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0f1115] px-6 pb-4 pt-10 md:px-8 md:pt-12">
      <div className="max-w-7xl mx-auto">

        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-12 mb-14 md:mb-16">

          {/* Brand */}
          <div>
            <div className="mb-4 flex items-center">
              <Image
                src="/assets/logo.png"
                alt="Haven Retreat Logo"
                width={70}
                height={70}
                className="h-[60px] w-[60px] md:h-[70px] md:w-[70px]"
              />
            </div>

            <p className="leading-relaxed text-white/80">
              Creating unforgettable cinematic experiences for your special
              moments. Where celebrations meet luxury.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="mb-4 text-xl font-bold text-white">
              Quick Links
            </h4>
            <ul className="space-y-3">
              {NAV_LINKS.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-white/80 transition hover:text-[#FFD700] hover:underline"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>


          </div>

          {/* Policies */}
          <div>
            <h4 className="mb-4 text-xl font-bold text-white">
              Policies
            </h4>
            <ul className="space-y-3">
              {LEGAL_LINKS.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-white/80 transition hover:text-[#FFD700] hover:underline"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

          </div>

          {/* Social + Address */}
          <div>
            <h4 className="mb-4 text-xl font-bold text-white">
              Follow Us
            </h4>

            <div className="flex items-center gap-4 mb-6">
              <Link
                href="https://www.instagram.com/haven_retreat_miami/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Haven Retreat on Instagram"
                className="text-white/85 transition hover:text-[#FFD700]"
              >
                <InstagramIcon />
              </Link>

              <Link
                href="https://www.facebook.com/search/top?q=Haven%20Retreat"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Haven Retreat on Facebook"
                className="text-white/85 transition hover:text-[#FFD700]"
              >
                <FacebookIcon />
              </Link>

              <Link
                href="https://www.youtube.com/@havenretreat"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Haven Retreat on YouTube"
                className="text-white/85 transition hover:text-[#FFD700]"
              >
                <YoutubeIcon />
              </Link>
            </div>


            <h4 className="mb-3 text-xl font-bold text-white">
              Address
            </h4>

            <div className="flex items-start gap-3 text-white/85">
              <MapPin size={20} />
              <p className="leading-relaxed">
                B-299 ff Saraswati Vihar Ring Road Pitampura, Delhi 110034
              </p>
            </div>

            <h4 className="mb-3 mt-6 text-xl font-bold text-white">
              Contact
            </h4>

            <div className="space-y-3 text-white/85">
              <a
                href="tel:+919289289696"
                className="flex items-center gap-3 transition hover:text-[#FFD700]"
              >
                <Phone size={18} />
                +91 92892 89696
              </a>
              <a
                href="mailto:hello@havenretreat.com"
                className="flex items-center gap-3 transition hover:text-[#FFD700]"
              >
                <Mail size={18} />
                hello@havenretreat.com
              </a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/15 pt-6 text-center">
          <p className="text-white/70">
            © 2026 Haven Retreat LLP. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
