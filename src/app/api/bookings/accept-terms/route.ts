// src/app/api/bookings/accept-terms/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import { BOOKING_SESSION_EXPIRED_MODAL_MESSAGE } from "@/lib/booking-session-expiry";
import { getRangeBookingApiIdentity } from "@/services/booking/range-booking-api-session";
import {
  RangeBookingSessionError,
  requireActiveRangeBookingSession,
} from "@/services/booking/range-booking-session.service";
import { normalizeAcknowledgedClauses } from "@/lib/agreement-acknowledgments";
import { buildHavenAgreementHtmlSnapshot } from "@/lib/agreement-snapshot";

function extractRequestIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return req.headers.get("x-real-ip");
}

function isEditableBookingStatus(status: string) {
  return (
    status === "INCOMPLETE" ||
    status === "AWAITING_PAYMENT" ||
    status === "PAYMENT_PROCESSING"
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req
      .json()
      .catch(() => null)) as {
      bookingId?: string;
      signerName?: string;
      signatureImage?: string;
      confirmationAccepted?: boolean;
      acknowledgedClauses?: unknown;
      agreementVersion?: string;
    } | null;
    const bookingId = body?.bookingId;
    const acknowledgedClauses = normalizeAcknowledgedClauses(
      body?.acknowledgedClauses
    );

    if (
      !bookingId ||
      !body?.signerName ||
      !body?.signatureImage ||
      !body?.confirmationAccepted ||
      !acknowledgedClauses
    ) {
      return bookingErrorResponse(
        400,
        "INVALID_REQUEST",
        "All 33 agreement clauses, signerName, signatureImage, and signature confirmation are required."
      );
    }

    const rangeIdentity = await getRangeBookingApiIdentity(bookingId);
    if (rangeIdentity) {
      const { booking } = await requireActiveRangeBookingSession(rangeIdentity);
      if (booking.bookingStatus === "CONFIRMED") {
        return bookingErrorResponse(
          409,
          "BOOKING_FINALIZED",
          "This booking is already confirmed.",
          { bookingRef: booking.bookingRef }
        );
      }
      if (!isEditableBookingStatus(booking.bookingStatus)) {
        return bookingErrorResponse(
          409,
          "SESSION_EXPIRED",
          BOOKING_SESSION_EXPIRED_MODAL_MESSAGE
        );
      }

      const template = await prisma.agreementTemplate.findFirst({
        where: { isActive: true },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      });
      if (!template) {
        return bookingErrorResponse(
          409,
          "AGREEMENT_TEMPLATE_NOT_FOUND",
          "No active agreement template is available yet."
        );
      }

      const signedAt = new Date();
      await prisma.$transaction(async (tx) => {
        await requireActiveRangeBookingSession(rangeIdentity, signedAt, tx);
        await tx.signedAgreement.deleteMany({ where: { bookingId } });
        await tx.signedAgreement.create({
          data: {
            bookingId,
            agreementTemplateId: template.id,
            signerName: body.signerName!.trim(),
            signerEmail: booking.contactEmail ?? "",
            signedAt,
            signatureImage: body.signatureImage!,
            ipAddress: extractRequestIp(req),
            userAgent: req.headers.get("user-agent"),
            agreementVersion: body.agreementVersion ?? template.version,
            agreementHtmlSnapshot: buildHavenAgreementHtmlSnapshot({
              title: template.title,
              version: body.agreementVersion ?? template.version,
              acknowledgedClauses,
            }),
            acknowledgedClauses,
            confirmationAccepted: true,
          },
        });
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            termsAcceptedAt: booking.termsAcceptedAt ?? signedAt,
            bookingStatus: "AWAITING_PAYMENT",
            paymentStatus: "INITIALIZED",
          },
        });
      });
      return NextResponse.json({ success: true });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return bookingErrorResponse(
        404,
        "BOOKING_NOT_FOUND",
        "Booking not found."
      );
    }

    if (booking.bookingStatus === "CONFIRMED") {
      return bookingErrorResponse(
        409,
        "BOOKING_FINALIZED",
        "This booking is already confirmed.",
        { bookingRef: booking.bookingRef }
      );
    }

    if (!isEditableBookingStatus(booking.bookingStatus)) {
      return bookingErrorResponse(
        409,
        "SESSION_EXPIRED",
        BOOKING_SESSION_EXPIRED_MODAL_MESSAGE
      );
    }

    const template = await prisma.agreementTemplate.findFirst({
      where: { isActive: true },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    if (!template) {
      return bookingErrorResponse(
        409,
        "AGREEMENT_TEMPLATE_NOT_FOUND",
        "No active agreement template is available yet."
      );
    }

    const signedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.signedAgreement.deleteMany({
        where: { bookingId },
      });

      await tx.signedAgreement.create({
        data: {
          bookingId,
          agreementTemplateId: template.id,
          signerName: body.signerName!.trim(),
          signerEmail: booking.contactEmail ?? "",
          signedAt,
          signatureImage: body.signatureImage!,
          ipAddress: extractRequestIp(req),
          userAgent: req.headers.get("user-agent"),
          agreementVersion: body.agreementVersion ?? template.version,
          agreementHtmlSnapshot: buildHavenAgreementHtmlSnapshot({
            title: template.title,
            version: body.agreementVersion ?? template.version,
            acknowledgedClauses,
          }),
          acknowledgedClauses,
          confirmationAccepted: true,
        },
      });

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          termsAcceptedAt: booking.termsAcceptedAt ?? signedAt,
          bookingStatus: "AWAITING_PAYMENT",
          paymentStatus: "INITIALIZED",
          razorpayOrderId: null,
          razorpayPaymentId: null,
          razorpaySignature: null,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RangeBookingSessionError) {
      return bookingErrorResponse(
        error.code === "BOOKING_NOT_FOUND" ? 404 : 409,
        error.code,
        error.message
      );
    }
    console.error("ACCEPT_TERMS_ERROR:", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Unable to accept terms right now."
    );
  }
}
