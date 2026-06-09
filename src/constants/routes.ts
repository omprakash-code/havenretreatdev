export const BOOKING_ROUTES = {
  ROOT: "/booking",
  PACKAGE: "/booking/package",
  THEATRE: "/booking/package",
  SCHEDULE: "/booking/schedule",
  CONTACT: "/booking/contact",
  DETAILS: "/booking/details",
  OCCASION: "/booking/occasion",
  EXTRAS: (category: string) => `/booking/extras/${category}`,
  AGREEMENT: "/booking/agreement",
  PAYMENT: "/booking/payment",
  THANK_YOU: "/booking/thank-you",
};

export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Gallery", href: "/gallery" },
  { label: "About", href: "/about" },
  { label: "Join Waitlist", href: "/waitlist" },
  { label: "Contact", href: "/contact" },
];

export const LEGAL_LINKS = [
  { label: "Terms & Conditions", href: "/terms-and-conditions" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Cancellation Policy", href: "/cancellation-policy" },
];
