export const RETRY_BASE_MS = 2_000;
export const RETRY_MAX_MS = 5 * 60_000;

/**
 * Exponential backoff with bounded jitter. Jitter stops many devices that
 * reconnect together from hitting the API in one burst.
 */
export function nextRetryDelay(attempts: number, random: () => number = Math.random): number {
  const safeAttempts = Math.max(0, Math.min(attempts, 12));
  const base = Math.min(RETRY_BASE_MS * 2 ** safeAttempts, RETRY_MAX_MS);
  const jitter = 0.8 + Math.max(0, Math.min(random(), 1)) * 0.4;
  return Math.round(Math.min(base * jitter, RETRY_MAX_MS));
}

const ATTENTION_CODES = new Set([
  "unauthenticated",
  "forbidden",
  "no_workspace",
  "invalid_payload",
  "validation_failed",
  "check_violation",
  "conflict",
  "duplicate_conflict",
  "insufficient_privilege",
  "restricted",
]);

const RETRY_CODES = new Set([
  "network_error",
  "timeout",
  "rate_limited",
  "server_error",
  "temporarily_unavailable",
  "integration_unavailable",
]);

/** Validation, permission and conflict failures need a person. Network/server failures can retry. */
export function classifySyncFailure(code?: string | null, status?: number): "attention" | "retry" {
  if (code && ATTENTION_CODES.has(code)) return "attention";
  if (code && RETRY_CODES.has(code)) return "retry";
  if (status === 401 || status === 403 || status === 409 || status === 422) return "attention";
  return "retry";
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}
