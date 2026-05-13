"use client";

import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

/* -----------------------------
   FAQ Data
------------------------------ */
const faqs = [
  {
    question: "What makes private theatres different?",
    answer:
      "Private theatres offer an exclusive, personalized cinema experience with premium amenities, customizable decorations, and complete privacy for your celebrations.",
  },
  {
    question: "Can I bring my own cake?",
    answer:
      "Yes, you can bring your own cake or choose from our designer cake options. Complimentary cake cutting arrangements are provided.",
  },
  {
    question: "How many people are allowed?",
    answer:
      "The allowed number of guests depends on the theatre selected. Our private theatres typically accommodate 4 to 10 people, with additional guests allowed at extra charges.",
  },
  {
    question: "Can I choose decorations?",
    answer:
      "Yes. We offer a variety of decoration themes including birthday, anniversary, proposal, and custom setups based on your preference.",
  },
  {
    question: "Is cancellation free?",
    answer:
      "Free cancellation is available up to 24 hours before your booking. Cancellations within 24 hours may incur a nominal fee.",
  },
  {
    question: "Can customers modify technical equipment?",
    answer:
      "Customers are not allowed to modify projector, screen, laptop, or sound system settings. Any required adjustments will be handled by our team.",
  },
  {
    question: "Is staff assistance available during the show?",
    answer:
      "Yes. Our staff is always available on standby to assist you with any technical or service-related needs during your experience.",
  },
  {
    question: "Are outside food and drinks allowed?",
    answer:
      "Outside food is allowed in selected locations. Please check location-specific rules while booking.",
  },
];

/* -----------------------------
   Helpers
------------------------------ */
const mid = Math.ceil(faqs.length / 2);
const leftFaqs = faqs.slice(0, mid);
const rightFaqs = faqs.slice(mid);

/* -----------------------------
   Single FAQ Column
------------------------------ */
function FaqColumn({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const isOpen = activeIndex === index;

        return (
          <div
            key={index}
            className="rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden"
          >
            {/* Question */}
            <button
              onClick={() => setActiveIndex(isOpen ? null : index)}
              className="w-full flex items-center justify-between px-4 sm:px-6 py-3 sm:py-5 text-left text-black font-medium text-sm sm:text-base focus:outline-none">
              <span>{item.question}</span>
              <ChevronDown
                size={18}
                className={`transition-transform duration-300 ${
                  isOpen ? "rotate-180 text-neutral-900" : "text-neutral-400"
                }`}
              />
            </button>

            {/* Answer */}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="px-4 sm:px-6 pb-5 sm:pb-6 text-neutral-600 text-sm leading-relaxed">
                    {item.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* -----------------------------
   FAQ Section
------------------------------ */
export default function FaqSection() {
  return (
    <section className="py-10 sm:py-14 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-4 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-black">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-neutral-500 text-sm sm:text-base md:text-lg">
            Everything you need to know before booking
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <FaqColumn items={leftFaqs} />
          <FaqColumn items={rightFaqs} />
        </div>
      </div>
    </section>
  );
}
