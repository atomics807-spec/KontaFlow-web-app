import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { getDictionary } from "@/lib/i18n/server";
import { DEFAULT_LOCALE, resolveLocale, type Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { sendWhatsappText, isWhatsappConfigured } from "@/lib/integrations/whatsapp";
import {
  buildWhatsappAccess,
  findWhatsappIdentity,
  markWhatsappOptIn,
  markWhatsappOptOut,
  touchWhatsappInbound,
  verifyPendingWhatsappIdentity,
} from "@/lib/whatsapp/access";
import { handleWhatsappCommand } from "@/lib/whatsapp/handler";
import {
  auditWhatsappEvent,
  logInboundWhatsappMessage,
  logOutboundWhatsappMessage,
  markInboundWhatsappProcessed,
  updateWhatsappDeliveryStatus,
} from "@/lib/whatsapp/messages";
import {
  messageDate,
  messageEvents,
  messageText,
  statusDate,
  statusEvents,
  type WhatsappInboundMessage,
  type WhatsappMetadata,
  type WhatsappWebhookPayload,
} from "@/lib/whatsapp/payload";
import { parseWhatsappIntent } from "@/lib/whatsapp/commands";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export async function processWhatsappWebhook(payload: WhatsappWebhookPayload): Promise<{ retryable: boolean }> {
  const env = getServerEnv();
  const filtered: WhatsappWebhookPayload = {
    ...payload,
    entry: (payload.entry ?? []).filter(
      (entry) =>
        !env.WHATSAPP_BUSINESS_ACCOUNT_ID ||
        !entry.id ||
        entry.id === env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    ),
  };

  let retryable = false;

  for (const event of statusEvents(filtered)) {
    if (
      env.WHATSAPP_PHONE_NUMBER_ID &&
      event.metadata.phone_number_id &&
      event.metadata.phone_number_id !== env.WHATSAPP_PHONE_NUMBER_ID
    ) {
      continue;
    }
    try {
      await updateWhatsappDeliveryStatus({
        status: event.status,
        metadata: event.metadata,
        receivedAt: statusDate(event.status),
      });
    } catch (error) {
      logger.error("whatsapp.status_failed", { error });
      retryable = true;
    }
  }

  // Process the whole batch. Truncating would be unrecoverable: Meta retries
  // the same batch, so the tail would never be reached.
  for (const event of messageEvents(filtered)) {
    const message = event.message;
    if (!message.id || !message.from) continue;

    if (
      env.WHATSAPP_PHONE_NUMBER_ID &&
      event.metadata.phone_number_id &&
      event.metadata.phone_number_id !== env.WHATSAPP_PHONE_NUMBER_ID
    ) {
      logger.warn("whatsapp.wrong_phone_number_id", { messageId: message.id });
      continue;
    }

    const admin = createAdminClient();
    const { data: claim, error: claimError } = await admin.rpc("claim_webhook_event", {
      p_provider: "whatsapp",
      p_external_id: `message:${message.id}`,
      p_payload: { messageId: message.id, type: message.type ?? "unknown" },
    });

    if (claimError) {
      logger.error("whatsapp.claim_failed", { error: claimError });
      retryable = true;
      continue;
    }
    if (!claim?.claimed) {
      logger.info("whatsapp.duplicate_message", { messageId: message.id, status: claim?.status });
      // Another worker holds the lease; ask Meta to retry rather than dropping
      // the message if that worker is actually dead.
      if (claim?.status === "processing") retryable = true;
      continue;
    }

    try {
      await processInboundMessage({
        message,
        metadata: event.metadata,
        displayName: event.contact?.profile?.name,
      });
      await markInboundWhatsappProcessed(message.id);
      await completeEvent(claim.event_id, "processed");
    } catch (error) {
      logger.error("whatsapp.process_failed", { error, messageId: message.id });
      await completeEvent(claim.event_id, "failed", safeError(error));
      retryable = true;
    }
  }

  return { retryable };
}

async function processInboundMessage(params: {
  message: WhatsappInboundMessage;
  metadata: WhatsappMetadata;
  displayName?: string;
}): Promise<void> {
  const { message, metadata, displayName } = params;
  const from = message.from!.trim();
  const receivedAt = messageDate(message);
  const toPhone = metadata.display_phone_number ?? metadata.phone_number_id ?? "kontaflow";
  const text = messageText(message);
  const body = text ?? null;

  if (!rateLimit(`wa:${from}`, getServerEnv().RATE_LIMIT_WHATSAPP_PER_MINUTE)) {
    logger.warn("whatsapp.rate_limited", { messageId: message.id });
    return;
  }

  const identity = await findWhatsappIdentity(from);
  await logInboundWhatsappMessage({
    workspaceId: identity?.workspace_id ?? null,
    message,
    fromPhone: from,
    toPhone,
    body,
    displayName,
    receivedAt,
  });

  if (!identity) {
    const dict = await getDictionary(DEFAULT_LOCALE);
    await reply(from, dict.channels.whatsapp.notLinked, null, new Date(receivedAt.getTime() + WINDOW_MS));
    return;
  }

  if (!identity.verified_at) {
    const window = await touchWhatsappInbound({ identityId: identity.id, at: receivedAt, displayName });
    const dict = await getDictionary(await identityLocale(identity));
    const copy = dict.channels.whatsapp;
    const intent = text ? parseWhatsappIntent(text) : { intent: "unknown" as const };

    if (intent.intent === "stop") {
      await markWhatsappOptOut(identity.id);
      await reply(from, copy.stop, identity.workspace_id, window.windowExpiresAt);
      return;
    }
    if (intent.intent === "start") {
      await markWhatsappOptIn(identity.id);
      await reply(from, copy.optedIn, identity.workspace_id, window.windowExpiresAt);
      return;
    }
    if (identity.opted_out_at) {
      await reply(from, copy.optedOut, identity.workspace_id, window.windowExpiresAt);
      return;
    }
    if (intent.intent === "verify" && intent.code) {
      const result = await verifyPendingWhatsappIdentity(from, intent.code, receivedAt, displayName);
      if (result.status === "verified") {
        const access = await buildWhatsappAccess(result.identity);
        await auditLink(result.identity, "whatsapp.link_verified");
        const success = interpolate(copy.verificationSuccess, {
          workspace: access.workspace.name,
        });
        await reply(from, `${success}\n\n${copy.help}`, identity.workspace_id, window.windowExpiresAt);
        return;
      }
      const messageCopy = verificationCopy(result, copy);
      await reply(from, messageCopy, identity.workspace_id, window.windowExpiresAt);
      return;
    }

    await reply(from, copy.pendingVerification, identity.workspace_id, window.windowExpiresAt);
    return;
  }

  const touched = await touchWhatsappInbound({ identityId: identity.id, at: receivedAt, displayName });
  const access = await buildWhatsappAccess(
    {
      ...identity,
      last_inbound_at: receivedAt.toISOString(),
      service_window_expires_at: touched.windowExpiresAt,
    },
    receivedAt,
  );
  const dict = await getDictionary(access.locale);
  const copy = dict.channels.whatsapp;
  const intent = text ? parseWhatsappIntent(text) : { intent: "unknown" as const };

  if (intent.intent === "stop") {
    await markWhatsappOptOut(identity.id);
    await reply(from, copy.stop, identity.workspace_id, access.windowExpiresAt);
    return;
  }
  if (intent.intent === "start") {
    await markWhatsappOptIn(identity.id);
    await reply(from, copy.optedIn, identity.workspace_id, access.windowExpiresAt);
    return;
  }
  if (access.identity.opted_out_at) {
    await reply(from, copy.optedOut, identity.workspace_id, access.windowExpiresAt);
    return;
  }

  if (!text) {
    await reply(
      from,
      copy.textOnly,
      identity.workspace_id,
      access.windowExpiresAt,
    );
    logger.info("whatsapp.unsupported_message", { messageId: message.id, type: message.type });
    return;
  }

  const answer = await handleWhatsappCommand({
    access,
    body: text,
    messageId: message.id!,
    locale: access.locale,
  });
  await reply(from, answer, identity.workspace_id, access.windowExpiresAt);
}

async function reply(
  to: string,
  body: string,
  workspaceId: string | null,
  windowExpiresAt: string | Date,
): Promise<void> {
  if (!isWhatsappConfigured()) {
    logger.warn("whatsapp.reply_not_configured");
    await logOutboundWhatsappMessage({
      workspaceId,
      waMessageId: null,
      toPhone: to,
      body,
      status: "failed",
      errorTitle: "WhatsApp is not configured",
    });
    return;
  }

  const result = await sendWhatsappText(to, body, { customerServiceWindowExpiresAt: windowExpiresAt });
  await logOutboundWhatsappMessage({
    workspaceId,
    waMessageId: result.id ?? null,
    toPhone: to,
    body,
    status: result.sent ? "sent" : "failed",
    errorCode: result.errorCode ?? null,
    errorTitle: result.errorTitle ?? result.reason ?? null,
    metadata: { reason: result.reason ?? null, providerStatus: result.status ?? null },
  });
}

function verificationCopy(
  result: Exclude<Awaited<ReturnType<typeof verifyPendingWhatsappIdentity>>, { status: "verified" }>,
  copy: Dictionary["channels"]["whatsapp"],
): string {
  switch (result.status) {
    case "already":
      return copy.verificationAlready;
    case "expired":
      return copy.verificationExpired;
    case "locked":
      return copy.verificationLocked;
    case "unavailable":
      return copy.verificationUnavailable;
    case "invalid":
      return interpolate(copy.verificationInvalid, { remaining: result.remaining });
    default:
      return copy.verificationMissing;
  }
}

async function identityLocale(identity: { workspace_id: string; user_id: string }): Promise<Locale> {
  const admin = createAdminClient();
  const [{ data: workspace }, { data: profile }] = await Promise.all([
    admin.from("workspaces").select("locale").eq("id", identity.workspace_id).maybeSingle(),
    admin.from("profiles").select("locale").eq("id", identity.user_id).maybeSingle(),
  ]);
  return resolveLocale(profile?.locale ?? workspace?.locale);
}

async function auditLink(
  identity: { id: string; workspace_id: string; user_id: string; verification_method: string | null },
  action: string,
): Promise<void> {
  await auditWhatsappEvent({
    workspaceId: identity.workspace_id,
    actorId: identity.user_id,
    action,
    entityId: identity.id,
    details: { method: identity.verification_method ?? "whatsapp_reply" },
  });
}

async function completeEvent(
  eventId: string | undefined,
  status: "processed" | "failed" | "ignored",
  error?: string,
): Promise<void> {
  if (!eventId) return;
  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("webhook_events")
    .update({
      status,
      error: error?.slice(0, 500) ?? null,
      processed_at: status === "processed" || status === "ignored" ? new Date().toISOString() : null,
      last_attempt_at: new Date().toISOString(),
    })
    .eq("id", eventId);
  if (updateError) logger.warn("whatsapp.event_complete_failed", { code: updateError.code });
}

function safeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return "Unknown WhatsApp processing error";
}
