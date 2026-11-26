/**
 * Hand-maintained mirror of the public schema, used to type the Supabase
 * clients. Regenerate with `supabase gen types typescript --local` after
 * schema changes and keep the RPC signatures in sync.
 */
import type { AdvisorFocus, BusinessIntelligence } from "./ai-advisor";
import type {
  AccountRestrictionRow,
  PlatformAdminAccount,
  PlatformAdminAuditEntry,
  PlatformAdminOverview,
  PlatformAdminRole,
  PlatformAdminRow,
  PlatformAdminUser,
  PlatformAdminWorkspace,
  RestrictionSeverity,
} from "./platform-admin";

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
export type AiCommandStatus = "pending" | "confirmed" | "dismissed" | "reversed" | "failed";
export type UsageKind = "ai_message" | "ussd_session" | "whatsapp_message" | "sync_push";
export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "void";
export type DebtDirection = "receivable" | "payable";
export type DebtStatus = "open" | "partially_paid" | "settled" | "written_off";
export type GoalStatus = "active" | "achieved" | "paused" | "cancelled";

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

export type AttachmentRow = {
  id: string;
  workspace_id: string;
  transaction_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
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
  attachment_path: string | null;
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

export type AiInteractionRow = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  channel: EntryChannel;
  model: string | null;
  prompt_preview: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  latency_ms: number | null;
  cost_minor: number;
  tool_calls: Json;
  status: string;
  error: string | null;
  created_at: string;
};

export type AiCommandRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  conversation_id: string | null;
  message_id: string | null;
  request_id: string;
  command_text: string;
  reply: string;
  locale: string;
  status: AiCommandStatus;
  auto_posted: boolean;
  interpretation: Json;
  preview: Json;
  result: Json | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
  reversed_at: string | null;
  reversed_by: string | null;
  undo_expires_at: string | null;
  expires_at: string;
};

