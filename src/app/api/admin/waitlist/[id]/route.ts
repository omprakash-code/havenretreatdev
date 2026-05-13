import { Prisma, WaitlistStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

type UpdateWaitlistPayload = {
  name?: string;
  phone?: string;
  email?: string | null;
  city?: string | null;
  locationPreference?: string | null;
  theatrePreference?: string | null;
  preferredDate?: string | null;
  preferredTime?: string | null;
  peopleCount?: number | string | null;
  occasion?: string | null;
  notes?: string | null;
  status?: WaitlistStatus;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string) {
  return EMAIL_REGEX.test(value);
}

function parsePreferredDate(input: string | null | undefined) {
  if (input === undefined) {
    return { touched: false, value: null as Date | null, invalid: false };
  }
  if (!input) {
    return { touched: true, value: null as Date | null, invalid: false };
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return { touched: true, value: null as Date | null, invalid: false };
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return { touched: true, value: null as Date | null, invalid: true };
  }
  return { touched: true, value: date, invalid: false };
}

function parsePeopleCount(input: number | string | null | undefined) {
  if (input === undefined) {
    return { touched: false, value: null as number | null, invalid: false };
  }
  if (input === null || input === "") {
    return { touched: true, value: null as number | null, invalid: false };
  }
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    return { touched: true, value: null as number | null, invalid: true };
  }
  return { touched: true, value: Math.trunc(parsed), invalid: false };
}

async function getAuthenticatedAdminId() {
  return getAuthenticatedAdminIdFromCookies();
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await getAuthenticatedAdminId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Waitlist entry id is required." },
        { status: 400 }
      );
    }

    const body = (await req.json()) as UpdateWaitlistPayload;
    const updateData: Prisma.WaitlistEntryUpdateInput = {
      handledByAdminId: adminId,
    };
    let hasFieldUpdate = false;

    if (body.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (name.length < 2) {
        return NextResponse.json(
          { success: false, message: "Please enter a valid name." },
          { status: 400 }
        );
      }
      updateData.name = name;
      hasFieldUpdate = true;
    }

    if (body.phone !== undefined) {
      const phone = normalizePhone(String(body.phone ?? ""));
      if (!isValidPhone(phone)) {
        return NextResponse.json(
          { success: false, message: "Please enter a valid 10-digit phone number." },
          { status: 400 }
        );
      }
      updateData.phone = phone;
      hasFieldUpdate = true;
    }

    if (body.email !== undefined) {
      const email = String(body.email ?? "").trim();
      if (email && !isValidEmail(email)) {
        return NextResponse.json(
          { success: false, message: "Please enter a valid email address." },
          { status: 400 }
        );
      }
      updateData.email = email || null;
      hasFieldUpdate = true;
    }

    if (body.city !== undefined) {
      updateData.city = String(body.city ?? "").trim() || null;
      hasFieldUpdate = true;
    }

    if (body.locationPreference !== undefined) {
      updateData.locationPreference =
        String(body.locationPreference ?? "").trim() || null;
      hasFieldUpdate = true;
    }

    if (body.theatrePreference !== undefined) {
      updateData.theatrePreference =
        String(body.theatrePreference ?? "").trim() || null;
      hasFieldUpdate = true;
    }

    const preferredDateParsed = parsePreferredDate(body.preferredDate);
    if (preferredDateParsed.invalid) {
      return NextResponse.json(
        { success: false, message: "Please select a valid preferred date." },
        { status: 400 }
      );
    }
    if (preferredDateParsed.touched) {
      updateData.preferredDate = preferredDateParsed.value;
      hasFieldUpdate = true;
    }

    if (body.preferredTime !== undefined) {
      updateData.preferredTime = String(body.preferredTime ?? "").trim() || null;
      hasFieldUpdate = true;
    }

    const peopleCountParsed = parsePeopleCount(body.peopleCount);
    if (peopleCountParsed.invalid) {
      return NextResponse.json(
        { success: false, message: "Number of people should be between 1 and 50." },
        { status: 400 }
      );
    }
    if (peopleCountParsed.touched) {
      if (
        peopleCountParsed.value !== null &&
        (peopleCountParsed.value < 1 || peopleCountParsed.value > 50)
      ) {
        return NextResponse.json(
          { success: false, message: "Number of people should be between 1 and 50." },
          { status: 400 }
        );
      }
      updateData.peopleCount = peopleCountParsed.value;
      hasFieldUpdate = true;
    }

    if (body.occasion !== undefined) {
      updateData.occasion = String(body.occasion ?? "").trim() || null;
      hasFieldUpdate = true;
    }

    if (body.notes !== undefined) {
      updateData.notes = String(body.notes ?? "").trim() || null;
      hasFieldUpdate = true;
    }

    if (body.status !== undefined) {
      if (!Object.values(WaitlistStatus).includes(body.status)) {
        return NextResponse.json(
          { success: false, message: "Invalid waitlist status." },
          { status: 400 }
        );
      }
      const now = new Date();
      updateData.status = body.status;
      updateData.contactedAt =
        body.status === "CONTACTED"
          ? now
          : body.status === "NEW"
            ? null
            : undefined;
      updateData.closedAt =
        body.status === "CLOSED"
          ? now
          : body.status === "NEW" || body.status === "CONTACTED"
            ? null
            : undefined;
      hasFieldUpdate = true;
    }

    if (!hasFieldUpdate) {
      return NextResponse.json(
        { success: false, message: "No fields provided to update." },
        { status: 400 }
      );
    }

    const updated = await prisma.waitlistEntry.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Waitlist entry updated.",
      data: {
        id: updated.id,
        reference: updated.reference,
        name: updated.name,
        phone: updated.phone,
        email: updated.email,
        city: updated.city,
        locationPreference: updated.locationPreference,
        theatrePreference: updated.theatrePreference,
        preferredDate: updated.preferredDate?.toISOString() ?? null,
        preferredTime: updated.preferredTime,
        peopleCount: updated.peopleCount,
        occasion: updated.occasion,
        notes: updated.notes,
        status: updated.status,
        contactedAt: updated.contactedAt?.toISOString() ?? null,
        closedAt: updated.closedAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { success: false, message: "Waitlist entry not found." },
        { status: 404 }
      );
    }

    console.error("PATCH /api/admin/waitlist/:id error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update waitlist entry." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await getAuthenticatedAdminId();
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Waitlist entry id is required." },
        { status: 400 }
      );
    }

    await prisma.waitlistEntry.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Waitlist entry deleted.",
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { success: false, message: "Waitlist entry not found." },
        { status: 404 }
      );
    }

    console.error("DELETE /api/admin/waitlist/:id error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete waitlist entry." },
      { status: 500 }
    );
  }
}
