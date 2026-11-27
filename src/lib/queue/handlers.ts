import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { runAssistant } from "@/lib/ai/assistant";
import { resolveLocale } from "@/lib/i18n/config";
import { sendEmail } from "@/lib/integrations/email";
import { logger } from "@/lib/logger";
import type { WorkspaceRow } from "@/types/database";
import type { JobHandler } from "./types";
import { JOB_TYPES } from "./types";

async function aiBookkeeping(job: Parameters<JobHandler>[0]) {
  const payload = job.payload as {
    message?: string;
    requestId?: string;
    locale?: string;
    conversationId?: string | null;
    requireConfirmation?: boolean;
  };
  if (!job.workspace_id || !job.actor_id || !payload.message || !payload.requestId) {
    throw new Error("ai_job_payload_invalid");
  }
  const admin = createAdminClient();
  const { data: workspace, error } = await admin
    .from("workspaces")
    .select("*")
    .eq("id", job.workspace_id)
    .maybeSingle();
  if (error || !workspace) throw new Error("ai_workspace_missing");

  const reply = await runAssistant({
    workspace: workspace as WorkspaceRow,
    userId: job.actor_id,
    locale: resolveLocale(payload.locale ?? "en"),
    message: payload.message,
    requestId: payload.requestId,
    conversationId: payload.conversationId ?? null,
    mode: "interactive",
    // The confirmation RPC is user-scoped; a background worker must never post.
    autoPost: false,
    serviceRole: true,
  });
  return { result: reply as unknown as Record<string, unknown>, resultRef: reply.command?.id };
}

async function emailNotification(job: Parameters<JobHandler>[0]) {
  const payload = job.payload as {
    to?: string;
    subject?: string;
    html?: string;
    text?: string;
    workspaceId?: string;
    kind?: string;
    idempotencyKey?: string;
  };
  if (!payload.to || !payload.subject || !payload.html || !payload.text) {
    throw new Error("email_job_payload_invalid");
  }
  const result = await sendEmail({
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    workspaceId: payload.workspaceId ?? job.workspace_id ?? undefined,
    kind: payload.kind,
    idempotencyKey: payload.idempotencyKey ?? job.idempotency_key ?? undefined,
  });
  if (!result.sent) throw new Error(result.reason ?? "email_not_sent");
  return { resultRef: result.id };
}

async function invalidateTenantCache(job: Parameters<JobHandler>[0]) {
  if (!job.workspace_id) return;
  const admin = createAdminClient();
  const { error } = await admin.from("app_cache").delete().eq("workspace_id", job.workspace_id);
  if (error) throw new Error(error.message);
  logger.info("cache.tenant_invalidated", { workspaceId: job.workspace_id });
}

export const jobHandlers: Record<string, JobHandler> = {
  [JOB_TYPES.aiBookkeeping]: aiBookkeeping,
  [JOB_TYPES.email]: emailNotification,
  "cache.invalidate": invalidateTenantCache,
};

export const outboxHandlers = {
  "transaction.posted": async (event: { workspace_id: string | null }) => {
    if (!event.workspace_id) return;
    const admin = createAdminClient();
    const { error } = await admin.from("app_cache").delete().eq("workspace_id", event.workspace_id);
    if (error) throw new Error(error.message);
  },
  "transaction.voided": async (event: { workspace_id: string | null }) => {
    if (!event.workspace_id) return;
    const admin = createAdminClient();
    const { error } = await admin.from("app_cache").delete().eq("workspace_id", event.workspace_id);
    if (error) throw new Error(error.message);
  },
  "payment.succeeded": async (event: { workspace_id: string | null }) => {
    if (!event.workspace_id) return;
    const admin = createAdminClient();
    const { error } = await admin.from("app_cache").delete().eq("workspace_id", event.workspace_id);
    if (error) throw new Error(error.message);
  },
  "subscription.changed": async (event: { workspace_id: string | null }) => {
    if (!event.workspace_id) return;
    const admin = createAdminClient();
    const { error } = await admin.from("app_cache").delete().eq("workspace_id", event.workspace_id);
    if (error) throw new Error(error.message);
  },
};
