import TheatreList from "@/components/booking/theatre/TheatreList";
import RangePackageList from "@/components/booking/package/RangePackageList";

export default function PackagePage() {
  if (process.env.CUSTOMER_RANGE_BOOKING_ENABLED === "true") {
    return <RangePackageList />;
  }
  return <TheatreList />;
}
