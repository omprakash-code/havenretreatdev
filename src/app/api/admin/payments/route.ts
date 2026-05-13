import { Prisma, PaymentStatus } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { bookingErrorResponse } from "@/lib/booking-api-response";
import { prisma } from "@/lib/db";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

const IST_TIMEZONE = "Asia/Kolkata";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function humanizeTag(input: string) {
  return input
    .trim()
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .join(" ");
}

function deriveAttemptReason(input: {
  paymentStatus: PaymentStatus;
  transactionId: string | null;
  bookingStatus: string;
  bookingPaymentStatus: string | null;
  bookingRazorpayPaymentId: string | null;
  slotStatus: string;
  method: string | null;
}) {
  if (input.paymentStatus === PaymentStatus.CANCELLED) {
    if (input.method?.startsWith("CHECKOUT_DISMISSED")) {
      const parts = input.method.split("|");
      const source = parts.find((part) => part.startsWith("SRC:"));
      const reason = parts.find((part) => part.startsWith("RSN:"));

      const sourceText = source
        ? humanizeTag(source.replace("SRC:", ""))
        : "checkout";
      const reasonText = reason
        ? humanizeTag(reason.replace("RSN:", ""))
        : "dismissed";

      return `Checkout ${reasonText}. Source: ${sourceText}.`;
    }

    return "Checkout was dismissed before payment completion.";
  }

  if (input.paymentStatus !== PaymentStatus.FAILED) return null;

  if (
    input.bookingStatus === "CONFIRMED" &&
    input.bookingPaymentStatus === "PAID" &&
    input.bookingRazorpayPaymentId &&
    input.transactionId &&
    input.bookingRazorpayPaymentId !== input.transactionId
  ) {
    return "Duplicate payment attempt. This booking was already paid from another session.";
  }

  if (input.slotStatus === "BOOKED" && input.bookingStatus !== "CONFIRMED") {
    return "Slot was already booked before this payment could be confirmed.";
  }

  if (input.slotStatus !== "LOCKED" && input.bookingStatus !== "CONFIRMED") {
    return "Reservation lock expired before payment verification completed.";
  }

  if (!input.transactionId) {
    return "Transaction reference is missing for this failed attempt.";
  }

  return "Payment verification failed due to booking or session validation.";
}

export async function GET(req: Request) {
  try {
    const adminId = await getAuthenticatedAdminIdFromCookies();
    if (!adminId) {
      return bookingErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
    }

    const { searchParams } = new URL(req.url);

    const page = Math.max(
      Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
      1
    );
    const rawPageSize =
      Number.parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) ||
      DEFAULT_PAGE_SIZE;
    const pageSize = Math.min(Math.max(rawPageSize, 1), MAX_PAGE_SIZE);
    const status = searchParams.get("status")?.trim() ?? "";
    const bookingRef = searchParams.get("bookingRef")?.trim() ?? "";
    const transactionId =
      searchParams.get("transactionId")?.trim() ?? "";

    const statusFilter = Object.values(PaymentStatus).includes(
      status as PaymentStatus
    )
      ? (status as PaymentStatus)
      : null;

    const where: Prisma.PaymentWhereInput = {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(bookingRef
        ? {
            booking: {
              bookingRef: {
                contains: bookingRef,
                mode: "insensitive",
              },
            },
          }
        : {}),
      ...(transactionId
        ? {
            transactionId: {
              contains: transactionId,
              mode: "insensitive",
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          booking: {
            select: {
              bookingRef: true,
              contactName: true,
              contactPhone: true,
              bookingStatus: true,
              paymentStatus: true,
              totalAmount: true,
              razorpayPaymentId: true,
              theatre: {
                select: {
                  name: true,
                  location: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              slot: {
                select: {
                  date: true,
                  startTime: true,
                  endTime: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return Response.json({
      success: true,
      data: rows.map((payment) => {
        const attemptReason = deriveAttemptReason({
          paymentStatus: payment.status,
          transactionId: payment.transactionId,
          bookingStatus: payment.booking.bookingStatus,
          bookingPaymentStatus: payment.booking.paymentStatus,
          bookingRazorpayPaymentId: payment.booking.razorpayPaymentId,
          slotStatus: payment.booking.slot.status,
          method: payment.method,
        });

        return {
          id: payment.id,
          bookingRef: payment.booking.bookingRef,
          customerName: payment.booking.contactName,
          contactPhone: payment.booking.contactPhone,
          theatreName: payment.booking.theatre.name,
          locationName: payment.booking.theatre.location.name,
          slotDate: formatInTimeZone(
            payment.booking.slot.date,
            IST_TIMEZONE,
            "yyyy-MM-dd"
          ),
          slotStartTime: payment.booking.slot.startTime,
          slotEndTime: payment.booking.slot.endTime,
          totalAmount: payment.booking.totalAmount,
          payableAmount: payment.amount,
          status: payment.status,
          provider: payment.provider,
          transactionId: payment.transactionId,
          attemptReason,
          createdAt: payment.createdAt.toISOString(),
        };
      }),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
      },
    });
  } catch (error) {
    console.error("ADMIN_PAYMENTS_FETCH_ERROR", error);
    return bookingErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to fetch payment records."
    );
  }
}
