import "server-only";

import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { safeEqual, verifyHmacSignature } from "@/lib/whatsapp/signature";

export { safeEqual };

const TEXT_LIMIT = 4096;

export type WhatsappSendResult = {
  sent: boolean;
  id?: string;
  reason?: "not_configured" | "outside_window" | "invalid_recipient" | "provider_error" | "network_error";
  status?: number;
  errorCode?: string;
  errorTitle?: string;
  retryable?: boolean;
};

type TemplateComponent = {
  type: "header" | "body" | "button";
  parameters?: { type: "text"; text: string }[];
  sub_type?: string;
  index?: string;
};

export function isWhatsappConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}

export function whatsappRecipient(to: string): string {
  return to.replace(/[^\d]/g, "");
}

export function isCustomerServiceWindowOpen(expiresAt: string | Date | null | undefined): boolean {
  if (!expiresAt) return false;
  const time = typeof expiresAt === "string" ? new Date(expiresAt).getTime() : expiresAt.getTime();
  return Number.isFinite(time) && time > Date.now();
}

async function graphRequest(body: Record<string, unknown>): Promise<WhatsappSendResult> {
  const env = getServerEnv();
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    return { sent: false, reason: "not_configured" };
  }

  const recipient = whatsappRecipient(String(body.to ?? ""));
  if (!/^[1-9][0-9]{6,14}$/.test(recipient)) {
    return { sent: false, reason: "invalid_recipient" };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ ...body, to: recipient }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    const payload = (await response.json().catch(() => null)) as
      | {
          messages?: { id?: string }[];
          error?: { message?: string; code?: number; error_subcode?: number; type?: string };
        }
      | null;

    if (!response.ok) {
      logger.warn("whatsapp.send_failed", {
        status: response.status,
        code: payload?.error?.code,
        subcode: payload?.error?.error_subcode,
      });
      return {
        sent: false,
        reason: "provider_error",
        status: response.status,
        errorCode: payload?.error?.code ? String(payload.error.code) : String(response.status),
        errorTitle: payload?.error?.message?.slice(0, 200) ?? "WhatsApp rejected the message",
        retryable: response.status === 429 || response.status >= 500,
      };
    }

    return { sent: true, id: payload?.messages?.[0]?.id };
  } catch (error) {
    logger.error("whatsapp.send_error", { error });
    return { sent: false, reason: "network_error", retryable: true };
  }
}

/**
 * Free-form replies are only legal inside the 24-hour customer-service window
 * opened by the user's last inbound message. Callers must supply that window;
 * there is deliberately no "send anyway" default.
 */
export async function sendWhatsappText(
  to: string,
  body: string,
  options: { customerServiceWindowExpiresAt: string | Date },
): Promise<WhatsappSendResult> {
  if (!isCustomerServiceWindowOpen(options.customerServiceWindowExpiresAt)) {
    return { sent: false, reason: "outside_window" };
  }

  const text = body.trim().slice(0, TEXT_LIMIT);
  if (!text) return { sent: false, reason: "provider_error", errorTitle: "Empty message" };

  return graphRequest({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: false, body: text },
  });
}

/**
 * Approved templates are the only way to start a conversation or send outside
 * the customer-service window. The template must exist in the business
 * account; Meta owns approval and category rules.
 */
export async function sendWhatsappTemplate(
  to: string,
  params: {
    name: string;
    language: string;
    components?: TemplateComponent[];
  },
): Promise<WhatsappSendResult> {
  return graphRequest({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: params.name,
      language: { code: params.language },
      ...(params.components?.length ? { components: params.components } : {}),
    },
  });
}

/** Verifies Meta's X-Hub-Signature-256 over the exact raw body. */
export function verifyWhatsappSignature(rawBody: string, header: string | null): boolean {
  return verifyHmacSignature(rawBody, header, getServerEnv().WHATSAPP_APP_SECRET ?? null);
}

export function verifyWhatsappChallenge(token: string | null, expected: string | null): boolean {
  return Boolean(token && expected && safeEqual(token, expected));
}
