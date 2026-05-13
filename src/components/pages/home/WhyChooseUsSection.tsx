"use client";

// import { useMounted } from "@/hooks/useMounted";
import { Cake, Heart, Film, Users } from "@/components/icons";

export default function WhyChooseUsSection() {
  // const mounted = useMounted(); // Hook to check if component is mounted
  
  const features = [
    {
      icon: <Cake size={22} />,
      title: "Perfect for Birthdays",
      description:
        "Surprise your loved ones with a unique celebration in a private cinema setting.",
    },
    {
      icon: <Heart size={22} />,
      title: "Romantic Anniversaries",
      description:
        "Create unforgettable moments with your partner in an intimate theatre experience.",
    },
    {
      icon: <Film size={22} />,
      title: "Premium Movie Experience",
      description:
        "Enjoy blockbusters with immersive sound and crystal-clear projection.",
    },
    {
      icon: <Users size={22} />,
      title: "Quality Family Time",
      description:
        "Bond with your family in a comfortable and completely private environment.",
    },
  ];

  // if (!mounted) return null; // Prevent hydration mismatch
  return (
    <section
      id="why-choose-us"
      className="bg-white px-3 py-10 sm:px-6 sm:py-10 lg:py-10"
    >
      <div className="max-w-7xl mx-auto">

        {/* Section Header */}
        <div className="text-center mb-4 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-black mb-1 sm:mb-4">
            Why Choose a Private Theatre?
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-black">
            Turn ordinary moments into unforgettable experiences
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-4 md:gap-3 lg:grid-cols-4 lg:gap-8">
          {features.map((item, index) => (
            <div
              key={index}
              className="rounded-xl p-3 sm:p-6 md:p-3.5 lg:p-6 border border-gray-200 hover:shadow-lg transition bg-white"
            >
              {/* Icon */}
              <div className="w-9 h-9 sm:w-12 sm:h-12 md:w-10 md:h-10 lg:w-12 lg:h-12 bg-gray-100 text-black rounded-full flex items-center justify-center mb-3 sm:mb-4 md:mb-2.5 lg:mb-4">
                {item.icon}
              </div>

              {/* Title */}
              <h3 className="text-[18px] leading-[24px] sm:text-[22px] sm:leading-[30px] md:text-[24px] md:leading-[32px] font-bold text-black mb-1.5 sm:mb-2 md:mb-1.5 lg:mb-2">
                {item.title}
              </h3>

              {/* Description */}
              <p className="text-xs sm:text-sm md:text-xs lg:text-sm text-black/90 leading-snug sm:leading-relaxed md:leading-snug lg:leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
