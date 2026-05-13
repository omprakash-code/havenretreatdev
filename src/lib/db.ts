import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

let modulePrisma: PrismaClient | undefined;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
    }),
  });
}

function getPrismaClient() {
  if (modulePrisma) {
    return modulePrisma;
  }

  if (globalForPrisma.prisma) {
    modulePrisma = globalForPrisma.prisma;
    return modulePrisma;
  }

  modulePrisma = createPrismaClient();
  globalForPrisma.prisma = modulePrisma;
  return modulePrisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
  set(_target, prop, value) {
    const client = getPrismaClient();
    return Reflect.set(client, prop, value, client);
  },
});
