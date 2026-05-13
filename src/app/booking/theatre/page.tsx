import { redirect } from "next/navigation";
import { BOOKING_ROUTES } from "@/constants/routes";

export default function TheatrePage() {
  redirect(BOOKING_ROUTES.PACKAGE);
}
