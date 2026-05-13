import { VenueBookingProvider } from "@/context/VenueBookingContext";

export default function HavenBookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VenueBookingProvider>{children}</VenueBookingProvider>;
}
