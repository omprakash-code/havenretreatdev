import { redirect } from "next/navigation";
import { BOOKING_ROUTES } from "@/constants/routes";

export default function Home() {
  redirect(BOOKING_ROUTES.ROOT);
}
