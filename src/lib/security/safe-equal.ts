import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time string compare that tolerates unequal lengths. */
export function safeEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}
