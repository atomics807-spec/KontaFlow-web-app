import "server-only";

import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { assertNoError } from "@/lib/supabase/errors";
import type {
  PlatformAdminAccount,
  PlatformAdminAuditEntry,
  PlatformAdminOverview,
  PlatformAdminUser,
  PlatformAdminWorkspace,
} from "@/types/platform-admin";

export async function getPlatformOverview(): Promise<PlatformAdminOverview> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_overview");
  if (error) throw assertNoError(error, "Could not load platform totals.");
  if (!data) throw new AppError("not_found", "Platform totals are unavailable.");
  return data;
}

export async function listPlatformUsers(search?: string): Promise<PlatformAdminUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_list_users", {
    p_search: search?.trim() || null,
    p_limit: 100,
    p_offset: 0,
  });
  if (error) throw assertNoError(error, "Could not load accounts.");
  return data ?? [];
}

export async function listPlatformWorkspaces(search?: string): Promise<PlatformAdminWorkspace[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_list_workspaces", {
    p_search: search?.trim() || null,
    p_limit: 100,
    p_offset: 0,
  });
  if (error) throw assertNoError(error, "Could not load workspaces.");
  return data ?? [];
}

export async function listPlatformAdmins(): Promise<PlatformAdminAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_list_admins");
  if (error) throw assertNoError(error, "Could not load platform administrators.");
  return data ?? [];
}

export async function listPlatformAudit(): Promise<PlatformAdminAuditEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_list_audit", { p_limit: 100 });
  if (error) throw assertNoError(error, "Could not load the platform audit log.");
  return data ?? [];
}
