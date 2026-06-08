export const adminFeatures = {
  dashboard: true,
  bookings: true,
  manualBooking: true,
  settings: true,
  couponSettings: false,
  liveBookings: false,
  abandonedBookings: false,
  slots: false,
  packages: false,
  locations: false,
  products: false,
  coupons: false,
  payments: false,
  waitlist: false,
  contacts: false,
  profile: true,
} as const;

export type AdminFeature = keyof typeof adminFeatures;

export function isAdminFeatureEnabled(feature: AdminFeature) {
  return adminFeatures[feature];
}

export function isAdminPageEnabled(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (path === "/admin/login") return true;
  if (path === "/admin") return adminFeatures.dashboard;

  if (
    path === "/admin/bookings/live" ||
    path.startsWith("/admin/bookings/live/")
  ) {
    return adminFeatures.liveBookings;
  }

  if (
    path === "/admin/bookings/abandoned" ||
    path.startsWith("/admin/bookings/abandoned/")
  ) {
    return adminFeatures.abandonedBookings;
  }

  if (
    path === "/admin/bookings/add" ||
    path.startsWith("/admin/bookings/add/")
  ) {
    return adminFeatures.manualBooking;
  }

  if (path === "/admin/bookings" || path.startsWith("/admin/bookings/")) {
    return adminFeatures.bookings;
  }

  const featureRoutes: Array<[string, AdminFeature]> = [
    ["/admin/settings", "settings"],
    ["/admin/slots", "slots"],
    ["/admin/theatres", "packages"],
    ["/admin/locations", "locations"],
    ["/admin/products", "products"],
    ["/admin/coupons", "coupons"],
    ["/admin/payments", "payments"],
    ["/admin/waitlist", "waitlist"],
    ["/admin/contact", "contacts"],
    ["/admin/profile", "profile"],
  ];

  const matchedRoute = featureRoutes.find(
    ([route]) => path === route || path.startsWith(`${route}/`)
  );

  return matchedRoute
    ? isAdminFeatureEnabled(matchedRoute[1])
    : false;
}
