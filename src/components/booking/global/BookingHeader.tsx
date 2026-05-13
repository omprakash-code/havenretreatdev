"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import BookingHeaderControls from "./BookingHeaderControls";

type BookingHeaderProps = {
  readOnly?: boolean;
};

export default function BookingHeader({ readOnly = false }: BookingHeaderProps) {
  const router = useRouter();

  return (
    <header className="w-full bg-white border-b border-gray-300 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-2 flex items-center justify-between">

        {/* Logo */}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="flex items-center justify-center">
            <Image src="/assets/logo.png" width={150} height={50} alt="Haven Retreat's Logo" />
          </div>
        </button>

        <Suspense fallback={null}>
          <BookingHeaderControls readOnly={readOnly} />
        </Suspense>
      </div>
    </header>
  );
}
