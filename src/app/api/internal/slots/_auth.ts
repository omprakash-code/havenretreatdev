import { timingSafeEqualString } from "@/lib/security/timingSafeEqual";
import { getAuthenticatedAdminIdFromCookies } from "@/services/auth/adminAuth.server";

function resolveInternalKey(req: Request) {
  const direct = req.headers.get("x-internal-key")?.trim();
  if (direct) return direct;

  const authHeader = req.headers.get("authorization")?.trim();
  if (!authHeader) return "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return "";
  return authHeader.slice("bearer ".length).trim();
}

function isInternalKeyAuthorized(req: Request) {
  const expectedKey =
    process.env.SLOT_SYNC_INTERNAL_KEY ??
    process.env.INTERNAL_API_KEY ??
    process.env.CRON_INTERNAL_KEY ??
    "";

  if (!expectedKey) return false;

  const providedKey = resolveInternalKey(req);
  return Boolean(providedKey && timingSafeEqualString(providedKey, expectedKey));
}

async function isAdminAuthorized() {
  const adminId = await getAuthenticatedAdminIdFromCookies();
  return Boolean(adminId);
}

export async function isInternalSlotEndpointAuthorized(req: Request) {
  return isInternalKeyAuthorized(req) || (await isAdminAuthorized());
}
