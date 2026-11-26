import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { statusError, statusRank, type WhatsappInboundMessage, type WhatsappStatus } from "@/lib/whatsapp/payload";

export async function logInboundWhatsappMessage(params: {
  workspaceId: string | null;
  message: WhatsappInboundMessage;
  fromPhone: string;
  toPhone: string;
  body: string | null;
  displayName?: string | null;
  receivedAt: Date;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("whatsapp_messages").upsert(
    {
      workspace_id: params.workspaceId,
      wa_message_id: params.message.id ?? null,
      direction: "inbound",
      from_phone: params.fromPhone,
      to_phone: params.toPhone,
      message_type: params.message.type ?? "text",
      body: params.body?.slice(0, 4000) ?? null,
      status: "received",
      wa_timestamp: params.receivedAt.toISOString(),
      display_name: params.displayName?.slice(0, 120) ?? null,
      payload: params.message as never,
    },
    { onConflict: "wa_message_id", ignoreDuplicates: true },
  );
  if (error) logger.warn("whatsapp.inbound_log_failed", { code: error.code });
}

export async function markInboundWhatsappProcessed(waMessageId: string | null): Promise<void> {
  if (!waMessageId) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from("whatsapp_messages")
    .update({ status: "processed", status_updated_at: new Date().toISOString() })
    .eq("wa_message_id", waMessageId)
    .eq("direction", "inbound");
  if (error) logger.warn("whatsapp.processed_log_failed", { code: error.code });
}

export async function logOutboundWhatsappMessage(params: {
  workspaceId: string | null;
  waMessageId: string | null;
  toPhone: string;
  body: string;
  status: "sent" | "failed";
  errorCode?: string | null;
  errorTitle?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // A delivery-status webhook can arrive before the send response is logged.
  // Never downgrade a delivered/read/failed row back to "sent".
  if (params.waMessageId) {
    const { data: existing } = await admin
      .from("whatsapp_messages")
      .select("status")
      .eq("wa_message_id", params.waMessageId)
      .maybeSingle();
    if (existing?.status && statusRank(existing.status) > statusRank(params.status)) {
      const { error } = await admin
        .from("whatsapp_messages")
        .update({
          ...(params.workspaceId ? { workspace_id: params.workspaceId } : {}),
          body: params.body.slice(0, 4000),
          metadata: (params.metadata ?? {}) as never,
        })
        .eq("wa_message_id", params.waMessageId);
      if (error) logger.warn("whatsapp.outbound_log_failed", { code: error.code });
      return;
    }
  }

  const { error } = await admin.from("whatsapp_messages").upsert(
    {
      workspace_id: params.workspaceId,
      wa_message_id: params.waMessageId,
      direction: "outbound",
      from_phone: "kontaflow",
      to_phone: params.toPhone,
      message_type: "text",
      body: params.body.slice(0, 4000),
      status: params.status,
      status_updated_at: now,
      error_code: params.errorCode ?? null,
      error_title: params.errorTitle ?? null,
      metadata: (params.metadata ?? {}) as never,
    },
    { onConflict: "wa_message_id", ignoreDuplicates: false },
  );
  if (error) logger.warn("whatsapp.outbound_log_failed", { code: error.code });
}

export async function updateWhatsappDeliveryStatus(params: {
  status: WhatsappStatus;
  metadata: { display_phone_number?: string; phone_number_id?: string };
  receivedAt: Date;
}): Promise<void> {
  const waMessageId = params.status.id;
  const nextStatus = params.status.status;
  if (!waMessageId || !nextStatus) return;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("whatsapp_messages")
    .select("status")
    .eq("wa_message_id", waMessageId)
    .maybeSingle();

  if (existing?.status && statusRank(existing.status) > statusRank(nextStatus)) return;

  const error = statusError(params.status);
  const patch = {
    status: nextStatus,
    status_updated_at: params.receivedAt.toISOString(),
    error_code: error.code,
    error_title: error.title,
    conversation_category:
      params.status.pricing?.category ?? params.status.conversation?.origin?.type ?? null,
    payload: params.status as never,
  };

  if (existing) {
    const { error: updateError } = await admin
      .from("whatsapp_messages")
      .update(patch)
      .eq("wa_message_id", waMessageId);
    if (updateError) logger.warn("whatsapp.status_log_failed", { code: updateError.code });
    return;
  }

  const { error: insertError } = await admin.from("whatsapp_messages").insert({
    workspace_id: null,
    wa_message_id: waMessageId,
    direction: "outbound",
    from_phone: params.metadata.display_phone_number ?? "kontaflow",
    to_phone: params.status.recipient_id ?? "unknown",
    message_type: "status",
    body: null,
    ...patch,
  });
  if (insertError) logger.warn("whatsapp.status_insert_failed", { code: insertError.code });
}

export async function auditWhatsappEvent(params: {
  workspaceId: string;
  actorId: string | null;
  action: string;
  entityId: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    workspace_id: params.workspaceId,
    actor_id: params.actorId,
    actor_type: "channel",
    action: params.action,
    entity: "channel_identity",
    entity_id: params.entityId,
    after_data: (params.details ?? {}) as never,
  });
  if (error) logger.warn("whatsapp.audit_failed", { code: error.code });
}
