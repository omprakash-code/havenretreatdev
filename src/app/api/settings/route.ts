import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  ADVANCE_PAYMENT_AMOUNT_KEY,
  DEFAULT_EXTRA_HOURLY_RATE,
  DEFAULT_MINIMUM_BOOKING_DURATION_HOURS,
  EXTRA_HOURLY_RATE_KEY,
  MINIMUM_BOOKING_DURATION_HOURS_KEY,
  parseAdvancePaymentAmount,
  parseExtraHourlyRate,
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
    const configuredExtraHourlyRate = parseExtraHourlyRate(
      map[EXTRA_HOURLY_RATE_KEY] ?? DEFAULT_EXTRA_HOURLY_RATE
    );
    if (configuredExtraHourlyRate === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Extra hourly rate configuration is invalid.",
        },
        { status: 500 }
      );
    }

    map[EXTRA_HOURLY_RATE_KEY] = String(configuredExtraHourlyRate);

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
