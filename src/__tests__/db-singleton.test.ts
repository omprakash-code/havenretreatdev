import { afterEach, describe, expect, it, vi } from "vitest";

describe("prisma db singleton", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unmock("@/lib/db");
    vi.unmock("@prisma/client");
    vi.unmock("@prisma/adapter-pg");
  });

  it("reuses one Prisma client across repeated accesses", async () => {
    const prismaClientCtor = vi.fn(
      class PrismaClientMock {
        booking = {
          findUnique: vi.fn(),
        };
        $queryRaw = vi.fn();
      }
    );
    const prismaPgCtor = vi.fn(class PrismaPgMock {});

    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

    vi.doMock("@prisma/client", () => ({
      PrismaClient: prismaClientCtor,
    }));
    vi.doMock("@prisma/adapter-pg", () => ({
      PrismaPg: prismaPgCtor,
    }));

    const { prisma } = await import("@/lib/db");

    void prisma.booking;
    void prisma.$queryRaw;
    void prisma.booking;

    expect(prismaPgCtor).toHaveBeenCalledTimes(1);
    expect(prismaClientCtor).toHaveBeenCalledTimes(1);
  });
});
