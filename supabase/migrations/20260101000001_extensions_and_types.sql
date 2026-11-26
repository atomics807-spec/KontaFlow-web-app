-- =============================================================================
-- KontaFlow · 0001 — extensions, schemas and enumerated types
-- =============================================================================
-- Conventions
--   * every tenant-owned row carries workspace_id (uuid)
--   * money is stored as bigint minor units (XAF/XOF have no minor unit)
--   * timestamps are timestamptz; business dates are `date` in the workspace tz
-- =============================================================================

create schema if not exists app;
comment on schema app is 'Internal helpers. Not exposed through PostgREST.';

-- gen_random_uuid() is built into PostgreSQL 13+; no extension is required.

do $$ begin
  create type public.workspace_role as enum ('owner', 'admin', 'accountant', 'manager', 'staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_status as enum ('invited', 'active', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.workspace_plan as enum ('starter', 'growth', 'scale');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'paused');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_kind as enum ('income', 'expense', 'transfer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_status as enum ('posted', 'voided');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_type as enum ('asset', 'liability', 'equity', 'income', 'expense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_subtype as enum (
    'cash', 'bank', 'mobile_money', 'receivable', 'payable',
    'revenue', 'operating_expense', 'equity', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.category_kind as enum ('income', 'expense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contact_kind as enum ('customer', 'supplier', 'both');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum (
    'cash', 'mobile_money', 'bank_transfer', 'card', 'cheque', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.entry_channel as enum (
    'web', 'ussd', 'whatsapp', 'ai', 'sync', 'api', 'system'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.actor_type as enum ('user', 'ai', 'system', 'channel');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ai_message_role as enum ('user', 'assistant', 'tool');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_channel as enum ('in_app', 'email', 'sms', 'whatsapp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.usage_kind as enum ('ai_message', 'ussd_session', 'whatsapp_message', 'sync_push');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

-- updated_at helper
create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
