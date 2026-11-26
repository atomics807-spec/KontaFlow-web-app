import "server-only";

import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export async function auditChannelEvent(params: {
  workspaceId: string;
  actorId: string | null;
  action: string;
  entityId: string | null;
  entity?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    workspace_id: params.workspaceId,
    actor_id: params.actorId,
    actor_type: "channel",
    action: params.action,
    entity: params.entity ?? "channel_identity",
    entity_id: params.entityId,
    after_data: (params.details ?? {}) as never,
  });
  if (error) logger.warn("channel.audit_failed", { code: error.code });
}
