/** Exponential backoff with jitter, capped at five minutes. */
export function retryDelaySeconds(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(300, 5 * 2 ** Math.max(0, attempt - 1));
  return Math.round(base * (0.7 + random() * 0.6));
}
