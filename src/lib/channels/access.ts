import "server-only";

import { can, type WorkspaceRole } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveLocale, type Locale } from "@/lib/i18n/config";
import type {
  ChannelIdentityRow,
  SubscriptionRow,
  SubscriptionStatus,
  WorkspaceRow,
} from "@/types/database";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export type ChannelAccess = {
  identity: ChannelIdentityRow;
  workspace: WorkspaceRow;
  userId: string;
  role: WorkspaceRole | null;
  locale: Locale;
  subscription: SubscriptionRow | null;
  subscriptionStatus: SubscriptionStatus | "none";
  subscriptionReadable: boolean;
  subscriptionWritable: boolean;
  restricted: boolean;
  activeMember: boolean;
  readAllowed: boolean;
  writeAllowed: boolean;
  reportAllowed: boolean;
  aiAllowed: boolean;
  windowExpiresAt: string;
};

function windowFrom(identity: ChannelIdentityRow, fallback?: Date): string {
  if (identity.service_window_expires_at) return identity.service_window_expires_at;
  if (identity.last_inbound_at) {
    return new Date(new Date(identity.last_inbound_at).getTime() + WINDOW_MS).toISOString();
  }
  return (fallback ?? new Date(0)).toISOString();
}

function trialExpired(subscription: SubscriptionRow): boolean {
  return subscription.status === "trialing" && Boolean(
    subscription.trial_ends_at && new Date(subscription.trial_ends_at).getTime() <= Date.now(),
  );
}

export async function buildChannelAccess(
  identity: ChannelIdentityRow,
  fallbackWindow?: Date,
): Promise<ChannelAccess> {
  const admin = createAdminClient();
  const [{ data: workspace }, { data: membership }, { data: profile }, { data: subscription }, { data: restrictions }, { data: platformAdmin }] =
    await Promise.all([
      admin.from("workspaces").select("*").eq("id", identity.workspace_id).maybeSingle(),
      admin
        .from("workspace_members")
        .select("role, status")
        .eq("workspace_id", identity.workspace_id)
        .eq("user_id", identity.user_id)
        .maybeSingle(),
      admin.from("profiles").select("locale").eq("id", identity.user_id).maybeSingle(),
      admin.from("subscriptions").select("*").eq("workspace_id", identity.workspace_id).maybeSingle(),
      admin
        .from("account_restrictions")
        .select("id, expires_at")
        .eq("user_id", identity.user_id)
        .is("lifted_at", null),
      admin
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", identity.user_id)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

  if (!workspace) {
    throw new Error("Channel identity points at a missing workspace");
  }

  const now = Date.now();
  const restricted =
    Boolean(platformAdmin) ||
    (restrictions ?? []).some(
      (row) => row.expires_at === null || new Date(row.expires_at).getTime() > now,
    );
  const role =
    membership?.status === "active" ? (membership.role as WorkspaceRole) : null;
  const activeMember = role !== null && !restricted;
  const subscriptionRow = (subscription as SubscriptionRow | null) ?? null;
  const status: SubscriptionStatus | "none" = subscriptionRow?.status ?? "none";
  const expiredTrial = subscriptionRow ? trialExpired(subscriptionRow) : false;
  const subscriptionReadable =
    !subscriptionRow ||
    ((status === "trialing" || status === "active" || status === "past_due") && !expiredTrial);
  const subscriptionWritable =
    !subscriptionRow || ((status === "trialing" || status === "active") && !expiredTrial);

  return {
    identity,
    workspace: workspace as WorkspaceRow,
    userId: identity.user_id,
    role,
    locale: resolveLocale(profile?.locale ?? workspace.locale),
    subscription: subscriptionRow,
    subscriptionStatus: status,
    subscriptionReadable,
    subscriptionWritable,
    restricted,
    activeMember,
    readAllowed: activeMember && can(role, "transactions:read") && subscriptionReadable,
    writeAllowed: activeMember && can(role, "transactions:create") && subscriptionWritable,
    reportAllowed: activeMember && can(role, "reports:read") && subscriptionReadable,
    aiAllowed: activeMember && can(role, "ai:use") && subscriptionWritable,
    windowExpiresAt: windowFrom(identity, fallbackWindow),
  };
}
