import { redirect } from "next/navigation";
import { HAVEN_BOOKING_ROUTES } from "@/constants/haven-booking-routes";

export default function HavenBookingRootPage() {
  redirect(HAVEN_BOOKING_ROUTES.PACKAGE);
}
