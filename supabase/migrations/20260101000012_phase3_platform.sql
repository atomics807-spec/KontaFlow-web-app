-- =============================================================================
-- KontaFlow · 0012 — platform operations (plans, AI, notifications, consent,
-- OTP, integrations, offline sync, idempotency) and compatibility views
-- =============================================================================

do $$ begin
  create type public.ai_suggestion_status as enum ('new', 'viewed', 'dismissed', 'acted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ai_suggestion_kind as enum (
    'cashflow', 'expense', 'revenue', 'risk', 'reminder', 'anomaly'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.offline_sync_status as enum ('pending', 'applied', 'conflict', 'failed', 'duplicate');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.idempotency_status as enum ('processing', 'completed', 'failed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Plan catalogue. Global rows with no tenant; readable by any authenticated
-- user, writable only by the service role.
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_-]{2,32}$'),
  name text not null,
  description text not null default '',
  price_minor bigint not null default 0 check (price_minor >= 0),
  currency char(3) not null default 'XAF',
  billing_interval text not null default 'month' check (billing_interval in ('month', 'year')),
  seats_included integer not null default 1 check (seats_included > 0),
  workspace_limit integer check (workspace_limit is null or workspace_limit > 0),
  ai_message_limit integer check (ai_message_limit is null or ai_message_limit > 0),
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_features (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_.-]{2,48}$'),
  name text not null,
  description text not null default '',
  category text not null default 'general' check (category in ('general', 'accounting', 'channels', 'ai', 'team')),
  created_at timestamptz not null default now()
);

create table if not exists public.plan_features (
  plan_id uuid not null references public.subscription_plans (id) on delete cascade,
  feature_id uuid not null references public.subscription_features (id) on delete cascade,
  included boolean not null default true,
  limit_value integer check (limit_value is null or limit_value >= 0),
  primary key (plan_id, feature_id)
);

alter table public.subscriptions
  add column if not exists plan_id uuid references public.subscription_plans (id) on delete restrict,
  add column if not exists provider_customer_id text,
  add column if not exists canceled_at timestamptz;

create or replace function app.link_subscription_plan()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.plan_id is null then
    select id into new.plan_id
    from public.subscription_plans
    where code = new.plan::text
    limit 1;
  end if;
  if new.canceled_at is null and new.status = 'canceled' then
    new.canceled_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_link_plan on public.subscriptions;
create trigger subscriptions_link_plan before insert or update on public.subscriptions
for each row execute function app.link_subscription_plan();

insert into public.subscription_plans (code, name, description, price_minor, billing_interval, seats_included, workspace_limit, ai_message_limit, sort_order)
values
  ('starter', 'Starter', 'For solo traders getting organised.', 0, 'month', 1, 1, 100, 1),
  ('growth', 'Growth', 'For shops and small teams with daily volume.', 9900, 'month', 5, 2, 100, 2),
  ('scale', 'Scale', 'For multi-branch businesses and accountants.', 29900, 'month', 50, null, null, 3)
on conflict (code) do nothing;

insert into public.subscription_features (code, name, description, category)
values
  ('core_bookkeeping', 'Double-entry bookkeeping', 'Ledger, accounts and immutable records.', 'accounting'),
  ('web_channels', 'Web, USSD and WhatsApp', 'Record money from every channel.', 'channels'),
  ('offline_sync', 'Offline capture and sync', 'Keep recording without a connection.', 'channels'),
  ('ai_assistant', 'AI assistant', 'Ask questions against your live books.', 'ai'),
  ('invoicing', 'Invoices', 'Issue invoices and track receivables.', 'accounting'),
  ('inventory', 'Inventory tracking', 'Stock levels and low-stock alerts.', 'accounting'),
  ('team_seats', 'Team members', 'Invite staff with granular roles.', 'team'),
  ('accountant_exports', 'Accountant exports', 'CSV and PDF packs for your accountant.', 'accounting'),
  ('priority_support', 'Priority support', 'Faster human support.', 'general')
on conflict (code) do nothing;

insert into public.plan_features (plan_id, feature_id, included, limit_value)
select p.id, f.id, true, null
from public.subscription_plans p
join public.subscription_features f on f.code in ('core_bookkeeping', 'web_channels', 'offline_sync', 'ai_assistant')
where p.code in ('starter', 'growth', 'scale')
on conflict do nothing;

insert into public.plan_features (plan_id, feature_id, included, limit_value)
select p.id, f.id, true, 5
from public.subscription_plans p
join public.subscription_features f on f.code = 'team_seats'
where p.code = 'growth'
on conflict do nothing;

insert into public.plan_features (plan_id, feature_id, included, limit_value)
select p.id, f.id, true, null
from public.subscription_plans p
join public.subscription_features f on f.code in ('invoicing', 'inventory', 'accountant_exports', 'team_seats')
where p.code = 'scale'
on conflict do nothing;

