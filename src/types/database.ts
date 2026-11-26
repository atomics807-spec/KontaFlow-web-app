/**
 * Hand-maintained mirror of the public schema, used to type the Supabase
 * clients. Regenerate with `supabase gen types typescript --local` after
 * schema changes and keep the RPC signatures in sync.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type WorkspaceRole = "owner" | "admin" | "accountant" | "manager" | "staff";
export type TransactionKind = "income" | "expense" | "transfer";
export type TransactionStatus = "posted" | "voided";
export type EntryChannel = "web" | "ussd" | "whatsapp" | "ai" | "sync" | "api" | "system";
export type PaymentMethod = "cash" | "mobile_money" | "bank_transfer" | "card" | "cheque" | "other";
export type CategoryKind = "income" | "expense";
export type ContactKind = "customer" | "supplier" | "both";
export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type AccountSubtype =
  | "cash"
  | "bank"
  | "mobile_money"
  | "receivable"
  | "payable"
  | "revenue"
  | "operating_expense"
  | "equity"
  | "other";
export type WorkspacePlan = "starter" | "growth" | "scale";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "paused";
export type MemberStatus = "invited" | "active" | "suspended";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type AiMessageRole = "user" | "assistant" | "tool";
export type UsageKind = "ai_message" | "ussd_session" | "whatsapp_message" | "sync_push";

export type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string | null;
  locale: string;
  country_code: string;
  avatar_url: string | null;
  default_workspace_id: string | null;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  onboarding_completed_at: string | null;
  verification_required: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceRow = {
  id: string;
  name: string;
  legal_name: string | null;
  slug: string;
  owner_id: string;
  currency: string;
  timezone: string;
  locale: string;
  country_code: string;
  city: string | null;
  phone: string | null;
  business_type: string | null;
  industry: string | null;
  business_size: string | null;
  fiscal_year_start_month: number;
  logo_url: string | null;
  logo_path: string | null;
  plan: WorkspacePlan;
  settings: Json;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMemberRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  status: MemberStatus;
  invited_by: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceInvitationRow = {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  status: InvitationStatus;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AccountRow = {
  id: string;
  workspace_id: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  institution: string | null;
  masked_number: string | null;
  opening_balance_minor: number;
  currency: string;
  is_system: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type CategoryRow = {
  id: string;
  workspace_id: string;
  name: string;
  kind: CategoryKind;
  color: string;
  icon: string | null;
  translations: Record<string, string>;
  is_system: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type ContactRow = {
  id: string;
  workspace_id: string;
  kind: ContactKind;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  notes: string | null;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TransactionRow = {
  id: string;
  workspace_id: string;
  kind: TransactionKind;
  status: TransactionStatus;
  occurred_on: string;
  occurred_at: string;
  description: string;
  reference: string | null;
  category_id: string | null;
  account_id: string;
  counter_account_id: string | null;
  contact_id: string | null;
  amount_minor: number;
  currency: string;
  payment_method: PaymentMethod;
  channel: EntryChannel;
  attachment_path: string | null;
  client_generated_id: string | null;
  created_by: string | null;
  recorded_at: string;
  recorded_timezone: string;
  sync_received_at: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type LedgerLineRow = {
  id: string;
  workspace_id: string;
  transaction_id: string;
  account_id: string;
  category_id: string | null;
  contact_id: string | null;
  line_no: number;
  debit_minor: number;
  credit_minor: number;
  memo: string | null;
  created_at: string;
};

export type TransactionViewRow = {
  id: string;
  workspace_id: string;
  kind: TransactionKind;
  status: TransactionStatus;
  occurred_on: string;
  description: string;
  reference: string | null;
  amount_minor: number;
  currency: string;
  payment_method: PaymentMethod;
  channel: EntryChannel;
  category_id: string | null;
  category_name: string | null;
  category_translations: Record<string, string> | null;
  contact_id: string | null;
  contact_name: string | null;
  account_id: string;
  account_name: string;
  created_by: string | null;
  created_at: string;
};

export type AiConversationRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type AiMessageRow = {
  id: string;
  conversation_id: string;
  workspace_id: string;
  role: AiMessageRole;
  content: string;
  tool_name: string | null;
  tool_args: Json | null;
  tool_result: Json | null;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  created_at: string;
};

export type AuditLogRow = {
  id: number;
  workspace_id: string;
  actor_id: string | null;
  actor_type: "user" | "ai" | "system" | "channel";
  action: string;
  entity: string;
  entity_id: string | null;
  before_data: Json | null;
  after_data: Json | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export type SubscriptionRow = {
  id: string;
  workspace_id: string;
  plan: WorkspacePlan;
  status: SubscriptionStatus;
  provider: string;
  provider_ref: string | null;
  price_minor: number;
  currency: string;
  seats: number;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

export type PaymentTransactionRow = {
  id: string;
  workspace_id: string;
  subscription_id: string | null;
  provider: string;
  provider_ref: string | null;
  amount_minor: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "refunded";
  paid_at: string | null;
  metadata: Json;
  created_at: string;
};

export type UsageEventRow = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  kind: UsageKind;
  quantity: number;
  metadata: Json;
  created_at: string;
};

export type ChannelIdentityRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  channel: EntryChannel;
  address: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UssdSessionRow = {
  session_id: string;
  phone: string;
  user_id: string | null;
  workspace_id: string | null;
  state: Json;
  service_code: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type WhatsappMessageRow = {
  id: string;
  workspace_id: string | null;
  wa_message_id: string | null;
  direction: string;
  from_phone: string;
  to_phone: string;
  message_type: string;
  body: string | null;
  status: string | null;
  payload: Json;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  channel: "in_app" | "email" | "sms" | "whatsapp";
  title: string;
  body: string;
  data: Json;
  read_at: string | null;
  sent_at: string | null;
  created_at: string;
};

export type ContactMessageRow = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  topic: "sales" | "support" | "partnership" | "press" | "other";
  message: string;
  locale: "en" | "fr" | "pcm";
  status: "new" | "read" | "replied" | "closed" | "spam";
  source: string;
  handled_at: string | null;
  handled_by: string | null;
  created_at: string;
};

export type DashboardSummary = {
  workspace: { id: string; name: string; currency: string; timezone: string; plan: WorkspacePlan };
  period: { from: string; to: string };
  totalIncomeMinor: string;
  totalExpenseMinor: string;
  netProfitMinor: string;
  previousIncomeMinor: string;
  previousExpenseMinor: string;
  cashBalanceMinor: string;
  aiMessagesUsed: number;
  monthlySeries: { month: string; income: string; expense: string }[];
  topExpenseCategories: { name: string; translations: Record<string, string>; color: string; total: string }[];
  recentTransactions: {
    id: string;
    kind: TransactionKind;
    amount_minor: string;
    currency: string;
    occurred_on: string;
    description: string;
    channel: EntryChannel;
    status: TransactionStatus;
    created_at: string;
    category_name: string | null;
    category_translations: Record<string, string> | null;
    contact_name: string | null;
    account_name: string;
  }[];
};

export type ReportResult = {
  period: { from: string; to: string };
  revenueMinor: string;
  expenseMinor: string;
  netProfitMinor: string;
  transactionCount: number;
  byCategory: { name: string; translations: Record<string, string>; color: string; kind: CategoryKind; total: string }[];
  dailySeries: { date: string; income: string; expense: string }[];
  topCustomers: { name: string; total: string }[];
};

type TableDefinition<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<ProfileRow>;
      workspaces: TableDefinition<WorkspaceRow>;
      workspace_members: TableDefinition<WorkspaceMemberRow>;
      workspace_invitations: TableDefinition<WorkspaceInvitationRow>;
      accounts: TableDefinition<AccountRow>;
      categories: TableDefinition<CategoryRow>;
      contacts: TableDefinition<ContactRow>;
      transactions: TableDefinition<TransactionRow>;
      ledger_lines: TableDefinition<LedgerLineRow>;
      ai_conversations: TableDefinition<AiConversationRow>;
      ai_messages: TableDefinition<AiMessageRow>;
      audit_logs: TableDefinition<AuditLogRow>;
      subscriptions: TableDefinition<SubscriptionRow>;
      payment_transactions: TableDefinition<PaymentTransactionRow>;
      usage_events: TableDefinition<UsageEventRow>;
      channel_identities: TableDefinition<ChannelIdentityRow>;
      notifications: TableDefinition<NotificationRow>;
      contact_messages: TableDefinition<ContactMessageRow>;
      ussd_sessions: TableDefinition<UssdSessionRow>;
      whatsapp_messages: TableDefinition<WhatsappMessageRow>;
    };
    Views: {
      v_transactions: { Row: TransactionViewRow; Relationships: [] };
      v_account_balances: {
        Row: {
          account_id: string;
          workspace_id: string;
          name: string;
          type: AccountType;
          subtype: AccountSubtype;
          currency: string;
          opening_balance_minor: number;
          movement_minor: number;
          balance_minor: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      record_channel_transaction: {
        Args: {
          p_workspace_id: string;
          p_actor_id: string;
          p_channel: EntryChannel;
          p_payload: Record<string, unknown>;
        };
        Returns: { id: string; duplicate: boolean; status: string } | null;
      };
      consume_channel_quota: {
        Args: {
          p_workspace_id: string;
          p_actor_id: string;
          p_kind: UsageKind;
          p_limit: number;
        };
        Returns: boolean;
      };
      get_workspace_summary_as_service: {
        Args: { p_workspace_id: string; p_from: string; p_to: string };
        Returns: DashboardSummary | null;
      };
      create_workspace: {
        Args: {
          p_name: string;
          p_currency?: string;
          p_country?: string;
          p_timezone?: string;
          p_legal_name?: string | null;
          p_locale?: string;
        };
        Returns: { id: string; name: string; slug: string; currency: string; timezone: string; locale: string };
      };
      complete_onboarding: {
        Args: {
          p_name: string;
          p_business_type: string | null;
          p_city: string | null;
          p_industry: string | null;
          p_business_size: string | null;
          p_currency?: string;
          p_fiscal_year_start_month?: number;
          p_country?: string;
          p_phone?: string | null;
          p_timezone?: string;
          p_locale?: string;
          p_legal_name?: string | null;
        };
        Returns: { id: string; name: string; slug: string; currency: string; timezone: string; locale: string; onboarding_completed: boolean };
      };
      request_phone_verification: {
        Args: { p_code_hash: string; p_expires_at?: string; p_ip?: string | null };
        Returns: {
          status: string;
          destination?: string;
          expires_at?: string;
          retry_after_seconds?: number;
        };
      };
      verify_phone_verification: {
        Args: { p_code_hash: string };
        Returns: { status: string; attempts_remaining?: number };
      };
      record_transaction: {
        Args: { p_payload: Json };
        Returns: { id: string; duplicate: boolean; status: string; amount_minor: number; currency: string };
      };
      void_transaction: {
        Args: { p_transaction_id: string; p_reason?: string | null };
        Returns: { id: string; status: string };
      };
      accept_invitation: {
        Args: { p_token: string };
        Returns: { workspace_id: string; role: WorkspaceRole };
      };
      get_dashboard_summary: {
        Args: { p_workspace_id: string; p_from: string; p_to: string };
        Returns: DashboardSummary;
      };
      get_report: {
        Args: { p_workspace_id: string; p_from: string; p_to: string };
        Returns: ReportResult;
      };
      consume_quota: {
        Args: { p_workspace_id: string; p_kind: UsageKind; p_limit?: number };
        Returns: boolean;
      };
      get_workspace_members: {
        Args: { p_workspace_id: string };
        Returns: {
          id: string;
          user_id: string;
          role: WorkspaceRole;
          status: MemberStatus;
          joined_at: string | null;
          full_name: string;
          email: string;
        }[];
      };
    };
    Enums: {
      workspace_role: WorkspaceRole;
      transaction_kind: TransactionKind;
      transaction_status: TransactionStatus;
      entry_channel: EntryChannel;
      payment_method: PaymentMethod;
      category_kind: CategoryKind;
      contact_kind: ContactKind;
      account_type: AccountType;
      account_subtype: AccountSubtype;
      workspace_plan: WorkspacePlan;
      subscription_status: SubscriptionStatus;
      member_status: MemberStatus;
      invitation_status: InvitationStatus;
      ai_message_role: AiMessageRole;
      usage_kind: UsageKind;
    };
    CompositeTypes: Record<string, never>;
  };
};
