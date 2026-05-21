import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  ADVANCE_PAYMENT_AMOUNT_KEY,
  DEFAULT_MINIMUM_BOOKING_DURATION_HOURS,
  MINIMUM_BOOKING_DURATION_HOURS_KEY,
  parseAdvancePaymentAmount,
  parseMinimumBookingDurationHours,
} from "@/lib/app-settings";

export async function GET() {
  try {
    const settings = await prisma.appSetting.findMany();

    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }

    const configuredAdvance = parseAdvancePaymentAmount(
      map[ADVANCE_PAYMENT_AMOUNT_KEY]
    );
    if (configuredAdvance === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Advance payment configuration is missing or invalid.",
        },
        { status: 500 }
      );
    }

    map[ADVANCE_PAYMENT_AMOUNT_KEY] = String(configuredAdvance);
    const configuredMinimumDuration = parseMinimumBookingDurationHours(
      map[MINIMUM_BOOKING_DURATION_HOURS_KEY] ??
        DEFAULT_MINIMUM_BOOKING_DURATION_HOURS
    );
    if (configuredMinimumDuration === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Minimum booking duration configuration is invalid.",
        },
        { status: 500 }
      );
    }

    map[MINIMUM_BOOKING_DURATION_HOURS_KEY] = String(
      configuredMinimumDuration
    );

    return NextResponse.json({
      success: true,
      data: map,
    });
  } catch (err) {
    console.error("Settings API error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to load settings" },
      { status: 500 }
    );
  }
}
