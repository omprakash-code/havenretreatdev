import VenueBookingPackageSelection from "@/components/venue-booking/VenueBookingPackageSelection";
import { getEventPackages } from "@/services/package.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HavenPackageBookingPage() {
  const packages = await getEventPackages();
  const venue = packages[0]?.venue ?? null;

  return <VenueBookingPackageSelection venue={venue} packages={packages} />;
}
