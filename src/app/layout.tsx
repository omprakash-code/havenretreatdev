import type { Metadata } from "next";
import { Suspense } from "react";
import "@splidejs/react-splide/css";
import "./globals.css";
import { BookingProvider } from "@/context/BookingContext";
import { Toaster } from "sonner";
import MetaBootstrap from "@/components/meta/MetaBootstrap";

export const metadata: Metadata = {
  title: "Haven Reteat - Private Designed Venue Experiences",
  description: "Book private venue experiences for birthdays, anniversaries, date nights, proposals & more. Unforgettable moments in a haven retreat.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className="antialiased"
      >
        <BookingProvider>{children}</BookingProvider>
        <Suspense fallback={null}>
          <MetaBootstrap />
        </Suspense>
        <Toaster
          richColors
          position="top-center"
          mobileOffset={{ top: 20, left: 16, right: 16 }}
        />
      </body>
    </html>
  );
}
