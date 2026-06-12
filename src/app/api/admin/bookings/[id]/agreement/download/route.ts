import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

function sanitizeDownloadFilename(value: string) {
  const sanitized = value
    .replace(/[\r\n"]/g, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || "signed-agreement.pdf";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const adminId = await getAuthenticatedAdminIdFromCookies();
  if (!adminId) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const agreement = await prisma.signedAgreement.findFirst({
    where: { bookingId: id },
    orderBy: [{ signedAt: "desc" }, { createdAt: "desc" }],
    select: {
      agreementRef: true,
      pdfFileName: true,
      pdfContent: true,
    },
  });

  if (!agreement) {
    return NextResponse.json(
      { success: false, message: "Signed agreement not found." },
      { status: 404 }
    );
  }

  if (!agreement.pdfContent?.byteLength) {
    return NextResponse.json(
      { success: false, message: "The stored agreement PDF is unavailable." },
      { status: 404 }
    );
  }

  const filename = sanitizeDownloadFilename(
    agreement.pdfFileName ??
      `${agreement.agreementRef}-signed-agreement.pdf`
  );
  const content = new Uint8Array(agreement.pdfContent);

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(content.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
