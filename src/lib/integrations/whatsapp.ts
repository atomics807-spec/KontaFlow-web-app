import { createHash, timingSafeEqual } from "node:crypto";
import "server-only";

import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

const GRAPH_VERSION = "v20.0";

export function isWhatsappConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}

export async function sendWhatsappText(to: string, body: string): Promise<{ sent: boolean; id?: string }> {
  const env = getServerEnv();
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    return { sent: false };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { preview_url: false, body: body.slice(0, 4000) },
        }),
      },
    );

    if (!response.ok) {
      logger.warn("whatsapp.send_failed", { status: response.status });
      return { sent: false };
    }

    const payload = (await response.json().catch(() => null)) as
      | { messages?: { id?: string }[] }
      | null;
    return { sent: true, id: payload?.messages?.[0]?.id };
  } catch (error) {
    logger.error("whatsapp.send_error", { error });
    return { sent: false };
  }
}

/** Verifies Meta's X-Hub-Signature-256 over the exact raw body. */
export function verifyWhatsappSignature(rawBody: string, header: string | null): boolean {
  const secret = getServerEnv().WHATSAPP_APP_SECRET;
  if (!secret) return false;
  if (!header?.startsWith("sha256=")) return false;

  const expected = createHash("sha256").update(`${secret}${rawBody}`).digest();
  const provided = Buffer.from(header.slice("sha256=".length), "hex");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

/** Constant-time comparison for shared callback tokens. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
