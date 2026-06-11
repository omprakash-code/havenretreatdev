import {
  PaymentStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";

type DbClient = Prisma.TransactionClient | PrismaClient;

export async function resolveTerminalAbandonedPaymentStatus(
  db: DbClient,
  bookingId: string
) {
  const latestPaymentAttempt = await db.payment.findFirst({
    where: { bookingId },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      method: true,
    },
  });

  if (
    latestPaymentAttempt?.status === PaymentStatus.CANCELLED &&
    latestPaymentAttempt.method?.startsWith("CHECKOUT_DISMISSED")
  ) {
    return PaymentStatus.CANCELLED;
  }

  return PaymentStatus.EXPIRED;
}
