export type WidgetStatus = "on" | "off";

export type DrawerDesktopPosition = "left" | "right";
export type DrawerMobilePosition = "bottom-left" | "bottom-right";

export type StripPosition = "bottom";
export type StripCtaPosition = "left" | "center" | "right" | "space-between";

export type HomeCoupon = {
  id: string;
  code: string;
  description: string;
  badge: string;
  terms?: string;
  isActive?: boolean;
  sortOrder?: number;
};

export type AvailableCouponsWidgetProps = {
  status?: WidgetStatus;
  coupons?: HomeCoupon[];
  isLoading?: boolean;
  triggerLabel?: string;
  title?: string;
  subtitle?: string;
  desktopPosition?: DrawerDesktopPosition;
  mobilePosition?: DrawerMobilePosition;
};

export type HomeCouponStripProps = {
  status?: WidgetStatus;
  message?: string;
  couponCode?: string;
  dismissForHours?: number;
  forceShow?: boolean;
  appearDelayMs?: number;
  ctaLabel?: string;
  ctaHref?: string;
  position?: StripPosition;
  ctaPosition?: StripCtaPosition;
};
