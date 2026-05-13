import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyPrebookingToken } from "@/services/booking/prebookingSession.server";

export async function GET() {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("ds_prebooking")?.value ?? null;

  if (!token) {
    return NextResponse.json({
      success: false,
    });
  }

  const payload = verifyPrebookingToken(token);

  if (!payload) {
    return NextResponse.json({
      success: false,
    });
  }

  return NextResponse.json({
    success: true,
    data: payload,
  });
}