insert into public.plan_features (plan_id, feature_id, included, limit_value)
select p.id, f.id, true, null
from public.subscription_plans p
join public.subscription_features f on f.code = 'priority_support'
where p.code = 'scale'
on conflict do nothing;

update public.subscriptions s
   set plan_id = p.id
  from public.subscription_plans p
 where s.plan_id is null
   and p.code = s.plan::text;

-- ---------------------------------------------------------------------------
-- Provider payment webhooks. Payloads may carry signatures and payer data, so
-- this table has RLS enabled with no authenticated policy (service role only).
-- ---------------------------------------------------------------------------
create table if not exists public.payment_webhooks (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (length(trim(provider)) between 2 and 40),
  external_event_id text not null,
  event_type text,
  workspace_id uuid references public.workspaces (id) on delete set null,
  payment_transaction_id uuid references public.payment_transactions (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  signature_ok boolean not null default false,
  status text not null default 'received'
    check (status in ('received', 'processed', 'ignored', 'failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, external_event_id)
);
create index if not exists payment_webhooks_received_idx
  on public.payment_webhooks (provider, received_at desc);
create index if not exists payment_webhooks_workspace_idx
  on public.payment_webhooks (workspace_id) where workspace_id is not null;

-- ---------------------------------------------------------------------------
-- AI telemetry and proactive suggestions
-- ---------------------------------------------------------------------------
create table if not exists public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  conversation_id uuid,
  message_id uuid references public.ai_messages (id) on delete set null,
  channel public.entry_channel not null default 'web',
  model text,
  prompt_preview text check (prompt_preview is null or char_length(prompt_preview) <= 500),
  prompt_tokens integer check (prompt_tokens is null or prompt_tokens >= 0),
  completion_tokens integer check (completion_tokens is null or completion_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  cost_minor bigint not null default 0 check (cost_minor >= 0),
  tool_calls jsonb not null default '[]'::jsonb,
  status text not null default 'ok' check (status in ('ok', 'error', 'blocked')),
  error text,
  created_at timestamptz not null default now(),
  constraint ai_interactions_conversation_fk foreign key (workspace_id, conversation_id)
    references public.ai_conversations (workspace_id, id) on delete cascade
);
create index if not exists ai_interactions_workspace_idx
  on public.ai_interactions (workspace_id, created_at desc);
create index if not exists ai_interactions_user_idx
  on public.ai_interactions (user_id, created_at desc);

create table if not exists public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  kind public.ai_suggestion_kind not null,
  title text not null check (char_length(trim(title)) between 1 and 160),
  body text not null default '',
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  payload jsonb not null default '{}'::jsonb,
  status public.ai_suggestion_status not null default 'new',
  dedupe_key text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ai_suggestions_dedupe_key
  on public.ai_suggestions (workspace_id, dedupe_key)
  where dedupe_key is not null;
create index if not exists ai_suggestions_workspace_idx
  on public.ai_suggestions (workspace_id, status, created_at desc);

drop trigger if exists ai_suggestions_set_updated_at on public.ai_suggestions;
create trigger ai_suggestions_set_updated_at before update on public.ai_suggestions
for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Notification preferences, privacy consent, OTP challenges
-- ---------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel public.notification_channel not null,
  category text not null default 'all' check (char_length(category) between 1 and 40),
  enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, channel, category)
);
create index if not exists notification_preferences_user_idx
  on public.notification_preferences (user_id);

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at before update on public.notification_preferences
for each row execute function app.set_updated_at();

create table if not exists public.privacy_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  consent_type text not null
    check (consent_type in ('terms', 'privacy', 'marketing', 'analytics', 'ai_processing')),
  version text not null check (char_length(version) between 1 and 32),
  granted boolean not null default true,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint privacy_consents_revocation check (
    (granted and revoked_at is null) or (not granted and revoked_at is not null)
  )
);
create unique index if not exists privacy_consents_active_key
  on public.privacy_consents (user_id, consent_type, version)
  where revoked_at is null;
create index if not exists privacy_consents_user_idx
  on public.privacy_consents (user_id, consent_type, granted_at desc);

create table if not exists public.otp_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  destination text not null check (char_length(destination) between 4 and 254),
  channel public.notification_channel not null default 'sms'
    check (channel in ('sms', 'whatsapp', 'email')),
  purpose text not null
    check (purpose in ('login', 'phone_verification', 'transaction_confirmation', 'password_reset')),
  code_hash text not null,
  expires_at timestamptz not null default now() + interval '10 minutes',
  consumed_at timestamptz,
  attempts smallint not null default 0 check (attempts between 0 and 10),
  max_attempts smallint not null default 5 check (max_attempts between 1 and 10),
  ip inet,
  created_at timestamptz not null default now()
);
create index if not exists otp_verifications_destination_idx
  on public.otp_verifications (destination, purpose, created_at desc);
