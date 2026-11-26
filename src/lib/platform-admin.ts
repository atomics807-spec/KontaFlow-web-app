import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getActiveRestriction, getPlatformAdmin, getProfile, getSessionUser } from "@/lib/supabase/auth";
import type { PlatformAdminRole, PlatformAdminRow } from "@/types/platform-admin";
import type { ProfileRow } from "@/types/database";

export { getActiveRestriction, getPlatformAdmin } from "@/lib/supabase/auth";

export type PlatformAdminSession = {
  user: User;
  profile: ProfileRow | null;
  admin: PlatformAdminRow;
};

export async function isPlatformAdminUser(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return Boolean(data);
}

export async function requirePlatformAdmin(locale: string): Promise<PlatformAdminSession> {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/admin`)}`);
  }

  if (await getActiveRestriction()) {
    redirect(`/${locale}/account-restricted`);
  }

  const admin = await getPlatformAdmin();
  if (!admin) {
    redirect(`/${locale}/dashboard`);
  }

  return { user, profile: await getProfile(), admin };
}

export function canManageAccounts(role: PlatformAdminRole): boolean {
  return role === "super_admin" || role === "admin";
}

export function canManagePlatformAdmins(role: PlatformAdminRole): boolean {
  return role === "super_admin";
}
