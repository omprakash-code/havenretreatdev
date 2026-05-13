import BookingFooter from "@/components/booking/global/BookingFooter";
import BookingHeader from "@/components/booking/global/BookingHeader";
import BookingSessionExpiredBanner from "@/components/booking/global/BookingSessionExpiredBanner";

export default function RootLayout({
  children,
}:{
  children: React.ReactNode;
}) {

  return (
   <>
    <BookingHeader />
    <main className="flow-root">
      <BookingSessionExpiredBanner />
      {children}
    </main>
    <BookingFooter />
   </>
  );
}
