/**
 * Small fixed-window limiter for webhook and channel endpoints.
 *
 * Process-local only: on serverless platforms each instance keeps its own
 * window, so this is a coarse protection against accidental floods. Durable
 * per-phone quotas live in the database (consume_channel_quota) and edge rate
 * limits belong in Cloudflare.
 */
type Window = { count: number; resetAt: number };

const store = new Map<string, Window>();
const MAX_ENTRIES = 5000;

export function rateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    if (store.size > MAX_ENTRIES) {
      for (const [candidate, value] of store) {
        if (value.resetAt <= now) store.delete(candidate);
      }
    }
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

export function resetRateLimits(): void {
  store.clear();
}
