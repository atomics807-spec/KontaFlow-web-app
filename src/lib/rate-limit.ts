/**
 * Small fixed-window limiter for webhook and channel endpoints.
 *
 * Process-local only: on serverless platforms each instance keeps its own
 * window. `consumeRateLimit` adds the shared Postgres bucket so limits hold
 * across instances. This local layer is the fast fail-closed gate and keeps
 * abuse protection alive if the database is briefly unavailable.
 */
type Window = { count: number; resetAt: number };

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

const store = new Map<string, Window>();
const MAX_ENTRIES = 5000;

export function rateLimitDetailed(key: string, limit: number, windowMs = 60_000): RateLimitDecision {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    if (store.size > MAX_ENTRIES) {
      for (const [candidate, value] of store) {
        if (value.resetAt <= now) store.delete(candidate);
      }
    }
    return { allowed: true, limit, remaining: Math.max(limit - 1, 0), resetAt };
  }

  if (entry.count >= limit) {
    return { allowed: false, limit, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return { allowed: true, limit, remaining: Math.max(limit - entry.count, 0), resetAt: entry.resetAt };
}

export function rateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  return rateLimitDetailed(key, limit, windowMs).allowed;
}

export function resetRateLimits(): void {
  store.clear();
}
