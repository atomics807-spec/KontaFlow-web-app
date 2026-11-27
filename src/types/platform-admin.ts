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

export type PlatformAdminOperationsOverview = {
  users: number;
  workspaces: number;
  active_subscriptions: number;
  trialing_subscriptions: number;
  past_due_subscriptions: number;
  failed_payments_30d: number;
  ai_interactions_30d: number;
  ai_tokens_30d: number;
  ai_cost_minor_30d: string;
  emails_sent_30d: number;
  emails_failed_30d: number;
  ussd_sessions_30d: number;
  whatsapp_messages_30d: number;
  whatsapp_failed_30d: number;
  new_support_requests: number;
  pending_support_access: number;
  webhook_failures_24h: number;
  active_announcements: number;
};

export type PlatformAdminPayment = {
  id: string;
  workspace_id: string;
  workspace_name: string;
  owner_email: string | null;
  amount_minor: string;
  currency: string;
  status: string;
  provider: string;
  provider_ref: string | null;
  merchant_reference: string;
  plan_code: string | null;
  failure_code: string | null;
  failure_message: string | null;
  refunded_amount_minor: string;
  created_at: string;
  paid_at: string | null;
  expires_at: string | null;
};

export type PlatformSupportRequest = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  topic: "sales" | "support" | "partnership" | "press" | "other";
  message: string;
  locale: string;
  status: "new" | "read" | "replied" | "closed" | "spam";
  source: string;
  created_at: string;
  handled_at: string | null;
  handled_by_email: string | null;
};

export type PlatformIntegrationStatus = {
  accounts: {
    provider: string;
    account_count: number;
    active_count: number;
    error_count: number;
    last_synced_at: string | null;
  }[];
  webhook_failures: {
    provider: string;
    external_id: string | null;
    error: string | null;
    received_at: string;
  }[];
  message_failures: { provider: string; failed_count: number }[];
};

export type PlatformUsageMetrics = {
  totals: {
    events_30d: number;
    active_workspaces_30d: number;
    transactions_30d: number;
    ai_messages_30d: number;
    sync_pushes_30d: number;
  };
  by_kind: { kind: string; quantity: number; workspaces: number }[];
  daily: { day: string; quantity: number }[];
  top_workspaces: { id: string; name: string; quantity: number }[];
};

export type PlatformAiUsage = {
  totals: {
    interactions_30d: number;
    prompt_tokens_30d: number;
    completion_tokens_30d: number;
    cost_minor_30d: string;
    errors_30d: number;
    blocked_30d: number;
    avg_latency_ms_30d: number;
  };
  by_status: { status: string; count: number }[];
  by_model: { model: string; count: number; tokens: number }[];
  daily: { day: string; interactions: number; tokens: number; cost_minor: number }[];
  top_workspaces: { id: string; name: string; interactions: number; tokens: number }[];
};

export type PlatformEmailDelivery = {
  totals: { sent_30d: number; failed_30d: number; skipped_30d: number };
  recent: {
    id: string;
    recipient: string;
    subject: string;
    kind: string;
    status: "sent" | "failed" | "skipped";
    provider: string;
    provider_message_id: string | null;
    error: string | null;
    created_at: string;
    workspace_name: string | null;
  }[];
};

export type PlatformUssdActivity = {
  totals: {
    sessions_30d: number;
    active_sessions: number;
    unique_phones_30d: number;
    linked_sessions_30d: number;
  };
  daily: { day: string; sessions: number }[];
  recent: {
    session_id: string;
    phone_masked: string;
    service_code: string | null;
    expires_at: string;
    created_at: string;
    updated_at: string;
    workspace_name: string | null;
  }[];
};

export type PlatformWhatsappActivity = {
  totals: {
    messages_30d: number;
    inbound_30d: number;
    outbound_30d: number;
    failed_30d: number;
  };
  daily: { day: string; messages: number; inbound: number; outbound: number }[];
  recent: {
    id: string;
    direction: "inbound" | "outbound";
    message_type: string;
    status: string | null;
    from_phone_masked: string;
    to_phone_masked: string;
    created_at: string;
    workspace_name: string | null;
  }[];
};

export type PlatformSecurityAudit = {
  actions: PlatformAdminAuditEntry[];
  restrictions: {
    id: string;
    user_id: string;
    severity: RestrictionSeverity;
    reason: string;
    expires_at: string | null;
    created_at: string;
    lifted_at: string | null;
    lift_reason: string | null;
    email: string | null;
  }[];
  support_access: PlatformSupportAccessGrant[];
};

export type AnnouncementTone = "info" | "success" | "warning" | "critical";
export type AnnouncementAudience = "all" | "workspace_admins";

export type SystemAnnouncement = {
  id: string;
  title: string;
  body: string;
  tone: AnnouncementTone;
  audience: AnnouncementAudience;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  created_by_email: string | null;
};

export type ActiveAnnouncement = Pick<
  SystemAnnouncement,
  "id" | "title" | "body" | "tone" | "audience" | "starts_at" | "ends_at"
>;

export type SupportAccessStatus = "pending" | "approved" | "denied" | "revoked" | "expired";

export type PlatformSupportAccessGrant = {
  id: string;
  workspace_id: string;
  workspace_name: string;
  status: SupportAccessStatus;
  justification: string;
  requested_hours: number;
  decision_note: string | null;
  requested_at: string;
  decided_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  last_accessed_at: string | null;
  access_count: number;
  requested_by: string;
  approved_by: string | null;
  requested_by_email: string | null;
  approved_by_email: string | null;
};

export type SupportSnapshot = {
  workspace: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    currency: string;
    timezone: string;
    created_at: string;
    owner_email: string | null;
  };
  grant: {
    id: string;
    justification: string;
    expires_at: string;
    access_count: number;
  };
  counts: {
    members: number;
    transactions: number;
    customers: number;
    suppliers: number;
  };
  totals_30d: {
    income_minor: string;
    expense_minor: string;
    currency: string;
  };
  recent_transactions: {
    id: string;
    occurred_on: string;
    kind: string;
    description: string;
    amount_minor: string;
    currency: string;
    status: string;
    category_name: string | null;
  }[];
};
