import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createPrebookingToken } from "@/services/booking/prebookingSession.server";

export async function POST(req: Request) {
  try {
    const { locationId, locationName, city, date } =
      await req.json();

    if (!locationId || !locationName || !date) {
      return NextResponse.json(
        { success: false, message: "Missing fields" },
        { status: 400 }
      );
    }

    const token = createPrebookingToken({
      locationId,
      locationName,
      city,
      date,
    });

    const cookieStore = await cookies();

    cookieStore.set("ds_prebooking", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 2,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}
