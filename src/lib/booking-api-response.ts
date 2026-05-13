import { NextResponse } from "next/server";

export function bookingErrorResponse(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    { success: false, code, message, ...(extra ?? {}) },
    { status }
  );
}
