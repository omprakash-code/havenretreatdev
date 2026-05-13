import { cookies } from "next/headers";
import crypto from "crypto";

import { prisma } from "@/lib/db";
import {
  type VerifiedAdminSession,
  verifyAdminSessionToken,
} from "@/services/auth/adminSession.server";

type AdminUserSessionSnapshot = {
  id: string;
  role: "ADMIN";
  isActive: boolean;
  lockUntil: Date | null;
  sessionVersion: number;
};

export type AuthenticatedAdminSession = {
  userId: string;
  role: "ADMIN";
  sessionVersion: number;
};

type AuthCacheEntry = {
  value: AuthenticatedAdminSession | null;
  expiresAt: number;
  userId: string | null;
};

const AUTH_CACHE_TTL_MS = Number(process.env.ADMIN_AUTH_CACHE_TTL_MS ?? 2000);
const AUTH_CACHE_MAX_ENTRIES = Number(
  process.env.ADMIN_AUTH_CACHE_MAX_ENTRIES ?? 500
);
const authCache = new Map<string, AuthCacheEntry>();
const userAuthCacheKeys = new Map<string, Set<string>>();

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function unlinkAuthCacheKeyFromUser(key: string, userId: string | null) {
  if (!userId) return;
  const keys = userAuthCacheKeys.get(userId);
  if (!keys) return;
  keys.delete(key);
  if (keys.size === 0) {
    userAuthCacheKeys.delete(userId);
  }
}

function deleteAuthCacheKey(key: string) {
  const existing = authCache.get(key);
  if (!existing) return;
  authCache.delete(key);
  unlinkAuthCacheKeyFromUser(key, existing.userId);
}

function readAuthCache(key: string): AuthenticatedAdminSession | null | undefined {
  const cached = authCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    deleteAuthCacheKey(key);
    return undefined;
  }
  return cached.value;
}

function evictAuthCacheIfNeeded() {
  if (authCache.size < AUTH_CACHE_MAX_ENTRIES) return;
  const oldestKey = authCache.keys().next().value;
  if (oldestKey) {
    deleteAuthCacheKey(oldestKey);
  }
}

function writeAuthCache(
  key: string,
  value: AuthenticatedAdminSession | null
) {
  const existing = authCache.get(key);
  if (existing) {
    unlinkAuthCacheKeyFromUser(key, existing.userId);
  } else {
    evictAuthCacheIfNeeded();
  }

  const userId = value?.userId ?? null;
  authCache.set(key, {
    value,
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
    userId,
  });

  if (!userId) return;
  const keys = userAuthCacheKeys.get(userId) ?? new Set<string>();
  keys.add(key);
  userAuthCacheKeys.set(userId, keys);
}

function evictUserAuthCache(userId: string) {
  const keys = userAuthCacheKeys.get(userId);
  if (!keys) return;
  for (const key of keys) {
    authCache.delete(key);
  }
  userAuthCacheKeys.delete(userId);
}

async function getAdminSnapshotById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      isActive: true,
      lockUntil: true,
      sessionVersion: true,
    },
  });
}

function isAdminSessionRevokedOrInvalid(
  tokenSession: VerifiedAdminSession,
  user: AdminUserSessionSnapshot
) {
  if (tokenSession.role !== "ADMIN") return true;
  if (user.role !== "ADMIN") return true;
  if (!user.isActive) return true;
  if (user.lockUntil && user.lockUntil > new Date()) return true;

  // Enforce v2 tokens with sessionVersion for revocation support.
  if (tokenSession.sessionVersion == null) return true;

  return tokenSession.sessionVersion !== user.sessionVersion;
}

export async function validateAdminSessionTokenAgainstDb(token: string) {
  const cacheKey = hashToken(token);
  const cached = readAuthCache(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const tokenSession = verifyAdminSessionToken(token);
  if (!tokenSession) {
    writeAuthCache(cacheKey, null);
    return null;
  }
  if (tokenSession.role !== "ADMIN") {
    writeAuthCache(cacheKey, null);
    return null;
  }

  const user = await getAdminSnapshotById(tokenSession.userId);
  if (!user || user.role !== "ADMIN") {
    writeAuthCache(cacheKey, null);
    return null;
  }

  if (
    isAdminSessionRevokedOrInvalid(
      tokenSession,
      user as AdminUserSessionSnapshot
    )
  ) {
    writeAuthCache(cacheKey, null);
    return null;
  }

  const result: AuthenticatedAdminSession = {
    userId: user.id,
    role: "ADMIN",
    sessionVersion: user.sessionVersion,
  };

  writeAuthCache(cacheKey, result);
  return result;
}

export async function getAuthenticatedAdminSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get("ds_admin_session")?.value ?? "";
  if (!token) return null;

  return validateAdminSessionTokenAgainstDb(token);
}

export async function getAuthenticatedAdminIdFromCookies() {
  const session = await getAuthenticatedAdminSessionFromCookies();
  return session?.userId ?? null;
}

export async function incrementAdminSessionVersion(userId: string) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      sessionVersion: {
        increment: 1,
      },
    },
    select: {
      id: true,
      sessionVersion: true,
      role: true,
    },
  });
  evictUserAuthCache(userId);
  return updated;
}
