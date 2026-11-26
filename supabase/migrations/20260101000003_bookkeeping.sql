-- =============================================================================
-- KontaFlow · 0003 — bookkeeping core (chart of accounts, ledger, records)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Chart of accounts. "Money accounts" (cash, bank, mobile money) are the
-- buckets users pick in the UI; the rest are system accounts used for posting.
-- ---------------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  type public.account_type not null,
  subtype public.account_subtype not null default 'other',
  institution text,
  masked_number text,
  opening_balance_minor bigint not null default 0,
  currency char(3) not null default 'XAF',
  is_system boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);
create index if not exists accounts_workspace_idx on public.accounts (workspace_id, subtype);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  kind public.category_kind not null,
  color text not null default '#12B981',
  icon text,
  translations jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists categories_workspace_kind_name_key
  on public.categories (workspace_id, kind, lower(name));

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind public.contact_kind not null default 'customer',
  name text not null check (char_length(trim(name)) between 1 and 160),
  phone text,
  email text,
  address text,
  tax_id text,
  notes text,
  is_archived boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contacts_workspace_idx on public.contacts (workspace_id, kind);

-- ---------------------------------------------------------------------------
-- Transactions: the human-facing record. Amounts are positive minor units;
-- direction comes from `kind`. The double-entry lines are written by the
-- posting function, never by the client.
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind public.transaction_kind not null,
  status public.transaction_status not null default 'posted',
  occurred_on date not null,
  occurred_at timestamptz not null default now(),
  description text not null check (char_length(trim(description)) between 1 and 500),
  reference text,
  category_id uuid references public.categories (id) on delete set null,
  account_id uuid not null references public.accounts (id) on delete restrict,
  counter_account_id uuid references public.accounts (id) on delete restrict,
  contact_id uuid references public.contacts (id) on delete set null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'XAF',
  payment_method public.payment_method not null default 'cash',
  channel public.entry_channel not null default 'web',
  attachment_path text,
  client_generated_id text,
  created_by uuid references public.profiles (id) on delete set null,
  recorded_at timestamptz not null default now(),
  recorded_timezone text not null default 'Africa/Douala',
  sync_received_at timestamptz,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  void_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.transactions is
  'Immutable financial events. Amounts are integer minor units; corrections require voiding.';

create index if not exists transactions_workspace_date_idx
  on public.transactions (workspace_id, occurred_on desc);
create index if not exists transactions_workspace_kind_idx
  on public.transactions (workspace_id, kind, status);
create index if not exists transactions_category_idx
  on public.transactions (workspace_id, category_id);
create unique index if not exists transactions_client_generated_key
  on public.transactions (workspace_id, client_generated_id)
  where client_generated_id is not null;
create index if not exists transactions_contact_idx
  on public.transactions (workspace_id, contact_id);

-- ---------------------------------------------------------------------------
-- Double-entry ledger lines. Exactly one side is non-zero per line and the
-- sum of debits must equal the sum of credits per transaction.
-- ---------------------------------------------------------------------------
create table if not exists public.ledger_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  category_id uuid references public.categories (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  line_no smallint not null check (line_no > 0),
  debit_minor bigint not null default 0 check (debit_minor >= 0),
  credit_minor bigint not null default 0 check (credit_minor >= 0),
  memo text,
  created_at timestamptz not null default now(),
  constraint ledger_lines_one_sided check (
    (debit_minor > 0 and credit_minor = 0) or (credit_minor > 0 and debit_minor = 0)
  ),
  unique (transaction_id, line_no)
);
create index if not exists ledger_lines_transaction_idx on public.ledger_lines (transaction_id);
create index if not exists ledger_lines_workspace_account_idx
  on public.ledger_lines (workspace_id, account_id);

-- ---------------------------------------------------------------------------
-- Attachments (receipts, invoices) stored in Supabase Storage.
-- ---------------------------------------------------------------------------
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, storage_path)
);
create index if not exists attachments_transaction_idx on public.attachments (transaction_id);

-- ---------------------------------------------------------------------------
-- Balance guard: enforced by a deferrable constraint trigger so the posting
-- function can insert both sides inside one transaction.
-- ---------------------------------------------------------------------------
create or replace function app.assert_transaction_balanced()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_debit bigint;
  v_credit bigint;
  v_count integer;
begin
  select coalesce(sum(debit_minor), 0), coalesce(sum(credit_minor), 0), count(*)
    into v_debit, v_credit, v_count
  from public.ledger_lines
  where transaction_id = new.transaction_id;

  if v_count < 2 then
    raise exception 'A transaction needs at least two ledger lines (transaction %)', new.transaction_id
      using errcode = 'check_violation';
  end if;

  if v_debit <> v_credit then
    raise exception 'Unbalanced transaction %: debit % <> credit %',
      new.transaction_id, v_debit, v_credit
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists ledger_lines_balanced on public.ledger_lines;
create constraint trigger ledger_lines_balanced
after insert on public.ledger_lines
deferrable initially deferred
for each row execute function app.assert_transaction_balanced();

-- ---------------------------------------------------------------------------
-- Immutability: posted financial fields cannot be edited. Only voiding is
-- allowed, and it is recorded for audit.
-- ---------------------------------------------------------------------------
create or replace function app.protect_posted_transaction()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'voided' then
    raise exception 'A voided transaction is final' using errcode = 'check_violation';
  end if;

  if new.status = 'voided' then
    if new.amount_minor <> old.amount_minor
       or new.kind <> old.kind
       or new.occurred_on <> old.occurred_on
       or new.account_id <> old.account_id
       or new.counter_account_id is distinct from old.counter_account_id
       or new.category_id is distinct from old.category_id
       or new.workspace_id <> old.workspace_id then
      raise exception 'Voiding cannot change financial fields' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if new.amount_minor <> old.amount_minor
     or new.kind <> old.kind
     or new.occurred_on <> old.occurred_on
     or new.account_id <> old.account_id
     or new.counter_account_id is distinct from old.counter_account_id
     or new.category_id is distinct from old.category_id
     or new.workspace_id <> old.workspace_id
     or new.currency <> old.currency then
    raise exception 'Posted transactions are immutable; void and re-record instead'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_immutable on public.transactions;
create trigger transactions_immutable
before update on public.transactions
for each row execute function app.protect_posted_transaction();

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at before update on public.transactions
for each row execute function app.set_updated_at();

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at before update on public.accounts
for each row execute function app.set_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories
for each row execute function app.set_updated_at();

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at before update on public.contacts
for each row execute function app.set_updated_at();

-- System accounts and categories are part of the ledger's integrity: archive,
-- never delete.
create or replace function app.protect_system_records()
returns trigger
language plpgsql
as $$
begin
  if old.is_system then
    raise exception 'System records cannot be deleted; archive them instead'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists accounts_protect_system on public.accounts;
create trigger accounts_protect_system before delete on public.accounts
for each row execute function app.protect_system_records();

drop trigger if exists categories_protect_system on public.categories;
create trigger categories_protect_system before delete on public.categories
for each row execute function app.protect_system_records();
