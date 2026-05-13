import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();

  const booking = cookieStore.get("ds_booking_session");
  const prebooking = cookieStore.get("ds_prebooking");

  if (booking) {
    return NextResponse.json({
      success: true,
      type: "booking",
    });
  }

  if (prebooking) {
    return NextResponse.json({
      success: true,
      type: "prebooking",
    });
  }

  return NextResponse.json({
    success: true,
    type: "none",
  });
}
