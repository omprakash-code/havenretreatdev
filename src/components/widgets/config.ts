import type {
  AvailableCouponsWidgetProps,
  HomeCoupon,
  HomeCouponStripProps,
} from "./types";

const HOME_COUPON_LIST: HomeCoupon[] = [
  {
    id: "get50",
    code: "GET50",
    description: "50% off on booking total",
    badge: "50% OFF",
    terms: "Valid on selected dates and locations.",
    isActive: true,
    sortOrder: 1,
  },
  {
    id: "save500",
    code: "SAVE500",
    description: "Flat ₹500 off on eligible bookings",
    badge: "FLAT ₹500",
    terms: "Minimum booking amount may apply.",
    isActive: true,
    sortOrder: 2,
  },
  {
    id: "decor20",
    code: "DECOR20",
    description: "20% off on decoration charges",
    badge: "DECOR 20%",
    terms: "Applies on decoration-eligible bookings.",
    isActive: true,
    sortOrder: 3,
  },
  {
    id: "first100",
    code: "FIRST100",
    description: "₹100 off for first booking",
    badge: "NEW USER",
    terms: "One-time use per customer.",
    isActive: true,
    sortOrder: 4,
  },
  {
    id: "party250",
    code: "PARTY250",
    description: "Flat ₹250 off for weekday celebrations",
    badge: "WEEKDAY",
    terms: "Applicable Monday to Thursday.",
    isActive: true,
    sortOrder: 5,
  },
];

export const HOME_COUPON_STRIP_CONFIG: HomeCouponStripProps = {
  status: "off",
  forceShow: true,
  appearDelayMs: 3000,
  message: "Get up to 50% off on selected bookings. Use code",
  couponCode: "GET50",
  dismissForHours: 24,
  ctaLabel: "Book Now",
  ctaHref: "/booking",
  position: "bottom",
  ctaPosition: "right",
};

export const HOME_AVAILABLE_COUPONS_WIDGET_CONFIG: AvailableCouponsWidgetProps = {
  status: "off",
  triggerLabel: "View Coupons",
  title: "Available Coupons",
  subtitle: "Copy and save instantly",
  desktopPosition: "right",
  mobilePosition: "bottom-right",
  coupons: HOME_COUPON_LIST,
  isLoading: false,
};
