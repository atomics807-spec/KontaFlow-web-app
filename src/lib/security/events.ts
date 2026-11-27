import "server-only";

import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/database";

type Severity = "info" | "warning" | "critical";

const SENSITIVE_KEY = /token|secret|password|authorization|cookie|otp|api[_-]?key|signature|prompt/i;

function safeMetadata(value: unknown, depth = 0): Json {
  if (depth > 3) return "[truncated]";
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.slice(0, 200);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeMetadata(item, depth + 1));
  if (typeof value === "object") {
    const result: Record<string, Json> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 30)) {
      if (SENSITIVE_KEY.test(key)) continue;
      result[key] = safeMetadata(item, depth + 1);
    }
    return result;
  }
  return null;
}

export async function logSecurityEvent(input: {
  type: string;
  userId?: string | null;
  workspaceId?: string | null;
  severity?: Severity;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!hasServiceRole()) {
    logger.warn("security.event_not_persisted", { type: input.type });
    return;
  }

  try {
    const { error } = await createAdminClient()
      .from("security_events")
      .insert({
        user_id: input.userId ?? null,
        workspace_id: input.workspaceId ?? null,
        event_type: input.type.slice(0, 80),
        severity: input.severity ?? "info",
        ip: input.ip ?? null,
        user_agent: input.userAgent?.slice(0, 500) ?? null,
        metadata: safeMetadata(input.metadata ?? {}),
      });
    if (error) logger.warn("security.event_insert_failed", { type: input.type, code: error.code });
  } catch (error) {
    logger.warn("security.event_insert_unavailable", { type: input.type, error });
  }
}

/** Workspace audit row for non-RPC actions (uploads, exports, privacy links). */
export async function writeWorkspaceAudit(input: {
  workspaceId: string;
  actorId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  if (!hasServiceRole()) return;
  try {
    const { error } = await createAdminClient()
      .from("audit_logs")
      .insert({
        workspace_id: input.workspaceId,
        actor_id: input.actorId,
        actor_type: "user",
        action: input.action.slice(0, 80),
        entity: input.entity.slice(0, 80),
        entity_id: input.entityId ?? null,
        after_data: safeMetadata(input.metadata ?? {}),
        ip: input.ip ?? null,
        user_agent: input.userAgent?.slice(0, 500) ?? null,
      });
    if (error) logger.warn("security.audit_insert_failed", { action: input.action, code: error.code });
  } catch (error) {
    logger.warn("security.audit_insert_unavailable", { action: input.action, error });
  }
}
