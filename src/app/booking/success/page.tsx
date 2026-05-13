import { Suspense } from "react";
import BookingSuccessClient from "./BookingSuccessClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BookingSuccessClient />
    </Suspense>
  );
}
