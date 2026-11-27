import "server-only";

import { createHash } from "node:crypto";
import { hasServiceRole, createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { rateLimitDetailed, type RateLimitDecision } from "@/lib/rate-limit";

function bucketKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Two-layer limiter: the process-local window is the fast gate, and the
 * Postgres bucket makes the limit hold across serverless instances. If the
 * database is unavailable the local window still protects the instance.
 */
export async function consumeRateLimitDetailed(
  key: string,
  limit: number,
  windowSeconds = 60,
): Promise<RateLimitDecision> {
  const local = rateLimitDetailed(key, limit, windowSeconds * 1000);
  if (!local.allowed) return local;
  if (!hasServiceRole()) return local;

  try {
    const { data, error } = await createAdminClient().rpc("consume_security_rate_limit_v2", {
      p_key: bucketKey(key),
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error || !data) {
      if (error) logger.warn("security.rate_limit_db_failed", { code: error.code });
      return local;
    }
    const resetAt = new Date(data.reset_at).getTime();
    return {
      allowed: data.allowed === true,
      limit,
      remaining: Number(data.remaining ?? 0),
      resetAt: Number.isFinite(resetAt) ? resetAt : local.resetAt,
    };
  } catch (error) {
    logger.warn("security.rate_limit_db_unavailable", { error });
    return local;
  }
}

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds = 60,
): Promise<boolean> {
  return (await consumeRateLimitDetailed(key, limit, windowSeconds)).allowed;
}

export function rateLimitHeaders(decision: RateLimitDecision): Record<string, string> {
  const retryAfter = Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000));
  return {
    "retry-after": String(retryAfter),
    "x-ratelimit-limit": String(decision.limit),
    "x-ratelimit-remaining": String(decision.remaining),
    "x-ratelimit-reset": new Date(decision.resetAt).toISOString(),
  };
}
