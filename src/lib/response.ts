import { NextResponse } from "next/server";

export function success(data: unknown, message = "ok", status = 200) {
  return NextResponse.json(
    { success: true, message, data },
    { status }
  );
}

export function error(message = "error", status = 500) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}
