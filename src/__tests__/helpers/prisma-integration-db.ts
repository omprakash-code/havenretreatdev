import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

function loadDatabaseUrlFromEnvFiles() {
  const candidateFiles = [".env.test.local", ".env.test", ".env.local", ".env"];

  for (const fileName of candidateFiles) {
    const filePath = path.resolve(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      if (key !== "TEST_DATABASE_URL" && key !== "DATABASE_URL") continue;

      const raw = trimmed.slice(separatorIndex + 1).trim();
      const normalized = raw.replace(/^['"]|['"]$/g, "");
      if (normalized) return normalized;
    }
  }

  return null;
}

export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  loadDatabaseUrlFromEnvFiles();

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL or DATABASE_URL is required for coupon integration tests."
  );
}

if (
  /prod|production/i.test(testDatabaseUrl) &&
  process.env.ALLOW_COUPON_TEST_ON_PROD !== "true"
) {
  throw new Error(
    "Refusing to run coupon integration tests against a production-like database URL."
  );
}

export const basePrisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: testDatabaseUrl,
  }),
});

type TxClient = Prisma.TransactionClient;

let activeTx: TxClient | null = null;
const rollbackSignal = Symbol("ROLLBACK_SIGNAL");

export function requireTx() {
  if (!activeTx) {
    throw new Error(
      "No active transaction. Wrap calls in withRollbackTransaction()."
    );
  }
  return activeTx;
}

export const prismaProxy = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (prop === "$transaction") {
      return async (
        arg: ((tx: TxClient) => Promise<unknown>) | Array<Promise<unknown>>
      ) => {
        const tx = requireTx();
        if (typeof arg === "function") {
          const txWithRaw = tx as TxClient & {
            $executeRawUnsafe: (sql: string) => Promise<unknown>;
          };
          const savepointName = `sp_${randomUUID().replace(/-/g, "")}`;

          await txWithRaw.$executeRawUnsafe(`SAVEPOINT ${savepointName}`);
          try {
            const result = await arg(tx);
            await txWithRaw.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepointName}`);
            return result;
          } catch (error) {
            await txWithRaw.$executeRawUnsafe(
              `ROLLBACK TO SAVEPOINT ${savepointName}`
            );
            await txWithRaw.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepointName}`);
            throw error;
          }
        }
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        throw new Error(
          "Unsupported $transaction signature in coupon integration tests."
        );
      };
    }

    if (prop === "$connect") return async () => undefined;
    if (prop === "$disconnect") return async () => undefined;

    const tx = requireTx() as unknown as Record<string, unknown>;
    const value = tx[String(prop)];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(tx);
    }
    return value;
  },
});

export async function withRollbackTransaction<T>(
  fn: () => Promise<T>
): Promise<T> {
  let output: T | undefined;
  let callbackError: unknown;

  await basePrisma
    .$transaction(async (tx) => {
      activeTx = tx;
      try {
        output = await fn();
      } catch (error) {
        callbackError = error;
      } finally {
        activeTx = null;
      }

      throw rollbackSignal;
    })
    .catch((error) => {
      if (error !== rollbackSignal) {
        throw error;
      }
    });

  if (callbackError) {
    throw callbackError;
  }

  return output as T;
}
