import { NextResponse } from "next/server";

import { isInternalSlotEndpointAuthorized } from "@/app/api/internal/slots/_auth";
import { syncFutureSlots } from "@/services/slot/slot-sync.service";

type SlotSyncRequestBody = {
  daysAhead?: number;
  dryRun?: boolean;
};

export async function POST(req: Request) {
  try {
    const authorized = await isInternalSlotEndpointAuthorized(req);
    if (!authorized) {
      return NextResponse.json(
        {
          success: false,
          code: "UNAUTHORIZED",
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => null)) as SlotSyncRequestBody | null;
    const daysAhead = Number(body?.daysAhead);
    const dryRun = Boolean(body?.dryRun);

    const result = await syncFutureSlots({
      daysAhead: Number.isFinite(daysAhead) ? daysAhead : undefined,
      dryRun,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("INTERNAL_SLOT_SYNC_ERROR", error);
    return NextResponse.json(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message: "Failed to sync future slots.",
      },
      { status: 500 }
    );
  }
}

