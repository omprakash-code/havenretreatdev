"use client";

import HomeTheatreCard from "./HomeTheatreCard";

export default function HomeTheatreSection() {
  const MENU_PDF_URL = "/documents/menus/havenretreat-menu.pdf";

  const theatres = [
    {
      title: "Theatre 1",
      images: ["/media/booking/theatres/theatre-1/theatre-1-1.png", "/media/booking/theatres/theatre-2/theatre-2-1.png"],
      capacity: 2,
      price: "₹1,399",
      location: "Pitampura, Delhi",
      mapUrl:
        "https://maps.google.com/?q=B-299, Outer Ring Rd, Block B, Saraswati Vihar, Pitampura, Delhi, 110034",
      menuUrl: MENU_PDF_URL,
      decorationPrice: 700,
    },
    {
      title: "Theatre 2",
      images: ["/media/booking/theatres/theatre-2/theatre-2-1.png", "/media/booking/theatres/theatre-3/theatre-3-1.png"],
      capacity: 6,
      price: "₹1,599",
      location: "Pitampura, Delhi",
      mapUrl:
        "https://maps.google.com/?q=B-299, Outer Ring Rd, Block B, Saraswati Vihar, Pitampura, Delhi, 110034",
      menuUrl: MENU_PDF_URL,
      decorationPrice: 700,
    },
    {
      title: "Theatre 3",
      images: ["/media/booking/theatres/theatre-3/theatre-3-1.png", "/media/booking/theatres/theatre-1/theatre-1-1.png"],
      capacity: 10,
      price: "₹1,799",
      location: "Pitampura, Delhi",
      mapUrl:
        "https://maps.google.com/?q=B-299, Outer Ring Rd, Block B, Saraswati Vihar, Pitampura, Delhi, 110034",
      menuUrl: MENU_PDF_URL,
      decorationPrice: 700,
    },
  ];

  return (
    <section className="bg-white py-14 sm:py-10 lg:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-10 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-black mb-3 sm:mb-4">
            Choose your private space
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
            Luxury private theatres designed for birthdays, proposals,
            anniversaries and unforgettable moments.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-5 sm:gap-8 md:grid-cols-3 lg:grid-cols-3 lg:gap-10">
          {theatres.map((theatre) => (
            <HomeTheatreCard key={theatre.title} {...theatre} />
          ))}
        </div>
      </div>
    </section>
  );
}
