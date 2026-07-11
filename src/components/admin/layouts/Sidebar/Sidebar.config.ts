import {
  LayoutDashboard,
  CalendarCheck,
  ClipboardCheck,
  Monitor,
  Clock,
  Package,
  Percent,
  Activity,
  ShoppingCart,
  MapPin,
  Settings,
  IndianRupee,
  Users,
  User,
  MessageCircle,
} from "@/components/icons";
import {
  isAdminFeatureEnabled,
  type AdminFeature,
} from "@/config/admin-features";

const sidebarMenuItems = [
  {
    label: "Main Menu",
    items: [
      {
        name: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
        feature: "dashboard",
      },
      {
        name: "Bookings",
        href: "/admin/bookings",
        icon: CalendarCheck,
        feature: "bookings",
      },
      {
        name: "Pending Review",
        href: "/admin/bookings/pending",
        icon: ClipboardCheck,
        feature: "pendingReviewBookings",
      },
      {
        name: "Bookings (live)",
        href: "/admin/bookings/live",
        icon: Activity,
        feature: "liveBookings",
      },
      {
        name: "Bookings (Abandoned)",
        href: "/admin/bookings/abandoned",
        icon: ShoppingCart,
        feature: "abandonedBookings",
      },
      {
        name: "Slots",
        href: "/admin/slots",
        icon: Clock,
        feature: "slots",
      },
      {
        name: "Theatres",
        href: "/admin/theatres",
        icon: Monitor,
        feature: "packages",
      },
      {
        name: "Locations",
        href: "/admin/locations",
        icon: MapPin,
        feature: "locations",
      },
      {
        name: "Products",
        href: "/admin/products",
        icon: Package,
        feature: "products",
      },
      {
        name: "Discount",
        href: "/admin/coupons",
        icon: Percent,
        feature: "coupons",
      },
      {
        name: "Payments",
        href: "/admin/payments",
        icon: IndianRupee,
        feature: "payments",
      },
      {
        name: "Waitlist",
        href: "/admin/waitlist",
        icon: Users,
        feature: "waitlist",
      },
      {
        name: "Contact",
        href: "/admin/contact",
        icon: MessageCircle,
        feature: "contacts",
      },
    ],
  },
  {
    label: "Admin System",
    items: [
      {
        name: "Profile",
        href: "/admin/profile",
        icon: User,
        feature: "profile",
      },
      {
        name: "Settings",
        href: "/admin/settings",
        icon: Settings,
        feature: "settings",
      },
    ],
  },
] satisfies Array<{
  label: string;
  items: Array<{
    name: string;
    href: string;
    icon: typeof LayoutDashboard;
    feature: AdminFeature;
  }>;
}>;

export const sidebarMenu = sidebarMenuItems
  .map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      isAdminFeatureEnabled(item.feature)
    ),
  }))
  .filter((section) => section.items.length > 0);
