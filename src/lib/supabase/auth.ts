import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { can, permissionsForRole, type Permission, type WorkspaceRole } from "../permissions";
import { createClient } from "./server";
import type { ProfileRow, WorkspaceRow } from "@/types/database";
import type { AccountRestrictionRow, PlatformAdminRow } from "@/types/platform-admin";

export const WORKSPACE_COOKIE = "kontaflow_workspace";

export type WorkspaceMembership = {
  workspaceId: string;
  role: WorkspaceRole;
  workspace: WorkspaceRow;
};

export type WorkspaceContext = {
  user: User;
  profile: ProfileRow;
  memberships: WorkspaceMembership[];
  workspace: WorkspaceRow;
  role: WorkspaceRole;
  permissions: readonly Permission[];
  can: (permission: Permission) => boolean;
};

/** Verified user (validated against the Supabase Auth server, not just the JWT). */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (): Promise<ProfileRow | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data ?? null;
});

export const getActiveRestriction = cache(async (): Promise<AccountRestrictionRow | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("account_restrictions")
    .select("*")
    .eq("user_id", user.id)
    .is("lifted_at", null)
    .order("created_at", { ascending: false });

  const now = Date.now();
  return (
    (data ?? []).find((row) => row.expires_at === null || new Date(row.expires_at).getTime() > now) ??
    null
  );
});

/** Platform operators live outside tenant workspaces; this row is the source of truth. */
export const getPlatformAdmin = cache(async (): Promise<PlatformAdminRow | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_admins")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  return data ?? null;
});

export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (!memberships || memberships.length === 0) return null;

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("*")
    .in(
      "id",
      memberships.map((m) => m.workspace_id),
    );

  if (!workspaces || workspaces.length === 0) return null;

  const profile = await getProfile();
  const cookieStore = await cookies();
  const cookieWorkspace = cookieStore.get(WORKSPACE_COOKIE)?.value;

  const enriched: WorkspaceMembership[] = memberships
    .map((membership) => {
      const workspace = workspaces.find((w) => w.id === membership.workspace_id);
      if (!workspace) return null;
      return {
        workspaceId: workspace.id,
        role: membership.role as WorkspaceRole,
        workspace,
      };
    })
    .filter((value): value is WorkspaceMembership => value !== null);

  const active =
    enriched.find((m) => m.workspaceId === cookieWorkspace) ??
    enriched.find((m) => m.workspaceId === profile?.default_workspace_id) ??
    enriched[0];

  if (!active) return null;

  return {
    user,
    profile: profile ?? {
      id: user.id,
      first_name: "",
      last_name: "",
      full_name: "",
      phone: null,
      locale: "en",
      country_code: "CM",
      avatar_url: null,
      default_workspace_id: null,
      email_verified_at: user.email_confirmed_at ?? null,
      phone_verified_at: null,
      onboarding_completed_at: null,
      verification_required: true,
      easy_mode: true,
      last_seen_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    memberships: enriched,
    workspace: active.workspace,
    role: active.role,
    permissions: permissionsForRole(active.role),
    can: (permission: Permission) => can(active.role, permission),
  };
});

export async function requireUser(locale: string, nextPath = "/dashboard"): Promise<User> {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/${locale}/login?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}

export type VerifiedIdentity = {
  user: User;
  profile: ProfileRow | null;
  emailVerified: boolean;
  phoneVerified: boolean;
};

/**
 * Blocks unverified accounts from onboarding and the dashboard. Accounts that
 * predate Phase 4 have `verification_required = false` and pass through.
 */
export async function requireVerifiedUser(
  locale: string,
  nextPath = `/${locale}/dashboard`,
): Promise<VerifiedIdentity> {
  const user = await requireUser(locale, nextPath);
  const restriction = await getActiveRestriction();
  if (restriction) redirect(`/${locale}/account-restricted`);

  const profile = await getProfile();
  const emailVerified = Boolean(user.email_confirmed_at || profile?.email_verified_at);
  const phoneVerified = Boolean(profile?.phone_verified_at);

  if (profile?.verification_required) {
    if (!emailVerified) {
      redirect(`/${locale}/verify-email?next=${encodeURIComponent(nextPath)}`);
    }
    if (!phoneVerified) {
      redirect(`/${locale}/verify-phone?next=${encodeURIComponent(nextPath)}`);
    }
  }

  return { user, profile, emailVerified, phoneVerified };
}

export async function requireWorkspaceContext(locale: string): Promise<WorkspaceContext> {
  await requireVerifiedUser(locale);
  if (await getPlatformAdmin()) redirect(`/${locale}/admin`);

  const context = await getWorkspaceContext();
  if (!context) redirect(`/${locale}/onboarding`);
  return context;
}