create index if not exists otp_verifications_live_idx
  on public.otp_verifications (expires_at)
  where consumed_at is null;

-- ---------------------------------------------------------------------------
-- Integration accounts and the unified integration message log
-- ---------------------------------------------------------------------------
create table if not exists public.integration_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null
    check (provider in ('whatsapp', 'ussd', 'africas_talking', 'resend', 'openai', 'stripe', 'cinetpay', 'flutterwave', 'custom')),
  external_id text,
  display_name text not null default '',
  status text not null default 'active' check (status in ('active', 'disabled', 'error')),
  secret_ref text,
  config jsonb not null default '{}'::jsonb,
  connected_by uuid references public.profiles (id) on delete set null,
  last_synced_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_accounts_secret_ref check (
    secret_ref is null or char_length(secret_ref) between 1 and 200
  )
);
create unique index if not exists integration_accounts_external_key
  on public.integration_accounts (workspace_id, provider, external_id)
  where external_id is not null;
create index if not exists integration_accounts_workspace_idx
  on public.integration_accounts (workspace_id, provider);

create table if not exists public.integration_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  integration_account_id uuid references public.integration_accounts (id) on delete set null,
  provider text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  external_id text,
  from_address text,
  to_address text,
  message_type text not null default 'text',
  body text,
  status text not null default 'received'
    check (status in ('received', 'processed', 'sent', 'delivered', 'failed', 'ignored')),
  error text,
  transaction_id uuid references public.transactions (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists integration_messages_external_key
  on public.integration_messages (provider, external_id)
  where external_id is not null;
create index if not exists integration_messages_workspace_idx
  on public.integration_messages (workspace_id, occurred_at desc);
create index if not exists integration_messages_transaction_idx
  on public.integration_messages (transaction_id) where transaction_id is not null;

drop trigger if exists integration_accounts_set_updated_at on public.integration_accounts;
create trigger integration_accounts_set_updated_at before update on public.integration_accounts
for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Offline sync and idempotency ledgers
-- ---------------------------------------------------------------------------
create table if not exists public.offline_sync_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_id text not null check (char_length(device_id) between 1 and 120),
  client_generated_id text not null check (char_length(client_generated_id) between 1 and 120),
  entity text not null default 'transaction' check (char_length(entity) between 1 and 40),
  operation text not null default 'create' check (operation in ('create', 'update', 'delete')),
  payload_hash text,
  status public.offline_sync_status not null default 'pending',
  server_id uuid,
  error text,
  received_at timestamptz not null default now(),
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, device_id, client_generated_id)
);
create index if not exists offline_sync_records_workspace_idx
  on public.offline_sync_records (workspace_id, status, received_at desc);
create index if not exists offline_sync_records_user_idx
  on public.offline_sync_records (user_id, received_at desc);

create table if not exists public.idempotency_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  scope text not null check (char_length(scope) between 1 and 60),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  request_hash text,
  status public.idempotency_status not null default 'processing',
  response_status integer,
  response_body jsonb,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now()
);
create unique index if not exists idempotency_records_key
  on public.idempotency_records (coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid), scope, idempotency_key);
create index if not exists idempotency_records_expiry_idx
  on public.idempotency_records (expires_at);

-- ---------------------------------------------------------------------------
-- Compatibility views for callers that use the domain vocabulary. They are
-- read-only projections over the canonical tables (`accounts`, `contacts`,
-- `categories`) and inherit Row Level Security through security_invoker.
-- ---------------------------------------------------------------------------
create or replace view public.financial_accounts with (security_invoker = true) as
  select id, workspace_id, name, type, subtype, institution, masked_number,
         opening_balance_minor, currency, is_system, is_archived, created_at, updated_at
  from public.accounts;

create or replace view public.customers with (security_invoker = true) as
  select id, workspace_id, name, phone, email, address, tax_id, notes,
         is_archived, created_by, created_at, updated_at
  from public.contacts
  where kind in ('customer', 'both');

create or replace view public.suppliers with (security_invoker = true) as
  select id, workspace_id, name, phone, email, address, tax_id, notes,
         is_archived, created_by, created_at, updated_at
  from public.contacts
  where kind in ('supplier', 'both');

create or replace view public.transaction_categories with (security_invoker = true) as
  select id, workspace_id, name, kind, color, icon, translations, is_system,
         is_archived, created_at, updated_at
  from public.categories;

create or replace view public.business_categories with (security_invoker = true) as
  select id, workspace_id, name, kind, color, icon, translations, is_system,
         is_archived, created_at, updated_at
  from public.categories;
