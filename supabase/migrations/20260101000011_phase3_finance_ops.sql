-- =============================================================================
-- KontaFlow · 0011 — finance operations (invoices, debts, budgets, goals,
-- inventory, saved reports) and transaction provenance
-- =============================================================================
-- Every tenant-owned table in this file carries workspace_id and is protected
-- by RLS in 0014. Composite foreign keys tie child rows to the same workspace
-- as their parent, so a valid UUID from another tenant cannot be referenced.
-- =============================================================================

do $$ begin
  create type public.transaction_source as enum (
    'manual', 'ai', 'ussd', 'whatsapp', 'import', 'api', 'sync', 'system'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sync_status as enum ('local', 'pending', 'synced', 'conflict', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invoice_status as enum ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.debt_direction as enum ('receivable', 'payable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.debt_status as enum ('open', 'partially_paid', 'settled', 'written_off');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.goal_status as enum ('active', 'achieved', 'paused', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_kind as enum (
    'cashflow', 'income_statement', 'expense_breakdown', 'tax_summary', 'custom'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Provenance on the immutable transaction record.
-- `channel` says how the bytes arrived; `source` says where the business
-- event came from. Offline clients report sync_status, web writes are synced.
-- ---------------------------------------------------------------------------
alter table public.transactions
  add column if not exists source public.transaction_source not null default 'manual',
  add column if not exists sync_status public.sync_status not null default 'synced',
  add column if not exists reverses_transaction_id uuid references public.transactions (id) on delete restrict,
  add column if not exists reversal_reason text;

alter table public.transactions
  drop constraint if exists transactions_reversal_not_self,
  add constraint transactions_reversal_not_self
    check (reverses_transaction_id is null or reverses_transaction_id <> id),
  drop constraint if exists transactions_reversal_reason_len,
  add constraint transactions_reversal_reason_len
    check (reversal_reason is null or char_length(reversal_reason) <= 500);

create unique index if not exists transactions_reverses_key
  on public.transactions (reverses_transaction_id)
  where reverses_transaction_id is not null;
create index if not exists transactions_source_idx
  on public.transactions (workspace_id, source, occurred_on desc);
create index if not exists transactions_pending_sync_idx
  on public.transactions (workspace_id, sync_status)
  where sync_status <> 'synced';

update public.transactions
   set source = case channel
     when 'ussd' then 'ussd'::public.transaction_source
     when 'whatsapp' then 'whatsapp'::public.transaction_source
     when 'ai' then 'ai'::public.transaction_source
     when 'sync' then 'sync'::public.transaction_source
     when 'api' then 'api'::public.transaction_source
     when 'system' then 'system'::public.transaction_source
     else 'manual'::public.transaction_source
   end
 where source = 'manual' and channel <> 'web';

create or replace function app.derive_transaction_provenance()
returns trigger
language plpgsql
as $$
begin
  if new.channel in ('ussd', 'whatsapp', 'ai', 'api', 'system') then
    new.source := new.channel::text::public.transaction_source;
  elsif new.channel = 'sync' and new.source = 'manual' then
    new.source := 'sync';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_derive_source on public.transactions;
create trigger transactions_derive_source
before insert on public.transactions
for each row execute function app.derive_transaction_provenance();

-- A reversal may only point at a posted transaction in the same workspace.
create or replace function app.assert_reversal_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target public.transactions;
begin
  if new.reverses_transaction_id is null then
    return new;
  end if;
  select * into v_target from public.transactions where id = new.reverses_transaction_id;
  if not found then
    raise exception 'Reversed transaction not found' using errcode = 'check_violation';
  end if;
  if v_target.workspace_id <> new.workspace_id then
    raise exception 'A reversal must stay inside its workspace' using errcode = 'check_violation';
  end if;
  if v_target.status <> 'posted' then
    raise exception 'Only a posted transaction can be reversed' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_assert_reversal_scope on public.transactions;
create trigger transactions_assert_reversal_scope
before insert or update of reverses_transaction_id on public.transactions
for each row execute function app.assert_reversal_scope();

-- ---------------------------------------------------------------------------
-- Composite FK targets. (workspace_id, id) uniqueness lets children reference
-- a parent together with its tenant, which a plain id FK cannot express.
-- ---------------------------------------------------------------------------
create unique index if not exists accounts_workspace_id_key
  on public.accounts (workspace_id, id);
create unique index if not exists categories_workspace_id_key
  on public.categories (workspace_id, id);
create unique index if not exists contacts_workspace_id_key
  on public.contacts (workspace_id, id);
create unique index if not exists ai_conversations_workspace_id_key
  on public.ai_conversations (workspace_id, id);

-- ---------------------------------------------------------------------------
-- Business settings: one row per workspace, created automatically.
-- ---------------------------------------------------------------------------
create table if not exists public.business_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  invoice_prefix text not null default 'INV'
    check (invoice_prefix ~ '^[A-Z0-9]{1,8}$'),
  invoice_next_number integer not null default 1
    check (invoice_next_number between 1 and 999999),
  default_tax_rate_bp integer not null default 0
    check (default_tax_rate_bp between 0 and 10000),
  prices_include_tax boolean not null default false,
  receipt_footer text check (receipt_footer is null or char_length(receipt_footer) <= 500),
  date_format text not null default 'DD/MM/YYYY'
    check (date_format in ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')),
  inventory_enabled boolean not null default false,
  low_stock_alerts boolean not null default true,
  ai_auto_categorize boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.business_settings is
  'One inbox of operational preferences per workspace (invoicing, tax, inventory).';

create or replace function app.create_business_settings()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.business_settings (workspace_id)
  values (new.id)
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;

drop trigger if exists workspaces_create_settings on public.workspaces;
create trigger workspaces_create_settings
after insert on public.workspaces
for each row execute function app.create_business_settings();

insert into public.business_settings (workspace_id)
select id from public.workspaces
on conflict (workspace_id) do nothing;

drop trigger if exists business_settings_set_updated_at on public.business_settings;
create trigger business_settings_set_updated_at before update on public.business_settings
for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Invoices. Totals are derived from invoice_items by trigger; once an invoice
-- leaves draft its financial fields are frozen. Corrections void, never edit.
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  customer_id uuid not null,
  number text not null check (char_length(trim(number)) between 1 and 40),
  status public.invoice_status not null default 'draft',
  issue_on date not null default current_date,
  due_on date not null,
  currency char(3) not null default 'XAF',
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  amount_paid_minor bigint not null default 0 check (amount_paid_minor >= 0),
  notes text check (notes is null or char_length(notes) <= 2000),
  terms text check (terms is null or char_length(terms) <= 2000),
  storage_path text,
  sent_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_due_after_issue check (due_on >= issue_on),
  constraint invoices_paid_within_total check (amount_paid_minor <= total_minor),
  constraint invoices_workspace_id_key unique (workspace_id, id),
  constraint invoices_number_key unique (workspace_id, number),
  constraint invoices_customer_fk foreign key (workspace_id, customer_id)
    references public.contacts (workspace_id, id) on delete restrict
);
create index if not exists invoices_workspace_status_idx
  on public.invoices (workspace_id, status, due_on);
create index if not exists invoices_customer_idx
  on public.invoices (workspace_id, customer_id);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  invoice_id uuid not null,
  position smallint not null check (position between 1 and 200),
  description text not null check (char_length(trim(description)) between 1 and 300),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  tax_rate_bp integer not null default 0 check (tax_rate_bp between 0 and 10000),
  line_total_minor bigint not null default 0 check (line_total_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_items_position_key unique (invoice_id, position),
  constraint invoice_items_invoice_fk foreign key (workspace_id, invoice_id)
    references public.invoices (workspace_id, id) on delete cascade
);
create index if not exists invoice_items_invoice_idx
  on public.invoice_items (invoice_id, position);

drop trigger if exists invoice_items_set_updated_at on public.invoice_items;
create trigger invoice_items_set_updated_at before update on public.invoice_items
for each row execute function app.set_updated_at();

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at before update on public.invoices
for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Debts and repayments. paid_minor is maintained from non-voided payments.
-- ---------------------------------------------------------------------------
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  direction public.debt_direction not null,
  contact_id uuid not null,
  description text not null check (char_length(trim(description)) between 1 and 300),
  principal_minor bigint not null check (principal_minor > 0),
  paid_minor bigint not null default 0 check (paid_minor >= 0),
  currency char(3) not null default 'XAF',
  opened_on date not null default current_date,
  due_on date,
  status public.debt_status not null default 'open',
  invoice_id uuid,
  transaction_id uuid references public.transactions (id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 1000),
  closed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint debts_paid_within_principal check (paid_minor <= principal_minor),
  constraint debts_due_after_open check (due_on is null or due_on >= opened_on),
  constraint debts_workspace_id_key unique (workspace_id, id),
  constraint debts_contact_fk foreign key (workspace_id, contact_id)
    references public.contacts (workspace_id, id) on delete restrict,
  constraint debts_invoice_fk foreign key (workspace_id, invoice_id)
    references public.invoices (workspace_id, id) on delete restrict
);
create index if not exists debts_workspace_status_idx
  on public.debts (workspace_id, direction, status, due_on);
create index if not exists debts_contact_idx on public.debts (workspace_id, contact_id);

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  debt_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  paid_on date not null default current_date,
  account_id uuid references public.accounts (id) on delete restrict,
  payment_method public.payment_method not null default 'cash',
  transaction_id uuid references public.transactions (id) on delete set null,
  reference text,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid references public.profiles (id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint debt_payments_debt_fk foreign key (workspace_id, debt_id)
    references public.debts (workspace_id, id) on delete restrict
);
create index if not exists debt_payments_debt_idx
  on public.debt_payments (debt_id, paid_on);
create index if not exists debt_payments_workspace_idx
  on public.debt_payments (workspace_id, paid_on desc);

drop trigger if exists debts_set_updated_at on public.debts;
create trigger debts_set_updated_at before update on public.debts
for each row execute function app.set_updated_at();

drop trigger if exists debt_payments_set_updated_at on public.debt_payments;
create trigger debt_payments_set_updated_at before update on public.debt_payments
for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Budgets, goals and inventory
-- ---------------------------------------------------------------------------
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  category_id uuid,
  period_start date not null,
  period_end date not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'XAF',
  alert_threshold_bp integer not null default 8000
    check (alert_threshold_bp between 0 and 10000),
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_period_order check (period_end >= period_start),
  constraint budgets_category_fk foreign key (workspace_id, category_id)
    references public.categories (workspace_id, id) on delete restrict
);
create unique index if not exists budgets_category_period_key
  on public.budgets (workspace_id, category_id, period_start)
  where category_id is not null;
create unique index if not exists budgets_workspace_period_key
  on public.budgets (workspace_id, period_start)
  where category_id is null;
create index if not exists budgets_workspace_period_idx
  on public.budgets (workspace_id, period_start desc);

create table if not exists public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  target_minor bigint not null check (target_minor > 0),
  saved_minor bigint not null default 0 check (saved_minor >= 0),
  currency char(3) not null default 'XAF',
  target_date date,
  account_id uuid references public.accounts (id) on delete set null,
  status public.goal_status not null default 'active',
  notes text check (notes is null or char_length(notes) <= 1000),
  achieved_at timestamptz,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists financial_goals_workspace_idx
  on public.financial_goals (workspace_id, status, target_date);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  sku text not null check (char_length(trim(sku)) between 1 and 64),
  name text not null check (char_length(trim(name)) between 1 and 200),
  description text,
  unit text not null default 'unit' check (char_length(trim(unit)) between 1 and 24),
  quantity numeric(14, 3) not null default 0 check (quantity >= 0),
  reorder_level numeric(14, 3) not null default 0 check (reorder_level >= 0),
  cost_minor bigint not null default 0 check (cost_minor >= 0),
  price_minor bigint not null default 0 check (price_minor >= 0),
  currency char(3) not null default 'XAF',
  category_id uuid,
  is_archived boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_category_fk foreign key (workspace_id, category_id)
    references public.categories (workspace_id, id) on delete restrict
);
create unique index if not exists inventory_items_workspace_sku_key
  on public.inventory_items (workspace_id, lower(sku));
create index if not exists inventory_items_low_stock_idx
  on public.inventory_items (workspace_id)
  where not is_archived and quantity <= reorder_level;

-- ---------------------------------------------------------------------------
-- Saved report snapshots (the live reports stay computed on demand).
-- ---------------------------------------------------------------------------
create table if not exists public.financial_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind public.report_kind not null,
  title text not null check (char_length(trim(title)) between 1 and 160),
  period_start date not null,
  period_end date not null,
  currency char(3) not null default 'XAF',
  params jsonb not null default '{}'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  storage_path text,
  generated_by uuid references public.profiles (id) on delete set null,
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint financial_reports_period_order check (period_end >= period_start)
);
create index if not exists financial_reports_workspace_idx
  on public.financial_reports (workspace_id, generated_at desc);

drop trigger if exists budgets_set_updated_at on public.budgets;
create trigger budgets_set_updated_at before update on public.budgets
for each row execute function app.set_updated_at();

drop trigger if exists financial_goals_set_updated_at on public.financial_goals;
create trigger financial_goals_set_updated_at before update on public.financial_goals
for each row execute function app.set_updated_at();

drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at before update on public.inventory_items
for each row execute function app.set_updated_at();
