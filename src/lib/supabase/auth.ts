import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { can, permissionsForRole, type Permission, type WorkspaceRole } from "../permissions";
import { createClient } from "./server";
import type { ProfileRow, WorkspaceRow } from "@/types/database";

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
  if (data) return data;

  // Fallback for accounts created before the trigger was installed.
  const { data: created } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      full_name: (user.user_metadata?.full_name as string | undefined) ?? "",
      locale: "en",
    })
    .select("*")
    .maybeSingle();

  return created ?? null;
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
      full_name: "",
      phone: null,
      locale: "en",
      avatar_url: null,
      default_workspace_id: null,
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

export async function requireWorkspaceContext(locale: string): Promise<WorkspaceContext> {
  await requireUser(locale);
  const context = await getWorkspaceContext();
  if (!context) redirect(`/${locale}/onboarding`);
  return context;
}
