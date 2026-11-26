import { createHmac, timingSafeEqual } from "node:crypto";
import { safeEqual } from "@/lib/security/safe-equal";

export { safeEqual };

/**
 * Meta signs the exact raw webhook body with the app secret:
 * `sha256=<hex hmac>`. The digest is compared without early exit.
 */
export function verifyHmacSignature(rawBody: string, header: string | null, secret: string | null): boolean {
  if (!secret || !header?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(header.slice("sha256=".length), "hex");
  } catch {
    return false;
  }

  return provided.length === expected.length && timingSafeEqual(expected, provided);
}
