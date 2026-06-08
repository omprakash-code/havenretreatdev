import { NextResponse } from "next/server";

import {
  AvailabilityBlockConflictError,
  AvailabilityBlockValidationError,
  availabilityBlockInputSchema,
  createAvailabilityBlock,
  listAvailabilityBlocks,
} from "@/services/availability/availability-block.service";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

function errorResponse(status: number, message: string) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function GET(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) return errorResponse(401, "Unauthorized");

    const params = new URL(req.url).searchParams;
    const blocks = await listAvailabilityBlocks({
      theatreId: params.get("theatreId")?.trim() ?? "",
      from: params.get("from"),
      to: params.get("to"),
      includeInactive: params.get("includeInactive") === "true",
    });

    return NextResponse.json({ success: true, data: blocks });
  } catch (error) {
    if (error instanceof AvailabilityBlockValidationError) {
      return errorResponse(400, error.message);
    }
    console.error("[GET_ADMIN_AVAILABILITY_BLOCKS]", error);
    return errorResponse(500, "Failed to load availability blocks.");
  }
}

export async function POST(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) return errorResponse(401, "Unauthorized");

    const parsed = availabilityBlockInputSchema.safeParse(
      await req.json().catch(() => null)
    );
    if (!parsed.success) {
      return errorResponse(400, parsed.error.issues[0]?.message ?? "Invalid block.");
    }

    const block = await createAvailabilityBlock(parsed.data, adminId);
    return NextResponse.json({ success: true, data: block }, { status: 201 });
  } catch (error) {
    if (error instanceof AvailabilityBlockConflictError) {
      return errorResponse(409, error.message);
    }
    if (error instanceof AvailabilityBlockValidationError) {
      return errorResponse(400, error.message);
    }
    console.error("[POST_ADMIN_AVAILABILITY_BLOCKS]", error);
    return errorResponse(500, "Failed to create availability block.");
  }
}