export type BusinessSettingsRow = {
  workspace_id: string;
  invoice_prefix: string;
  invoice_next_number: number;
  default_tax_rate_bp: number;
  prices_include_tax: boolean;
  receipt_footer: string | null;
  date_format: string;
  inventory_enabled: boolean;
  low_stock_alerts: boolean;
  ai_auto_categorize: boolean;
  ai_auto_post: boolean;
  ai_auto_post_max_minor: number;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type AiWorkspacePreferencesRow = {
  workspace_id: string;
  insights_enabled: boolean;
  analysis_window_days: number;
  history_retention_days: number;
  advisor_focus: AdvisorFocus;
  advisor_note: string | null;
  created_at: string;
  updated_at: string;
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
  verification_code_hash: string | null;
  verification_expires_at: string | null;
  verification_attempts: number;
  verification_sent_at: string | null;
  verification_method: "whatsapp_reply" | "template" | "ussd_link" | "legacy" | null;
  consent_at: string | null;
  consent_version: string | null;
  opted_out_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  service_window_expires_at: string | null;
  display_name: string | null;
  metadata: Json;
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
  status_updated_at: string | null;
  error_code: string | null;
  error_title: string | null;
  wa_timestamp: string | null;
  conversation_category: string | null;
  display_name: string | null;
  payload: Json;
  metadata: Json;
  created_at: string;
};

export type WebhookEventRow = {
  id: string;
  provider: string;
  external_id: string | null;
  status: "received" | "processing" | "processed" | "failed" | "ignored";
  payload: Json;
  error: string | null;
  attempts: number;
  received_at: string;
  last_attempt_at: string | null;
  processed_at: string | null;
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

export type AccountBalanceRow = {
  account_id: string;
  workspace_id: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  institution: string | null;
  masked_number: string | null;
  currency: string;
  opening_balance_minor: number;
  is_system: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  movement_minor: number;
  balance_minor: number;
};

export type DebtViewRow = {
  id: string;
  workspace_id: string;
  direction: DebtDirection;
  contact_id: string;
  contact_name: string;
  contact_kind: ContactKind;
  description: string;
  principal_minor: number;
  paid_minor: number;
  remaining_minor: number;
  currency: string;
  opened_on: string;
  due_on: string | null;
  status: DebtStatus;
  invoice_id: string | null;
  invoice_number: string | null;
  transaction_id: string | null;
  notes: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  is_overdue: boolean;
};

export type InvoiceViewRow = {
  id: string;
  workspace_id: string;
  customer_id: string;
  customer_name: string;
  number: string;
  status: InvoiceStatus;
  issue_on: string;
  due_on: string;
  currency: string;
  subtotal_minor: number;
  tax_minor: number;
  total_minor: number;
  amount_paid_minor: number;
  remaining_minor: number;
  notes: string | null;
  terms: string | null;
  sent_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
  is_overdue: boolean;
  linked_debt_id: string | null;
};

export type BudgetProgressRow = {
  id: string;
  workspace_id: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  category_translations: Record<string, string> | null;
  category_color: string | null;
  period_start: string;
  period_end: string;
  amount_minor: number;
  currency: string;
  alert_threshold_bp: number;
  spent_minor: number;
};

export type DebtPaymentRow = {
  id: string;
  workspace_id: string;
  debt_id: string;
  amount_minor: number;
  paid_on: string;
  account_id: string | null;
  payment_method: PaymentMethod;
  transaction_id: string | null;
  reference: string | null;
  notes: string | null;
  created_by: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialGoalRow = {
  id: string;
  workspace_id: string;
  name: string;
  target_minor: number;
  saved_minor: number;
  currency: string;
  target_date: string | null;
  account_id: string | null;
  status: GoalStatus;
  notes: string | null;
  achieved_at: string | null;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceRow = {
  id: string;
  workspace_id: string;
  customer_id: string;
  number: string;
  status: InvoiceStatus;
  issue_on: string;
  due_on: string;
  currency: string;
  subtotal_minor: number;
  tax_minor: number;
  total_minor: number;
  amount_paid_minor: number;
  notes: string | null;
  terms: string | null;
  storage_path: string | null;
  sent_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceItemRow = {
  id: string;
  workspace_id: string;
  invoice_id: string;
  position: number;
  description: string;
  quantity: number;
  unit_price_minor: number;
  tax_rate_bp: number;
  line_total_minor: number;
  created_at: string;
  updated_at: string;
};

export type BudgetRow = {
  id: string;
  workspace_id: string;
  name: string;
  category_id: string | null;
  period_start: string;
  period_end: string;
  amount_minor: number;
  currency: string;
  alert_threshold_bp: number;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DebtRow = {
  id: string;
  workspace_id: string;
  direction: DebtDirection;
  contact_id: string;
  description: string;
  principal_minor: number;
  paid_minor: number;
  currency: string;
  opened_on: string;
  due_on: string | null;
  status: DebtStatus;
  invoice_id: string | null;
  transaction_id: string | null;
  notes: string | null;
  closed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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
  outstandingReceivablesMinor: string;
  outstandingPayablesMinor: string;
  overdueReceivablesMinor: string;
  overduePayablesMinor: string;
  openDebtCount: number;
  aiMessagesUsed: number;
  monthlySeries: { month: string; income: string; expense: string }[];
  topExpenseCategories: { name: string; translations: Record<string, string>; color: string; total: string }[];
  budgetProgress: {
    id: string;
    name: string;
    category_id: string | null;
    category_name: string | null;
    category_translations: Record<string, string> | null;
    category_color: string | null;
    period_start: string;
    period_end: string;
    amount_minor: string;
    spent_minor: string;
    currency: string;
  }[];
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
      attachments: TableDefinition<AttachmentRow>;
      ai_conversations: TableDefinition<AiConversationRow>;
      ai_messages: TableDefinition<AiMessageRow>;
      ai_commands: TableDefinition<AiCommandRow>;
      ai_interactions: TableDefinition<AiInteractionRow>;
      business_settings: TableDefinition<BusinessSettingsRow>;
      ai_workspace_preferences: TableDefinition<AiWorkspacePreferencesRow>;
      audit_logs: TableDefinition<AuditLogRow>;
      subscriptions: TableDefinition<SubscriptionRow>;
      payment_transactions: TableDefinition<PaymentTransactionRow>;
      usage_events: TableDefinition<UsageEventRow>;
      channel_identities: TableDefinition<ChannelIdentityRow>;
      notifications: TableDefinition<NotificationRow>;
      invoices: TableDefinition<InvoiceRow>;
      invoice_items: TableDefinition<InvoiceItemRow>;
      debts: TableDefinition<DebtRow>;
      debt_payments: TableDefinition<DebtPaymentRow>;
      budgets: TableDefinition<BudgetRow>;
      financial_goals: TableDefinition<FinancialGoalRow>;
      contact_messages: TableDefinition<ContactMessageRow>;
      ussd_sessions: TableDefinition<UssdSessionRow>;
      whatsapp_messages: TableDefinition<WhatsappMessageRow>;
      webhook_events: TableDefinition<WebhookEventRow>;
      platform_admins: TableDefinition<PlatformAdminRow>;
      account_restrictions: TableDefinition<AccountRestrictionRow>;
      platform_admin_audit_log: TableDefinition<{
        id: string;
        admin_user_id: string | null;
        action: string;
        target_type: string;
        target_id: string | null;
        details: Json;
        ip: string | null;
        created_at: string;
      }>;
    };
    Views: {
      v_transactions: { Row: TransactionViewRow; Relationships: [] };
      v_account_balances: { Row: AccountBalanceRow; Relationships: [] };
      v_debts: { Row: DebtViewRow; Relationships: [] };
      v_invoices: { Row: InvoiceViewRow; Relationships: [] };
      v_budget_progress: { Row: BudgetProgressRow; Relationships: [] };
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
      get_report_as_service: {
        Args: { p_workspace_id: string; p_from: string; p_to: string };
        Returns: ReportResult;
      };
      claim_webhook_event: {
        Args: { p_provider: string; p_external_id: string; p_payload?: Json };
        Returns: {
          claimed: boolean;
          event_id?: string;
          status?: string;
          attempt?: number;
          retry?: boolean;
          retry_after_seconds?: number;
        };
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
      has_workspace_feature: {
        Args: { p_workspace_id: string; p_feature_code: string };
        Returns: boolean;
      };
      next_invoice_number: {
        Args: { p_workspace_id: string };
        Returns: string;
      };
      create_invoice: {
        Args: { p_payload: Json };
        Returns: { id: string; number: string; total_minor: string; status: InvoiceStatus };
      };
      issue_invoice: {
        Args: { p_invoice_id: string };
        Returns: { id: string; status: InvoiceStatus; debt_id: string };
      };
      record_debt_payment: {
        Args: { p_payload: Json };
        Returns: { id: string; transaction_id: string | null; status: DebtStatus };
      };
      confirm_ai_command: {
        Args: { p_command_id: string; p_auto_posted?: boolean };
        Returns: Json;
      };
      dismiss_ai_command: {
        Args: { p_command_id: string };
        Returns: Json;
      };
      undo_ai_command: {
        Args: { p_command_id: string; p_reason?: string | null };
        Returns: Json;
      };
      set_ai_command_reply: {
        Args: { p_command_id: string; p_reply: string };
        Returns: Json;
      };
      void_invoice: {
        Args: { p_invoice_id: string; p_reason: string | null };
        Returns: { id: string; status: InvoiceStatus };
      };
      get_report: {
        Args: { p_workspace_id: string; p_from: string; p_to: string };
        Returns: ReportResult;
      };
      get_business_intelligence: {
        Args: { p_workspace_id: string; p_from: string; p_to: string };
        Returns: BusinessIntelligence;
      };
      update_ai_preferences: {
        Args: {
          p_workspace_id: string;
          p_insights_enabled: boolean;
          p_analysis_window_days: number;
          p_history_retention_days: number;
          p_advisor_focus: AdvisorFocus;
          p_advisor_note: string | null;
        };
        Returns: {
          workspace_id: string;
          insights_enabled: boolean;
          analysis_window_days: number;
          history_retention_days: number;
          advisor_focus: AdvisorFocus;
          advisor_note: string | null;
        };
      };
      purge_ai_history: {
        Args: {
          p_workspace_id: string;
          p_older_than_days?: number | null;
          p_delete_all?: boolean;
        };
        Returns: {
          older_than_days: number;
          messages: number;
          interactions: number;
          conversations: number;
        };
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
      platform_admin_overview: {
        Args: Record<string, never>;
        Returns: PlatformAdminOverview;
      };
      platform_admin_list_users: {
        Args: { p_search?: string | null; p_limit?: number; p_offset?: number };
        Returns: PlatformAdminUser[];
      };
      platform_admin_list_workspaces: {
        Args: { p_search?: string | null; p_limit?: number; p_offset?: number };
        Returns: PlatformAdminWorkspace[];
      };
      platform_admin_list_admins: {
        Args: Record<string, never>;
        Returns: PlatformAdminAccount[];
      };
      platform_admin_list_audit: {
        Args: { p_limit?: number };
        Returns: PlatformAdminAuditEntry[];
      };
      platform_admin_restrict_user: {
        Args: {
          p_user_id: string;
          p_severity: RestrictionSeverity;
          p_reason: string;
          p_expires_at?: string | null;
          p_ip?: string | null;
        };
        Returns: {
          id: string;
          user_id: string;
          severity: RestrictionSeverity;
          reason: string;
          expires_at: string | null;
          created_at: string;
        };
      };
      platform_admin_lift_restriction: {
        Args: { p_restriction_id: string; p_reason?: string | null; p_ip?: string | null };
        Returns: {
          id: string;
          user_id: string;
          previous_severity: RestrictionSeverity;
        };
      };
      platform_admin_set_workspace_plan: {
        Args: {
          p_workspace_id: string;
          p_plan: WorkspacePlan;
          p_note?: string | null;
          p_ip?: string | null;
        };
        Returns: {
          workspace_id: string;
          previous_plan: WorkspacePlan;
          plan: WorkspacePlan;
        };
      };
      platform_admin_set_admin_status: {
        Args: { p_user_id: string; p_is_active: boolean; p_ip?: string | null };
        Returns: { user_id: string; is_active: boolean };
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
      invoice_status: InvoiceStatus;
      debt_direction: DebtDirection;
      debt_status: DebtStatus;
      goal_status: GoalStatus;
      platform_admin_role: PlatformAdminRole;
      restriction_severity: RestrictionSeverity;
    };
    CompositeTypes: Record<string, never>;
  };
};
