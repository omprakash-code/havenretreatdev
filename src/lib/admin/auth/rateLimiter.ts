type RateLimitRecord = {
  count: number;
  firstAttempt: number;
};

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute
const MAX_KEYS = 10_000;

const store = new Map<string, RateLimitRecord>();
let lastCleanupAt = 0;

function cleanupExpired(now: number) {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;

  for (const [key, value] of store.entries()) {
    if (now - value.firstAttempt > WINDOW_MS) {
      store.delete(key);
    }
  }

  if (store.size <= MAX_KEYS) return;

  const keys = [...store.entries()]
    .sort((a, b) => a[1].firstAttempt - b[1].firstAttempt)
    .map(([key]) => key);
  const overflow = store.size - MAX_KEYS;
  for (let index = 0; index < overflow; index += 1) {
    const key = keys[index];
    if (key) store.delete(key);
  }
}

export function checkRateLimit(key: string) {
  const now = Date.now();
  const normalizedKey = key.trim();
  if (!normalizedKey) return { allowed: false };

  cleanupExpired(now);
  const record = store.get(normalizedKey);

  if (!record) {
    store.set(normalizedKey, { count: 1, firstAttempt: now });
    return { allowed: true };
  }

  if (now - record.firstAttempt > WINDOW_MS) {
    store.set(normalizedKey, { count: 1, firstAttempt: now });
    return { allowed: true };
  }

  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false };
  }

  record.count += 1;
  return { allowed: true };
}
