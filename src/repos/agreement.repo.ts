import { prisma } from "@/lib/db";

export function findActiveAgreementTemplate() {
  return prisma.agreementTemplate.findFirst({
    where: {
      isActive: true,
    },
    orderBy: [
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
  });
}
