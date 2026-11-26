import { getServerEnv } from "@/lib/env";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { logWhatsappMessage, resolveChannelIdentity } from "@/lib/channels";
import { runAssistant } from "@/lib/ai/assistant";
import { isAiConfigured } from "@/lib/ai/client";
import { sendWhatsappText, verifyWhatsappSignature } from "@/lib/integrations/whatsapp";
import { logger } from "@/lib/logger";
import type { WorkspaceRow } from "@/types/database";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  const expected = getServerEnv().WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && expected && token === expected) {
    return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

type WebhookPayload = {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: {
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
        }[];
      };
    }[];
  }[];
};

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWhatsappSignature(raw, signature)) {
    logger.warn("whatsapp.bad_signature");
    return new Response("Forbidden", { status: 403 });
  }

  if (!hasServiceRole()) {
    logger.error("whatsapp.service_role_missing");
    return new Response("Not configured", { status: 503 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw) as WebhookPayload;
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  const value = payload.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  const from = message?.from;

  if (!message || !from || message.type !== "text" || !message.text?.body) {
    return new Response("OK", { status: 200 });
  }

  if (!rateLimit(`wa:${from}`, 20)) {
    return new Response("OK", { status: 200 });
  }

  const body = message.text.body.slice(0, 2000);
  const identity = await resolveChannelIdentity("whatsapp", from);

  await logWhatsappMessage({
    workspaceId: identity?.workspaceId ?? null,
    waMessageId: message.id ?? null,
    direction: "inbound",
    fromPhone: from,
    toPhone: value?.metadata?.phone_number_id ?? "kontaflow",
    body,
    status: "received",
  }).catch(() => undefined);

  if (!identity) {
    await reply(
      from,
      "This WhatsApp number is not linked to a KontaFlow business yet. Open Settings > Connected channels in KontaFlow and add this number.",
      null,
    );
    return new Response("OK", { status: 200 });
  }

  let answer: string;
  if (!isAiConfigured()) {
    answer = "The KontaFlow assistant is not configured on this deployment. Please use the web app.";
  } else {
    try {
      const admin = createAdminClient();
      const { data: workspace } = await admin
        .from("workspaces")
        .select("*")
        .eq("id", identity.workspaceId)
        .maybeSingle();

      if (!workspace) {
        answer = "This workspace is no longer available.";
      } else {
        const result = await runAssistant({
          workspace: workspace as WorkspaceRow,
          userId: identity.userId,
          locale: "en",
          message: body,
          serviceRole: true,
        });
        answer = result.reply;
      }
    } catch (error) {
      logger.error("whatsapp.assistant_failed", { error });
      answer = "Sorry, I could not read your books just now. Please try again in a moment.";
    }
  }

  await reply(from, answer, identity.workspaceId);
  return new Response("OK", { status: 200 });
}

async function reply(to: string, body: string, workspaceId: string | null): Promise<void> {
  const result = await sendWhatsappText(to, body);
  await logWhatsappMessage({
    workspaceId,
    waMessageId: result.id ?? null,
    direction: "outbound",
    fromPhone: "kontaflow",
    toPhone: to,
    body,
    status: result.sent ? "sent" : "failed",
  }).catch(() => undefined);
}
