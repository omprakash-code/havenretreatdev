import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  ADVANCE_PAYMENT_AMOUNT_KEY,
  parseAdvancePaymentAmount,
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
