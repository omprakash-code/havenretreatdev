import { NextResponse } from "next/server";

import {
  AvailabilityBlockConflictError,
  AvailabilityBlockNotFoundError,
  AvailabilityBlockValidationError,
  availabilityBlockInputSchema,
  deactivateAvailabilityBlock,
  updateAvailabilityBlock,
} from "@/services/availability/availability-block.service";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function errorResponse(status: number, message: string) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) return errorResponse(401, "Unauthorized");

    const parsed = availabilityBlockInputSchema.safeParse(
      await req.json().catch(() => null)
    );
    if (!parsed.success) {
      return errorResponse(400, parsed.error.issues[0]?.message ?? "Invalid block.");
    }

    const { id } = await params;
    const block = await updateAvailabilityBlock(id, parsed.data);
    return NextResponse.json({ success: true, data: block });
  } catch (error) {
    if (error instanceof AvailabilityBlockConflictError) {
      return errorResponse(409, error.message);
    }
    if (error instanceof AvailabilityBlockNotFoundError) {
      return errorResponse(404, error.message);
    }
    if (error instanceof AvailabilityBlockValidationError) {
      return errorResponse(400, error.message);
    }
    console.error("[PATCH_ADMIN_AVAILABILITY_BLOCK]", error);
    return errorResponse(500, "Failed to update availability block.");
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) return errorResponse(401, "Unauthorized");

    const { id } = await params;
    await deactivateAvailabilityBlock(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AvailabilityBlockNotFoundError) {
      return errorResponse(404, error.message);
    }
    console.error("[DELETE_ADMIN_AVAILABILITY_BLOCK]", error);
    return errorResponse(500, "Failed to deactivate availability block.");
  }
}
