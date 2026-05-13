"use client";

import Image from "next/image";
import { motion } from "framer-motion";

export default function OurStory() {
    return (
        <section className="bg-white py-8 sm:py-14 overflow-hidden">
            <div className="max-w-7xl mx-auto px-3 sm:px-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-16 items-center">

                    {/* RIGHT Image*/}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="relative">
                        <div className="relative w-full h-[260px] sm:h-[340px] lg:h-[420px] rounded-3xl overflow-hidden shadow-xl">
                            <Image
                                src="/media/site/home/reviews/vaishnavi-puri/3.webp"
                                alt="Private theatre celebration setup"
                                fill
                                className="object-cover"
                            />
                        </div>

                        {/* Subtle gold accent */}
                        <div className="absolute -bottom-5 -right-5 w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-[#FFD700]/20 blur-2xl pointer-events-none" />
                    </motion.div>

                    {/* LEFT: Text Content */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="max-w-xl"
                    >
                        {/* H2 – SEO friendly */}
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-black">
                            Our Story
                        </h2>

                        <p className="mt-4 sm:mt-6 text-gray-600 leading-relaxed text-sm sm:text-base">
                            Haven Retreat was created with a simple belief - special
                            moments deserve more than ordinary spaces. We wanted to give
                            people a private, beautiful, and meaningful way to celebrate
                            life’s milestones.
                        </p>

                        <p className="mt-3 sm:mt-4 text-gray-600 leading-relaxed text-sm sm:text-base">
                            Traditional theatres often lack intimacy and flexibility. So we
                            designed premium private screening spaces where every detail -
                            from décor and lighting to seating and service - feels personal
                            and thoughtfully curated.
                        </p>

                        <p className="mt-3 sm:mt-4 text-gray-600 leading-relaxed text-sm sm:text-base">
                            Over time, Haven Retreat has become a trusted place for
                            proposals, birthdays, anniversaries, and unforgettable
                            celebrations - helping our guests turn emotions into memories.
                        </p>
                    </motion.div>

                </div>
            </div>
        </section>
    );
}
