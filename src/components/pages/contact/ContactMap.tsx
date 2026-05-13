"use client";

export default function ContactMap() {
  return (
    <section className="bg-white py-14 sm:py-16 lg:py-20">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Heading */}
        <div className="max-w-3xl mb-8 sm:mb-10 text-center sm:text-left">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[#111111]">
            Visit Our Location
          </h2>
          <p className="mt-3 text-[#5F6368] text-sm sm:text-base lg:text-lg">
            Find us easily and experience Haven Retreat in person.
          </p>
        </div>

        {/* Map */}
        <div className="relative w-full h-[280px] sm:h-[360px] lg:h-[420px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
          <iframe
            src="https://www.google.com/maps?q=Haven%20Retreat&output=embed"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-full"
          />
        </div>
      </div>
    </section>
  );
}
