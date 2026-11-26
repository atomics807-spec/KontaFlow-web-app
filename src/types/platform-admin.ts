export const PLATFORM_ADMIN_ROLES = ["super_admin", "admin", "support"] as const;
export type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number];

export const RESTRICTION_SEVERITIES = ["limited", "suspended"] as const;
export type RestrictionSeverity = (typeof RESTRICTION_SEVERITIES)[number];

export const WORKSPACE_PLANS = ["starter", "growth", "scale"] as const;

export type PlatformAdminRow = {
  user_id: string;
  role: PlatformAdminRole;
  is_active: boolean;
  created_by: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AccountRestrictionRow = {
  id: string;
  user_id: string;
  severity: RestrictionSeverity;
  reason: string;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  lifted_at: string | null;
  lifted_by: string | null;
  lift_reason: string | null;
};

export type PlatformAdminOverview = {
  users: number;
  new_users_30d: number;
  restricted_users: number;
  suspended_users: number;
  workspaces: number;
  active_subscriptions: number;
  trialing_subscriptions: number;
  transactions_30d: number;
  volume_30d_by_currency: Record<string, string>;
  plan_distribution: Record<string, number>;
  recent_restrictions: {
    id: string;
    user_id: string;
    email: string | null;
    severity: RestrictionSeverity;
    reason: string;
    expires_at: string | null;
    created_at: string;
  }[];
};

export type PlatformAdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  full_name: string | null;
  phone: string | null;
  locale: string | null;
  membership_count: number;
  workspaces: { id: string; name: string; role: string }[];
  restriction_id: string | null;
  severity: RestrictionSeverity | null;
  restriction_reason: string | null;
  restriction_expires_at: string | null;
  restricted_at: string | null;
  is_platform_admin: boolean;
};

export type PlatformAdminWorkspace = {
  id: string;
  name: string;
  slug: string;
  plan: "starter" | "growth" | "scale";
  currency: string;
  country_code: string;
  timezone: string;
  created_at: string;
  owner_email: string | null;
  owner_name: string;
  member_count: number;
  transaction_count: number;
  subscription_status: string | null;
  subscription_plan: string | null;
};

export type PlatformAdminAccount = {
  user_id: string;
  role: PlatformAdminRole;
  is_active: boolean;
  created_at: string;
  last_seen_at: string | null;
  email: string | null;
  full_name: string;
};

export type PlatformAdminAuditEntry = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  created_at: string;
  admin_email: string | null;
};
