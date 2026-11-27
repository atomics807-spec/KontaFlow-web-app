import "server-only";

import { createClient } from "@/lib/supabase/server";
import { assertNoError } from "@/lib/supabase/errors";
import type { NotificationRow } from "@/types/database";

export async function listNotifications(
  workspaceId: string,
  userId: string,
  limit = 12,
): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw assertNoError(error, "Could not load notifications.");
  return data ?? [];
}

export async function countUnreadNotifications(workspaceId: string, userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw assertNoError(error, "Could not count notifications.");
  return count ?? 0;
}

export async function markNotificationRead(workspaceId: string, id: string, userId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw assertNoError(error, "Could not update the notification.");
}

export async function markAllNotificationsRead(workspaceId: string, userId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw assertNoError(error, "Could not update notifications.");
}
