-- =============================================================================
-- KontaFlow · 0004 — AI, audit, notifications, channels and billing
-- =============================================================================

-- -------------------------------- AI ----------------------------------------
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists ai_conversations_user_idx
  on public.ai_conversations (user_id, workspace_id, updated_at desc);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  role public.ai_message_role not null,
  content text not null default '',
  tool_name text,
  tool_args jsonb,
  tool_result jsonb,
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  created_at timestamptz not null default now()
);
create index if not exists ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at);

drop trigger if exists ai_conversations_set_updated_at on public.ai_conversations;
create trigger ai_conversations_set_updated_at before update on public.ai_conversations
for each row execute function app.set_updated_at();

-- ------------------------------- Audit --------------------------------------
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_type public.actor_type not null default 'user',
  action text not null,
  entity text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);
comment on table public.audit_logs is 'Append-only record of financial and access changes.';
create index if not exists audit_logs_workspace_idx
  on public.audit_logs (workspace_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, entity_id);

-- ---------------------------- Notifications ---------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel public.notification_channel not null default 'in_app',
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- ------------------------------ Channels ------------------------------------
create table if not exists public.ussd_sessions (
  session_id text primary key,
  phone text not null,
  user_id uuid references public.profiles (id) on delete set null,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  service_code text,
  expires_at timestamptz not null default now() + interval '10 minutes',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ussd_sessions_phone_idx on public.ussd_sessions (phone);

drop trigger if exists ussd_sessions_set_updated_at on public.ussd_sessions;
create trigger ussd_sessions_set_updated_at before update on public.ussd_sessions
for each row execute function app.set_updated_at();

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  wa_message_id text unique,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_phone text not null,
  to_phone text not null,
  message_type text not null default 'text',
  body text,
  status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_messages_workspace_idx
  on public.whatsapp_messages (workspace_id, created_at desc);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text,
  status text not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored')),
  payload jsonb not null default '{}'::jsonb,
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, external_id)
);
create index if not exists webhook_events_provider_idx on public.webhook_events (provider, received_at desc);

create table if not exists public.sync_devices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_id text not null,
  platform text,
  app_version text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id, device_id)
);

-- ------------------------------ Billing -------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  plan public.workspace_plan not null default 'starter',
  status public.subscription_status not null default 'trialing',
  provider text not null default 'none',
  provider_ref text,
  price_minor bigint not null default 0 check (price_minor >= 0),
  currency char(3) not null default 'XAF',
  seats integer not null default 1 check (seats > 0),
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_status_idx on public.subscriptions (status);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at before update on public.subscriptions
for each row execute function app.set_updated_at();

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  provider text not null,
  provider_ref text,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'XAF',
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_ref)
);
create index if not exists payment_transactions_workspace_idx
  on public.payment_transactions (workspace_id, created_at desc);

-- ------------------------------- Usage --------------------------------------
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  kind public.usage_kind not null,
  quantity integer not null default 1 check (quantity > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_workspace_idx
  on public.usage_events (workspace_id, kind, created_at desc);

-- ---------------------------------------------------------------------------
-- Usage metering + quota enforcement, callable by the app server.
-- ---------------------------------------------------------------------------
create or replace function public.consume_quota(
  p_workspace_id uuid,
  p_kind public.usage_kind,
  p_limit integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_used integer;
begin
  if not app.is_workspace_member(p_workspace_id) then
    raise exception 'Not a member of this workspace' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(sum(quantity), 0) into v_used
  from public.usage_events
  where workspace_id = p_workspace_id
    and kind = p_kind
    and created_at >= date_trunc('month', now());

  if v_used >= greatest(p_limit, 1) then
    return false;
  end if;

  insert into public.usage_events (workspace_id, user_id, kind, quantity)
  values (p_workspace_id, auth.uid(), p_kind, 1);

  return true;
end;
$$;
