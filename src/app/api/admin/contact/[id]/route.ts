import { ContactInquiryStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

type UpdateContactStatusPayload = {
  name?: string;
  mobile?: string;
  message?: string;
  status?: ContactInquiryStatus;
};

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
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
        { success: false, message: "Contact inquiry id is required." },
        { status: 400 }
      );
    }

    const body = (await req.json()) as UpdateContactStatusPayload;
    const updateData: Prisma.ContactInquiryUpdateInput = {};
    let hasFieldUpdate = false;

    if (body.name !== undefined) {
      const name = normalizeText(String(body.name ?? ""));
      if (name.length < 2) {
        return NextResponse.json(
          { success: false, message: "Enter a valid name." },
          { status: 400 }
        );
      }
      updateData.name = name;
      hasFieldUpdate = true;
    }

    if (body.mobile !== undefined) {
      const mobile = normalizePhone(String(body.mobile ?? ""));
      if (!isValidPhone(mobile)) {
        return NextResponse.json(
          { success: false, message: "Enter a valid 10-digit mobile number." },
          { status: 400 }
        );
      }
      updateData.mobile = mobile;
      hasFieldUpdate = true;
    }

    if (body.message !== undefined) {
      const message = normalizeText(String(body.message ?? ""));
      if (message.length < 5) {
        return NextResponse.json(
          {
            success: false,
            message: "Message should be at least 5 characters long.",
          },
          { status: 400 }
        );
      }
      if (message.length > 2000) {
        return NextResponse.json(
          {
            success: false,
            message: "Message is too long. Please keep it under 2000 characters.",
          },
          { status: 400 }
        );
      }
      updateData.message = message;
      hasFieldUpdate = true;
    }

    if (body.status !== undefined) {
      const status = body.status;
      if (!Object.values(ContactInquiryStatus).includes(status)) {
        return NextResponse.json(
          { success: false, message: "Invalid contact inquiry status." },
          { status: 400 }
        );
      }

      const now = new Date();
      updateData.status = status;
      updateData.respondedAt =
        status === "CONTACTED" || status === "CLOSED" ? now : null;
      hasFieldUpdate = true;
    }

    if (!hasFieldUpdate) {
      return NextResponse.json(
        { success: false, message: "No fields provided to update." },
        { status: 400 }
      );
    }

    updateData.isRead = true;
    const updated = await prisma.contactInquiry.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Contact inquiry updated.",
      data: {
        id: updated.id,
        name: updated.name,
        mobile: updated.mobile,
        message: updated.message,
        status: updated.status,
        isRead: updated.isRead,
        respondedAt: updated.respondedAt?.toISOString() ?? null,
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
        { success: false, message: "Contact inquiry not found." },
        { status: 404 }
      );
    }

    console.error("PATCH /api/admin/contact/:id error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update contact inquiry." },
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
        { success: false, message: "Contact inquiry id is required." },
        { status: 400 }
      );
    }

    await prisma.contactInquiry.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Contact inquiry deleted.",
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { success: false, message: "Contact inquiry not found." },
        { status: 404 }
      );
    }

    console.error("DELETE /api/admin/contact/:id error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete contact inquiry." },
      { status: 500 }
    );
  }
}
