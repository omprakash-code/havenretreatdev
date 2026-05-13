"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Quote, Star, Instagram, Facebook } from "lucide-react";

export default function TestimonialsSection() {
  const testimonials = [
    {
      name: "Priya Sharma",
      avatar:
        "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg",
      review:
        "The ambiance was stunning and the experience felt truly personal. Everything was handled perfectly.",
      socials: ["instagram"],
    },
    {
      name: "Rahul Mehta",
      avatar:
        "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg",
      review:
        "A proposal moment I’ll never forget. Privacy, service, and setup were absolutely top-class.",
      socials: ["instagram", "facebook"],
    },
    {
      name: "Anjali Kapoor",
      avatar:
        "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-6.jpg",
      review:
        "Hands down the best family experience we’ve had. Premium, peaceful, and worth every rupee.",
      socials: [],
    },
  ];

  // duplicate data to fake infinite loop
  const loopItems = [...testimonials, ...testimonials, ...testimonials];

  return (
    <section className="py-20 bg-section-light overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-4xl font-semibold text-black">
            Loved by Our Guests
          </h2>
          <p className="mt-3 text-gray-500">
            Thousands of premium private theatre experiences
          </p>
        </div>

        {/* Carousel */}
        <motion.div
          className="flex gap-6"
          animate={{ x: ["0%", "-66%"] }}
          transition={{
            ease: "linear",
            duration: 10, // faster but still premium
            repeat: Infinity,
          }}
        >
          {loopItems.map((item, index) => (
            <motion.div
              key={index}
              className="group min-w-[280px] sm:min-w-[320px] max-w-[320px] bg-white rounded-2xl border border-neutral-200 px-6 py-6 shadow-sm hover:shadow-2xl transition-all"
              whileHover={{
                animationPlayState: "paused",
              }}
            >
              {/* Quote Icon */}
              <Quote
                size={28}
                className="text-neutral-300 mb-4"
              />

              {/* Review */}
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                {item.review}
              </p>

              {/* User */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Image
                    src={item.avatar}
                    alt={item.name}
                    width={48}
                    height={48}
                    className="rounded-full object-cover"
                  />
                  <div>
                    <p className="font-medium text-black text-sm">
                      {item.name}
                    </p>
                    <div className="flex gap-1 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          className="fill-neutral-900 text-neutral-900"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Social Icons */}
                <div className="flex gap-2 text-neutral-400">
                  {item.socials.includes("instagram") && (
                    <Instagram size={16} />
                  )}
                  {item.socials.includes("facebook") && (
                    <Facebook size={16} />
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
