import { getServerEnv } from "@/lib/env";
import { hasServiceRole } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import {
  verifyWhatsappChallenge,
  verifyWhatsappSignature,
} from "@/lib/integrations/whatsapp";
import { processWhatsappWebhook } from "@/lib/whatsapp/processor";
import type { WhatsappWebhookPayload } from "@/lib/whatsapp/payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1_000_000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  const expected = getServerEnv().WHATSAPP_VERIFY_TOKEN ?? null;

  if (mode === "subscribe" && verifyWhatsappChallenge(token, expected) && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "content-type": "text/plain", "cache-control": "no-store" },
    });
  }
  return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    logger.warn("whatsapp.payload_too_large");
    return new Response("Payload too large", { status: 413 });
  }

  if (!verifyWhatsappSignature(raw, request.headers.get("x-hub-signature-256"))) {
    logger.warn("whatsapp.bad_signature");
    return new Response("Forbidden", { status: 403 });
  }

  if (!hasServiceRole()) {
    logger.error("whatsapp.service_role_missing");
    return new Response("Not configured", { status: 503 });
  }

  let payload: WhatsappWebhookPayload;
  try {
    payload = JSON.parse(raw) as WhatsappWebhookPayload;
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  if (payload.object !== "whatsapp_business_account") {
    return new Response("OK", { status: 200, headers: { "cache-control": "no-store" } });
  }

  try {
    const result = await processWhatsappWebhook(payload);
    if (result.retryable) {
      return new Response("Retry", { status: 500, headers: { "cache-control": "no-store" } });
    }
    return new Response("OK", { status: 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    logger.error("whatsapp.webhook_failed", { error });
    return new Response("Retry", { status: 500, headers: { "cache-control": "no-store" } });
  }
}
