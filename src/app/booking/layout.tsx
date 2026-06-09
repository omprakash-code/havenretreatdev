import BookingFooter from "@/components/booking/global/BookingFooter";
import BookingHeader from "@/components/booking/global/BookingHeader";
import BookingSessionExpiredBanner from "@/components/booking/global/BookingSessionExpiredBanner";

export default function RootLayout({
  children,
}:{
  children: React.ReactNode;
}) {

  return (
   <div className="flex min-h-screen flex-col">
    <BookingHeader />
    <main className="flow-root flex-1">
      <BookingSessionExpiredBanner />
      {children}
    </main>
    <BookingFooter />
   </div>
  );
}
