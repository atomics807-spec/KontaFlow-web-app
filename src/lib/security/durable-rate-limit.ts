import "server-only";

import { createHash } from "node:crypto";
import { hasServiceRole, createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

function bucketKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Two-layer limiter: the process-local window is the fast gate, and the
 * Postgres bucket makes the limit hold across serverless instances. If the
 * database is unavailable the local window still protects the instance.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds = 60,
): Promise<boolean> {
  if (!rateLimit(key, limit, windowSeconds * 1000)) return false;
  if (!hasServiceRole()) return true;

  try {
    const { data, error } = await createAdminClient().rpc("consume_security_rate_limit", {
      p_key: bucketKey(key),
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      logger.warn("security.rate_limit_db_failed", { code: error.code });
      return true;
    }
    return data !== false;
  } catch (error) {
    logger.warn("security.rate_limit_db_unavailable", { error });
    return true;
  }
}
