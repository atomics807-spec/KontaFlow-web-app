import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ActiveAnnouncement } from "@/types/platform-admin";

export async function listActiveAnnouncements(limit = 3): Promise<ActiveAnnouncement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("system_announcements")
    .select("id, title, body, tone, audience, starts_at, ends_at")
    .eq("is_active", true)
    .lte("starts_at", new Date().toISOString())
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
    .order("starts_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as ActiveAnnouncement[];
}
