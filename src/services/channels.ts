import "server-only";

import { auditChannelEvent } from "@/lib/channels/audit";
import { AppError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

export async function unlinkChannel(workspaceId: string, id: string, actorId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("channel_identities")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!existing) throw new AppError("not_found", "That channel link no longer exists.");

  const { error } = await admin.from("channel_identities").delete().eq("id", id).eq("workspace_id", workspaceId);
  if (error) throw new AppError("internal_error", "Could not unlink that number.");

  await auditChannelEvent({
    workspaceId,
    actorId,
    action: "channel.link_removed",
    entityId: id,
  });
}
