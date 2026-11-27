import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function digestEquals(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashWebhookToken(token: string): string {
  return sha256Hex(token);
}

export function verifyWebhookTokenHash(token: string | null, expectedHash: string | null): boolean {
  if (!token || !expectedHash) return false;
  const actual = Buffer.from(hashWebhookToken(token), "hex");
  let expected: Buffer;
  try {
    expected = Buffer.from(expectedHash, "hex");
  } catch {
    return false;
  }
  return digestEquals(actual, expected);
}

/**
 * Verifies an HMAC over the exact raw request body. MTN's standard callback
 * does not publish a signature, so adapters use this only when the merchant or
 * aggregator has supplied a signing secret. Callback-token verification and an
 * authoritative status fetch are still required for MTN.
 */
export function verifyHmacSignature(
  rawBody: string,
  header: string | null,
  secret: string | null,
): boolean {
  if (!secret || !header) return false;
  const value = header.startsWith("sha256=") ? header.slice("sha256=".length) : header;
  let provided: Buffer;
  try {
    provided = Buffer.from(value.trim(), "hex");
  } catch {
    return false;
  }
  if (provided.length !== 32) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  return digestEquals(expected, provided);
}
