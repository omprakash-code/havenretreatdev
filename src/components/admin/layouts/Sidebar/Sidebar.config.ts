import {
  LayoutDashboard,
  CalendarCheck,
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

export const sidebarMenu = [
  {
    label: "Main Menu",
    items: [
      { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { name: "Bookings", href: "/admin/bookings", icon: CalendarCheck },
      { name: "Bookings (live)", href: "/admin/bookings/live", icon: Activity },
      { name: "Bookings (Abandoned)", href: "/admin/bookings/abandoned", icon: ShoppingCart },
      { name: "Slots", href: "/admin/slots", icon: Clock },
      { name: "Theatres", href: "/admin/theatres", icon: Monitor },
      { name: "Locations", href: "/admin/locations", icon: MapPin },
      { name: "Products", href: "/admin/products", icon: Package },
      { name: "Discount", href: "/admin/coupons", icon: Percent },
      { name: "Payments", href: "/admin/payments", icon: IndianRupee },
      { name: "Waitlist", href: "/admin/waitlist", icon: Users },
      { name: "Contact", href: "/admin/contact", icon: MessageCircle },
    ],
  },
  {
    label: "Admin System",
    items: [
      { name: "Profile", href: "/admin/profile", icon: User },
      { name: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];
