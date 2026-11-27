-- =============================================================================
-- KontaFlow · 0037 — configurable plans, entitlements and trial lifecycle
-- =============================================================================
-- Plans and feature grants are global configuration owned by the platform
-- console. Tenant code never decides access from a plan code in the browser;
-- it asks the entitlement service, and the database repeats the critical
-- checks for writes, seats and AI usage.
-- =============================================================================

alter type public.usage_kind add value if not exists 'export';

-- ------------------------- plan limits and trial state -----------------------
alter table public.subscription_plans
  add column if not exists transaction_limit integer,
  add column if not exists integration_limit integer,
  add column if not exists export_limit integer;

alter table public.subscription_plans
  drop constraint if exists subscription_plans_ai_message_limit_check;
alter table public.subscription_plans
  add constraint subscription_plans_ai_message_limit_check
  check (ai_message_limit is null or ai_message_limit >= 0);

alter table public.subscription_plans
  drop constraint if exists subscription_plans_transaction_limit_check;
alter table public.subscription_plans
  add constraint subscription_plans_transaction_limit_check
  check (transaction_limit is null or transaction_limit > 0);

alter table public.subscription_plans
  drop constraint if exists subscription_plans_integration_limit_check;
alter table public.subscription_plans
  add constraint subscription_plans_integration_limit_check
  check (integration_limit is null or integration_limit >= 0);

alter table public.subscription_plans
  drop constraint if exists subscription_plans_export_limit_check;
alter table public.subscription_plans
  add constraint subscription_plans_export_limit_check
  check (export_limit is null or export_limit >= 0);

alter table public.subscriptions
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_plan_id uuid references public.subscription_plans (id) on delete restrict;

update public.subscriptions
   set trial_started_at = coalesce(trial_started_at, created_at)
 where status = 'trialing' and trial_started_at is null;

update public.subscriptions s
   set trial_plan_id = p.id
  from public.subscription_plans p
 where s.trial_plan_id is null
   and p.code = 'growth'
   and s.status = 'trialing';

create index if not exists subscriptions_trial_end_idx
  on public.subscriptions (trial_ends_at)
  where status = 'trialing';

-- --------------------------- platform configuration --------------------------
create table if not exists public.platform_settings (
  key text primary key check (key ~ '^[a-z0-9_.-]{2,60}$'),
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
comment on table public.platform_settings is
  'Platform-wide configuration. Service-role only; platform admins change it through audited RPCs.';

insert into public.platform_settings (key, value)
values (
  'billing',
  jsonb_build_object(
    'trial_days', 14,
    'trial_plan_code', 'growth',
    'trial_reminder_days', jsonb_build_array(7, 3, 1),
    'expired_policy', 'read_only'
  )
)
on conflict (key) do nothing;

-- One trial per person, and one per verified phone/email identity. The unique
-- indexes are the abuse control: a second workspace cannot mint a fresh trial.
create table if not exists public.trial_grants (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  first_workspace_id uuid references public.workspaces (id) on delete set null,
  phone_hash text,
  email_hash text,
  trial_started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists trial_grants_phone_idx
  on public.trial_grants (phone_hash)
  where phone_hash is not null;
create unique index if not exists trial_grants_email_idx
  on public.trial_grants (email_hash)
  where email_hash is not null;
comment on table public.trial_grants is
  'Trial abuse control. A person, phone or email can claim at most one trial.';

-- Existing tenants have already consumed their introductory trial. Record the
-- grant so deleting a workspace or signing in on a new device cannot restart it.
insert into public.trial_grants (user_id, first_workspace_id, phone_hash, email_hash, trial_started_at)
select distinct on (w.owner_id)
       w.owner_id,
       w.id,
       case when nullif(p.phone, '') is null then null else md5(p.phone) end,
       case when nullif(lower(u.email), '') is null then null else md5(lower(u.email)) end,
       coalesce(s.trial_started_at, s.created_at)
from public.workspaces w
join public.subscriptions s on s.workspace_id = w.id
left join public.profiles p on p.id = w.owner_id
left join auth.users u on u.id = w.owner_id
order by w.owner_id, s.created_at
on conflict do nothing;

create table if not exists public.trial_reminder_log (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  days_before integer not null check (days_before between 1 and 90),
  sent_at timestamptz not null default now(),
  primary key (workspace_id, days_before)
);

alter table public.platform_settings enable row level security;
alter table public.trial_grants enable row level security;
alter table public.trial_reminder_log enable row level security;

revoke all on public.platform_settings from public, anon, authenticated;
revoke all on public.trial_grants from public, anon, authenticated;
revoke all on public.trial_reminder_log from public, anon, authenticated;
grant select, insert, update, delete on public.platform_settings to service_role;
grant select, insert, update, delete on public.trial_grants to service_role;
grant select, insert, update, delete on public.trial_reminder_log to service_role;

-- ------------------------------ feature catalogue ---------------------------
alter table public.subscription_features
  drop constraint if exists subscription_features_category_check;
alter table public.subscription_features
  add constraint subscription_features_category_check
  check (category in ('general', 'accounting', 'channels', 'ai', 'team', 'reports', 'limits'));

insert into public.subscription_features (code, name, description, category)
values
  ('manual_bookkeeping', 'Manual bookkeeping', 'Record income, expenses and transfers from the web app.', 'accounting'),
  ('offline_bookkeeping', 'Offline bookkeeping', 'Capture entries without a connection and sync later.', 'channels'),
  ('ai_bookkeeping', 'AI bookkeeping', 'Natural-language bookkeeping with the assistant.', 'ai'),
  ('whatsapp_integration', 'WhatsApp integration', 'Record and query the books from WhatsApp.', 'channels'),
  ('ussd_integration', 'USSD integration', 'Record and query the books from any handset.', 'channels'),
  ('advanced_analytics', 'Advanced financial analysis', 'Deeper trends, comparisons and business intelligence.', 'reports'),
  ('advanced_ai_insights', 'Advanced AI insights', 'Advisor briefs, priorities and recommendations.', 'ai'),
  ('weekly_reports', 'Weekly reports', 'Week-level performance reports.', 'reports'),
  ('monthly_reports', 'Monthly reports', 'Monthly performance reports and exports.', 'reports'),
  ('custom_reports', 'Custom reports', 'Quarter and year reporting windows.', 'reports'),
  ('team_members', 'Team members', 'Invite staff with roles and granular permissions.', 'team'),
  ('invoice_management', 'Invoices', 'Issue invoices and track receivables.', 'accounting'),
  ('data_exports', 'Data exports', 'Download CSV copies of the ledger.', 'accounting'),
  ('advanced_exports', 'Advanced exports', 'PDF and accountant-ready export packs.', 'accounting'),
  ('budget_management', 'Budgets and goals', 'Set spending budgets and financial goals.', 'accounting'),
  ('customer_supplier_management', 'Customers and suppliers', 'Keep customer and supplier records.', 'accounting'),
  ('inventory_management', 'Inventory tracking', 'Stock levels and low-stock alerts.', 'accounting'),
  ('priority_support', 'Priority support', 'Faster human support.', 'general'),
  ('multiple_workspaces', 'Multiple workspaces', 'Own or manage more than one business workspace.', 'limits')
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      category = excluded.category;

update public.subscription_plans
   set name = 'Business Pro',
       description = 'For businesses that need advanced management and channels.',
       price_minor = 29900,
       seats_included = 25,
       ai_message_limit = 5000,
       transaction_limit = 50000,
       integration_limit = 10,
       export_limit = null,
       workspace_limit = null,
       sort_order = 3
 where code = 'scale';

update public.subscription_plans
   set name = 'Starter',
       description = 'For small businesses beginning digital bookkeeping.',
       price_minor = 0,
       seats_included = 2,
       ai_message_limit = 50,
       transaction_limit = 500,
       integration_limit = 0,
       export_limit = 20,
       workspace_limit = 1,
       sort_order = 1
 where code = 'starter';

update public.subscription_plans
   set name = 'Growth',
       description = 'For businesses that need deeper financial management.',
       price_minor = 9900,
       seats_included = 8,
       ai_message_limit = 500,
       transaction_limit = 5000,
       integration_limit = 3,
       export_limit = 200,
       workspace_limit = 2,
       sort_order = 2
 where code = 'growth';

-- Replace the new feature grants with the canonical matrix. Old feature codes
-- remain for compatibility with earlier invoice checks and reporting views.
delete from public.plan_features pf
 using public.subscription_features f
 where pf.feature_id = f.id
   and f.code in (
     'manual_bookkeeping', 'offline_bookkeeping', 'ai_bookkeeping',
     'whatsapp_integration', 'ussd_integration', 'advanced_analytics',
     'advanced_ai_insights', 'weekly_reports', 'monthly_reports',
     'custom_reports', 'team_members', 'invoice_management', 'data_exports',
     'advanced_exports', 'budget_management', 'customer_supplier_management',
     'inventory_management', 'priority_support', 'multiple_workspaces'
   );

insert into public.plan_features (plan_id, feature_id, included, limit_value)
select p.id, f.id, true, case f.code when 'team_members' then p.seats_included else null end
from public.subscription_plans p
join public.subscription_features f on f.code in (
  'manual_bookkeeping', 'offline_bookkeeping', 'monthly_reports',
  'team_members', 'data_exports'
)
where p.code = 'starter'
on conflict (plan_id, feature_id) do update
  set included = excluded.included, limit_value = excluded.limit_value;

insert into public.plan_features (plan_id, feature_id, included, limit_value)
select p.id, f.id, true, case f.code when 'team_members' then p.seats_included else null end
from public.subscription_plans p
join public.subscription_features f on f.code in (
  'manual_bookkeeping', 'offline_bookkeeping', 'ai_bookkeeping',
  'whatsapp_integration', 'advanced_analytics', 'weekly_reports',
  'monthly_reports', 'team_members', 'data_exports', 'budget_management',
  'customer_supplier_management', 'multiple_workspaces'
)
where p.code = 'growth'
on conflict (plan_id, feature_id) do update
  set included = excluded.included, limit_value = excluded.limit_value;

insert into public.plan_features (plan_id, feature_id, included, limit_value)
select p.id, f.id, true, case f.code when 'team_members' then p.seats_included else null end
from public.subscription_plans p
join public.subscription_features f on f.code in (
  'manual_bookkeeping', 'offline_bookkeeping', 'ai_bookkeeping',
  'whatsapp_integration', 'ussd_integration', 'advanced_analytics',
  'advanced_ai_insights', 'weekly_reports', 'monthly_reports',
  'custom_reports', 'team_members', 'invoice_management', 'data_exports',
  'advanced_exports', 'budget_management', 'customer_supplier_management',
  'inventory_management', 'priority_support', 'multiple_workspaces'
)
where p.code = 'scale'
on conflict (plan_id, feature_id) do update
  set included = excluded.included, limit_value = excluded.limit_value;

-- --------------------------- entitlement helpers -----------------------------
create or replace function app.effective_plan_id(p_workspace_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when s.status = 'trialing'
      and s.trial_ends_at is not null
      and s.trial_ends_at > now()
      and s.trial_plan_id is not null
      then s.trial_plan_id
    else s.plan_id
  end
  from public.subscriptions s
  where s.workspace_id = p_workspace_id;
$$;

create or replace function app.workspace_read_only(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select s.status in ('past_due', 'canceled', 'paused')
        or (s.status = 'trialing' and s.trial_ends_at is not null and s.trial_ends_at <= now())
    from public.subscriptions s
    where s.workspace_id = p_workspace_id
  ), false);
$$;

create or replace function app.workspace_limit(p_workspace_id uuid, p_key text)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case p_key
    when 'ai_message' then p.ai_message_limit
    when 'transaction' then p.transaction_limit
    when 'seat' then p.seats_included
    when 'integration' then p.integration_limit
    when 'export' then p.export_limit
    when 'workspace' then p.workspace_limit
  end
  from public.subscription_plans p
  where p.id = app.effective_plan_id(p_workspace_id);
$$;

create or replace function app.workspace_feature_limit(p_workspace_id uuid, p_feature_code text)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pf.limit_value
  from public.plan_features pf
  join public.subscription_features f on f.id = pf.feature_id
  where pf.plan_id = app.effective_plan_id(p_workspace_id)
    and f.code = p_feature_code
    and pf.included
  limit 1;
$$;

create or replace function public.has_workspace_feature(
  p_workspace_id uuid,
  p_feature_code text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app.is_workspace_member(p_workspace_id)
    and not app.workspace_read_only(p_workspace_id)
    and exists (
      select 1
      from public.plan_features pf
      join public.subscription_features f on f.id = pf.feature_id
      where pf.plan_id = app.effective_plan_id(p_workspace_id)
        and (f.code = p_feature_code
          or (p_feature_code = 'invoicing' and f.code = 'invoice_management'))
        and pf.included
    );
$$;

revoke all on function app.effective_plan_id(uuid) from public, anon, authenticated;
revoke all on function app.workspace_read_only(uuid) from public, anon, authenticated;
revoke all on function app.workspace_limit(uuid, text) from public, anon, authenticated;
revoke all on function app.workspace_feature_limit(uuid, text) from public, anon, authenticated;
grant execute on function app.effective_plan_id(uuid) to service_role;
grant execute on function app.workspace_read_only(uuid) to service_role;
grant execute on function app.workspace_limit(uuid, text) to service_role;
grant execute on function app.workspace_feature_limit(uuid, text) to service_role;
grant execute on function public.has_workspace_feature(uuid, text) to authenticated, service_role;

create or replace function app.assert_transaction_limit(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer;
  v_used integer;
begin
  if app.workspace_read_only(p_workspace_id) then
    raise exception 'Your trial or subscription is read-only. Choose a plan to continue recording.'
      using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1
    from public.plan_features pf
    join public.subscription_features f on f.id = pf.feature_id
    where pf.plan_id = app.effective_plan_id(p_workspace_id)
      and f.code = 'manual_bookkeeping'
      and pf.included
  ) then
    raise exception 'This plan does not include manual bookkeeping'
      using errcode = 'insufficient_privilege';
  end if;

  v_limit := app.workspace_limit(p_workspace_id, 'transaction');
  if v_limit is null then
    return;
  end if;

  select count(*) into v_used
  from public.transactions
  where workspace_id = p_workspace_id
    and status = 'posted'
    and created_at >= date_trunc('month', now());

  if v_used >= v_limit then
    raise exception 'Monthly transaction limit reached for this plan'
      using errcode = 'check_violation';
  end if;
end;
$$;

drop function if exists app.assert_seat_available(uuid);
create or replace function app.assert_seat_available(
  p_workspace_id uuid,
  p_ignore_invitation uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer;
  v_used integer;
begin
  if not exists (
    select 1
    from public.plan_features pf
    join public.subscription_features f on f.id = pf.feature_id
    where pf.plan_id = app.effective_plan_id(p_workspace_id)
      and f.code = 'team_members'
      and pf.included
  ) then
    raise exception 'This plan does not include team members'
      using errcode = 'insufficient_privilege';
  end if;

  v_limit := app.workspace_limit(p_workspace_id, 'seat');
  if v_limit is null then
    return;
  end if;

  select
    (select count(*) from public.workspace_members
      where workspace_id = p_workspace_id and status in ('active', 'invited'))
    + (select count(*) from public.workspace_invitations
      where workspace_id = p_workspace_id and status = 'pending'
        and (p_ignore_invitation is null or id <> p_ignore_invitation))
  into v_used;

  if v_used >= v_limit then
    raise exception 'Plan member limit reached for this workspace'
      using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function app.enforce_invitation_seat()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform app.assert_seat_available(new.workspace_id);
  return new;
end;
$$;

drop trigger if exists workspace_invitations_enforce_seat on public.workspace_invitations;
create trigger workspace_invitations_enforce_seat
before insert on public.workspace_invitations
for each row execute function app.enforce_invitation_seat();

revoke all on function app.assert_transaction_limit(uuid) from public, anon, authenticated;
revoke all on function app.assert_seat_available(uuid, uuid) from public, anon, authenticated;
grant execute on function app.assert_transaction_limit(uuid) to service_role;
grant execute on function app.assert_seat_available(uuid, uuid) to service_role;

-- --------------------------- trial lifecycle --------------------------------
create or replace function public.expire_trials()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.subscriptions
     set status = 'past_due'
   where status = 'trialing'
     and trial_ends_at is not null
     and trial_ends_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_trials() from public, anon, authenticated;
grant execute on function public.expire_trials() to service_role;

create or replace function public.activate_paid_subscription(
  p_workspace_id uuid,
  p_plan_code text,
  p_provider text,
  p_provider_ref text,
  p_amount_minor bigint,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.subscription_plans;
  v_subscription public.subscriptions;
  v_payment public.payment_transactions;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = 'insufficient_privilege';
  end if;
  if p_provider is null or char_length(trim(p_provider)) < 2 then
    raise exception 'Payment provider is required' using errcode = 'check_violation';
  end if;
  if p_provider_ref is null or char_length(trim(p_provider_ref)) < 3 then
    raise exception 'Payment reference is required' using errcode = 'check_violation';
  end if;

  select * into v_plan
  from public.subscription_plans
  where code = p_plan_code and is_active;
  if not found then
    raise exception 'Plan not found' using errcode = 'no_data_found';
  end if;
  if p_amount_minor < v_plan.price_minor then
    raise exception 'Payment amount is below the plan price' using errcode = 'check_violation';
  end if;
  if upper(p_currency) <> v_plan.currency then
    raise exception 'Payment currency does not match the plan currency' using errcode = 'check_violation';
  end if;

  select * into v_subscription
  from public.subscriptions
  where workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception 'Subscription not found' using errcode = 'no_data_found';
  end if;

  insert into public.payment_transactions (
    workspace_id, subscription_id, provider, provider_ref, amount_minor,
    currency, status, paid_at
  )
  values (
    p_workspace_id, v_subscription.id, trim(p_provider), trim(p_provider_ref),
    p_amount_minor, upper(p_currency), 'succeeded', now()
  )
  on conflict (provider, provider_ref) do nothing
  returning * into v_payment;

  if v_payment.id is null then
    select * into v_payment
    from public.payment_transactions
    where provider = trim(p_provider) and provider_ref = trim(p_provider_ref);
    return jsonb_build_object(
      'workspace_id', p_workspace_id,
      'plan', v_subscription.plan,
      'status', v_subscription.status,
      'duplicate', true
    );
  end if;

  update public.subscriptions
     set plan = v_plan.code::public.workspace_plan,
         plan_id = v_plan.id,
         status = 'active',
         price_minor = v_plan.price_minor,
         currency = v_plan.currency,
         trial_plan_id = null,
         trial_ends_at = null,
         current_period_start = now(),
         current_period_end = now() + interval '30 days',
         canceled_at = null
   where id = v_subscription.id;

  update public.workspaces
     set plan = v_plan.code::public.workspace_plan
   where id = p_workspace_id;

  perform app.write_audit(
    p_workspace_id,
    'subscription.activated',
    'subscription',
    v_subscription.id,
    jsonb_build_object(
      'plan', v_plan.code,
      'provider', trim(p_provider),
      'provider_ref', trim(p_provider_ref),
      'amount_minor', p_amount_minor,
      'currency', upper(p_currency)
    )
  );

  return jsonb_build_object(
    'workspace_id', p_workspace_id,
    'plan', v_plan.code,
    'status', 'active',
    'duplicate', false
  );
end;
$$;

revoke all on function public.activate_paid_subscription(uuid, text, text, text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.activate_paid_subscription(uuid, text, text, text, bigint, text)
  to service_role;

-- --------------------------- plan catalogue APIs ----------------------------
create or replace function public.get_plan_catalogue()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(plan_json order by plan_json ->> 'sortOrder'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'code', p.code,
      'name', p.name,
      'description', p.description,
      'priceMinor', p.price_minor,
      'currency', p.currency,
      'billingInterval', p.billing_interval,
      'seats', p.seats_included,
      'workspaceLimit', p.workspace_limit,
      'aiMessageLimit', p.ai_message_limit,
      'transactionLimit', p.transaction_limit,
      'integrationLimit', p.integration_limit,
      'exportLimit', p.export_limit,
      'sortOrder', p.sort_order,
      'isActive', p.is_active,
      'features', coalesce((
        select jsonb_agg(jsonb_build_object(
          'code', f.code,
          'name', f.name,
          'description', f.description,
          'included', pf.included,
          'limit', pf.limit_value
        ) order by f.code)
        from public.plan_features pf
        join public.subscription_features f on f.id = pf.feature_id
        where pf.plan_id = p.id
      ), '[]'::jsonb)
    ) as plan_json
    from public.subscription_plans p
    where p.is_active
  ) plans;
$$;

revoke all on function public.get_plan_catalogue() from public;
grant execute on function public.get_plan_catalogue() to anon, authenticated, service_role;

create or replace function public.platform_admin_plan_catalogue()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not app.is_platform_admin() then
    raise exception 'Platform administrator access required' using errcode = 'insufficient_privilege';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'code', p.code,
      'name', p.name,
      'description', p.description,
      'priceMinor', p.price_minor,
      'currency', p.currency,
      'billingInterval', p.billing_interval,
      'seats', p.seats_included,
      'workspaceLimit', p.workspace_limit,
      'aiMessageLimit', p.ai_message_limit,
      'transactionLimit', p.transaction_limit,
      'integrationLimit', p.integration_limit,
      'exportLimit', p.export_limit,
      'sortOrder', p.sort_order,
      'isActive', p.is_active,
      'features', coalesce((
        select jsonb_agg(jsonb_build_object(
          'code', f.code,
          'name', f.name,
          'description', f.description,
          'included', pf.included,
          'limit', pf.limit_value
        ) order by f.code)
        from public.plan_features pf
        join public.subscription_features f on f.id = pf.feature_id
        where pf.plan_id = p.id
      ), '[]'::jsonb)
    ) order by p.sort_order), '[]'::jsonb)
    from public.subscription_plans p
  );
end;
$$;

revoke all on function public.platform_admin_plan_catalogue() from public, anon;
grant execute on function public.platform_admin_plan_catalogue() to authenticated, service_role;

create or replace function public.platform_admin_billing_settings()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not app.is_platform_admin() then
    raise exception 'Platform administrator access required' using errcode = 'insufficient_privilege';
  end if;
  return coalesce((select value from public.platform_settings where key = 'billing'), '{}'::jsonb);
end;
$$;

revoke all on function public.platform_admin_billing_settings() from public, anon;
grant execute on function public.platform_admin_billing_settings() to authenticated, service_role;

create or replace function public.platform_admin_save_billing_settings(
  p_trial_days integer,
  p_trial_plan_code text,
  p_reminder_days integer[],
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.platform_admin_role := app.platform_admin_role();
  v_value jsonb;
begin
  if v_role is null or v_role not in ('super_admin', 'admin') then
    raise exception 'Platform administrator access required' using errcode = 'insufficient_privilege';
  end if;
  if p_trial_days < 1 or p_trial_days > 90 then
    raise exception 'Trial days must be between 1 and 90' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.subscription_plans where code = p_trial_plan_code and is_active
  ) then
    raise exception 'Trial plan must be an active plan' using errcode = 'check_violation';
  end if;
  if p_reminder_days is null or array_length(p_reminder_days, 1) = 0 then
    raise exception 'At least one reminder day is required' using errcode = 'check_violation';
  end if;
  if exists (select 1 from unnest(p_reminder_days) d where d < 1 or d > 90) then
    raise exception 'Reminder days must be between 1 and 90' using errcode = 'check_violation';
  end if;

  v_value := jsonb_build_object(
    'trial_days', p_trial_days,
    'trial_plan_code', p_trial_plan_code,
    'trial_reminder_days', to_jsonb(p_reminder_days),
    'expired_policy', 'read_only'
  );

  insert into public.platform_settings (key, value, updated_by, updated_at)
  values ('billing', v_value, auth.uid(), now())
  on conflict (key) do update
    set value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = now();

  perform app.write_platform_audit(
    'billing.settings_changed', 'platform_settings', null,
    jsonb_build_object('trial_days', p_trial_days, 'trial_plan_code', p_trial_plan_code,
      'trial_reminder_days', p_reminder_days),
    p_ip
  );
  return v_value;
end;
$$;

revoke all on function public.platform_admin_save_billing_settings(integer, text, integer[], text)
  from public, anon;
grant execute on function public.platform_admin_save_billing_settings(integer, text, integer[], text)
  to authenticated, service_role;

create or replace function public.platform_admin_save_plan(
  p_plan_code text,
  p_payload jsonb,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.platform_admin_role := app.platform_admin_role();
  v_plan public.subscription_plans;
  v_feature jsonb;
  v_feature_id uuid;
begin
  if v_role is null or v_role not in ('super_admin', 'admin') then
    raise exception 'Platform administrator access required' using errcode = 'insufficient_privilege';
  end if;

  select * into v_plan from public.subscription_plans where code = p_plan_code;
  if not found then
    raise exception 'Plan not found' using errcode = 'no_data_found';
  end if;
  if (p_payload ->> 'name') is null or char_length(trim(p_payload ->> 'name')) < 2 then
    raise exception 'Plan name is required' using errcode = 'check_violation';
  end if;
  if (p_payload ->> 'priceMinor')::bigint < 0 then
    raise exception 'Price cannot be negative' using errcode = 'check_violation';
  end if;

  update public.subscription_plans
     set name = trim(p_payload ->> 'name'),
         description = coalesce(p_payload ->> 'description', description),
         price_minor = coalesce((p_payload ->> 'priceMinor')::bigint, price_minor),
         currency = coalesce(upper(p_payload ->> 'currency'), currency),
         billing_interval = coalesce(p_payload ->> 'billingInterval', billing_interval),
         seats_included = coalesce((p_payload ->> 'seats')::integer, seats_included),
         workspace_limit = nullif(p_payload ->> 'workspaceLimit', '')::integer,
         ai_message_limit = nullif(p_payload ->> 'aiMessageLimit', '')::integer,
         transaction_limit = nullif(p_payload ->> 'transactionLimit', '')::integer,
         integration_limit = nullif(p_payload ->> 'integrationLimit', '')::integer,
         export_limit = nullif(p_payload ->> 'exportLimit', '')::integer,
         is_active = coalesce((p_payload ->> 'isActive')::boolean, is_active),
         sort_order = coalesce((p_payload ->> 'sortOrder')::smallint, sort_order),
         updated_at = now()
   where id = v_plan.id;

  if jsonb_typeof(p_payload -> 'features') = 'array' then
    for v_feature in select * from jsonb_array_elements(p_payload -> 'features')
    loop
      select id into v_feature_id
      from public.subscription_features
      where code = v_feature ->> 'code';
      if v_feature_id is null then
        raise exception 'Unknown feature %', v_feature ->> 'code' using errcode = 'check_violation';
      end if;
      insert into public.plan_features (plan_id, feature_id, included, limit_value)
      values (
        v_plan.id, v_feature_id,
        coalesce((v_feature ->> 'included')::boolean, false),
        nullif(v_feature ->> 'limit', '')::integer
      )
      on conflict (plan_id, feature_id) do update
        set included = excluded.included,
            limit_value = excluded.limit_value;
    end loop;
  end if;

  perform app.write_platform_audit(
    'billing.plan_changed', 'subscription_plan', v_plan.id,
    jsonb_build_object('code', p_plan_code, 'payload', p_payload),
    p_ip
  );

  return jsonb_build_object('code', p_plan_code, 'saved', true);
end;
$$;

revoke all on function public.platform_admin_save_plan(text, jsonb, text) from public, anon;
grant execute on function public.platform_admin_save_plan(text, jsonb, text)
  to authenticated, service_role;

-- ------------------------- trial-aware workspace creation --------------------
create or replace function public.create_workspace(
  p_name text,
  p_currency text default 'XAF',
  p_country text default 'CM',
  p_timezone text default 'Africa/Douala',
  p_legal_name text default null,
  p_locale text default 'en'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_slug text;
  v_workspace_id uuid;
  v_suffix text;
  v_trial_days integer := 14;
  v_trial_plan_code text := 'growth';
  v_trial_plan_id uuid;
  v_trial_eligible boolean := false;
  v_existing_workspaces integer := 0;
  v_latest_workspace_id uuid;
  v_workspace_limit integer;
  v_profile public.profiles%rowtype;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_phone_hash text;
  v_email_hash text;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'Business name must be between 1 and 120 characters'
      using errcode = 'check_violation';
  end if;
  if p_currency not in ('XAF','XOF','USD','EUR','GBP','NGN','KES','GHS') then
    raise exception 'Unsupported currency %', p_currency using errcode = 'check_violation';
  end if;
  if p_locale not in ('en','fr','pcm') then
    raise exception 'Unsupported locale' using errcode = 'check_violation';
  end if;
  if p_country is null or char_length(p_country) <> 2 then
    raise exception 'Country must be an ISO 3166-1 alpha-2 code' using errcode = 'check_violation';
  end if;

  if not exists (select 1 from public.profiles where id = v_uid) then
    insert into public.profiles (id, full_name)
    values (v_uid, coalesce((auth.jwt() ->> 'email'), ''))
    on conflict (id) do nothing;
  end if;
  select * into v_profile from public.profiles where id = v_uid;

  select coalesce((value ->> 'trial_days')::integer, 14),
         coalesce(value ->> 'trial_plan_code', 'growth')
    into v_trial_days, v_trial_plan_code
    from public.platform_settings
   where key = 'billing';
  v_trial_days := least(greatest(coalesce(v_trial_days, 14), 1), 90);

  select id into v_trial_plan_id
  from public.subscription_plans
  where code = v_trial_plan_code and is_active;
  if v_trial_plan_id is null then
    select id into v_trial_plan_id
    from public.subscription_plans
    where code = 'growth' and is_active;
  end if;

  v_phone_hash := case when nullif(v_profile.phone, '') is null then null else md5(v_profile.phone) end;
  v_email_hash := case when v_email = '' then null else md5(v_email) end;

  insert into public.trial_grants (user_id, phone_hash, email_hash, trial_started_at)
  values (v_uid, v_phone_hash, v_email_hash, now())
  on conflict do nothing;
  v_trial_eligible := found;

  select count(*), (array_agg(id order by created_at))[1]
    into v_existing_workspaces, v_latest_workspace_id
    from public.workspaces
   where owner_id = v_uid;

  if v_existing_workspaces > 0 then
    if not exists (
      select 1
      from public.plan_features pf
      join public.subscription_features f on f.id = pf.feature_id
      where pf.plan_id = app.effective_plan_id(v_latest_workspace_id)
        and f.code = 'multiple_workspaces'
        and pf.included
    ) then
      raise exception 'This plan does not include multiple workspaces'
        using errcode = 'insufficient_privilege';
    end if;

    v_workspace_limit := app.workspace_limit(v_latest_workspace_id, 'workspace');
    if v_workspace_limit is not null and v_existing_workspaces >= v_workspace_limit then
      raise exception 'Plan workspace limit reached'
        using errcode = 'check_violation';
    end if;
  end if;

  v_suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then
    v_slug := 'business';
  end if;
  v_slug := left(v_slug, 40) || '-' || v_suffix;

  insert into public.workspaces (
    name, legal_name, slug, owner_id, currency, timezone, locale, country_code
  )
  values (
    v_name, nullif(trim(p_legal_name), ''), v_slug, v_uid, p_currency, p_timezone, p_locale, upper(p_country)
  )
  returning id into v_workspace_id;

  update public.trial_grants
     set first_workspace_id = coalesce(first_workspace_id, v_workspace_id)
   where user_id = v_uid and v_trial_eligible;

  insert into public.workspace_members (workspace_id, user_id, role, status, joined_at)
  values (v_workspace_id, v_uid, 'owner', 'active', now());

  insert into public.accounts (workspace_id, name, type, subtype, currency, is_system)
  values
    (v_workspace_id, 'Cash', 'asset', 'cash', p_currency, true),
    (v_workspace_id, 'Mobile money', 'asset', 'mobile_money', p_currency, true),
    (v_workspace_id, 'Bank', 'asset', 'bank', p_currency, true),
    (v_workspace_id, 'Accounts receivable', 'asset', 'receivable', p_currency, true),
    (v_workspace_id, 'Accounts payable', 'liability', 'payable', p_currency, true),
    (v_workspace_id, 'Owner equity', 'equity', 'equity', p_currency, true),
    (v_workspace_id, 'Sales revenue', 'income', 'revenue', p_currency, true),
    (v_workspace_id, 'Operating expenses', 'expense', 'operating_expense', p_currency, true);

  insert into public.categories (workspace_id, name, kind, color, is_system, translations)
  values
    (v_workspace_id, 'Sales', 'income', '#12B981', true, '{"fr":"Ventes","pcm":"Sale"}'::jsonb),
    (v_workspace_id, 'Services', 'income', '#0EA5E9', true, '{"fr":"Services","pcm":"Service"}'::jsonb),
    (v_workspace_id, 'Other income', 'income', '#8B5CF6', true, '{"fr":"Autres produits","pcm":"Other moni wey kam in"}'::jsonb),
    (v_workspace_id, 'Stock purchases', 'expense', '#F97316', true, '{"fr":"Achats de marchandises","pcm":"Buy stock"}'::jsonb),
    (v_workspace_id, 'Supplies', 'expense', '#EF4444', true, '{"fr":"Fournitures","pcm":"Supplies"}'::jsonb),
    (v_workspace_id, 'Transport', 'expense', '#F59E0B', true, '{"fr":"Transport","pcm":"Transport"}'::jsonb),
    (v_workspace_id, 'Rent', 'expense', '#6366F1', true, '{"fr":"Loyer","pcm":"Rent"}'::jsonb),
    (v_workspace_id, 'Salaries', 'expense', '#14B8A6', true, '{"fr":"Salaires","pcm":"Salary"}'::jsonb),
    (v_workspace_id, 'Utilities', 'expense', '#06B6D4', true, '{"fr":"Électricité et eau","pcm":"Light and water"}'::jsonb),
    (v_workspace_id, 'Fuel', 'expense', '#DC2626', true, '{"fr":"Carburant","pcm":"Fuel"}'::jsonb),
    (v_workspace_id, 'Marketing', 'expense', '#DB2777', true, '{"fr":"Marketing","pcm":"Marketing"}'::jsonb),
    (v_workspace_id, 'Taxes & fees', 'expense', '#78716C', true, '{"fr":"Impôts et taxes","pcm":"Tax"}'::jsonb),
    (v_workspace_id, 'Other expenses', 'expense', '#64748B', true, '{"fr":"Autres charges","pcm":"Other expense"}'::jsonb);

  insert into public.subscriptions (
    workspace_id, plan, plan_id, status, price_minor, currency,
    trial_started_at, trial_ends_at, trial_plan_id,
    current_period_start, current_period_end
  )
  values (
    v_workspace_id, 'starter',
    (select id from public.subscription_plans where code = 'starter'),
    case when v_trial_eligible then 'trialing' else 'active' end::public.subscription_status,
    0, p_currency,
    case when v_trial_eligible then now() else null end,
    case when v_trial_eligible then now() + make_interval(days => v_trial_days) else null end,
    case when v_trial_eligible then v_trial_plan_id else null end,
    now(),
    case when v_trial_eligible then now() + make_interval(days => v_trial_days) else now() + interval '30 days' end
  );

  update public.profiles
     set default_workspace_id = coalesce(default_workspace_id, v_workspace_id)
   where id = v_uid;

  perform app.write_audit(
    v_workspace_id, 'workspace.created', 'workspace', v_workspace_id,
    jsonb_build_object(
      'name', v_name, 'currency', p_currency, 'country', upper(p_country),
      'trial', v_trial_eligible, 'trial_days', v_trial_days
    )
  );

  return jsonb_build_object(
    'id', v_workspace_id,
    'name', v_name,
    'slug', v_slug,
    'currency', p_currency,
    'timezone', p_timezone,
    'locale', p_locale,
    'trial', v_trial_eligible,
    'trial_days', v_trial_days
  );
end;
$$;

-- ---------------------- seat and transaction enforcement ---------------------
create or replace function public.accept_invitation(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.email();
  v_invitation public.workspace_invitations;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;

  select * into v_invitation
  from public.workspace_invitations
  where token = p_token and status = 'pending'
  for update;

  if not found then
    raise exception 'Invitation not found or already used' using errcode = 'no_data_found';
  end if;
  if v_invitation.expires_at < now() then
    update public.workspace_invitations set status = 'expired' where id = v_invitation.id;
    raise exception 'Invitation has expired' using errcode = 'check_violation';
  end if;
  if lower(v_invitation.email) <> lower(coalesce(v_email, '')) then
    raise exception 'This invitation belongs to a different email address'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.workspace_members
    where workspace_id = v_invitation.workspace_id and user_id = v_uid and status = 'active'
  ) then
    perform app.assert_seat_available(v_invitation.workspace_id, v_invitation.id);
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, status, invited_by, joined_at)
  values (v_invitation.workspace_id, v_uid, v_invitation.role, 'active', v_invitation.invited_by, now())
  on conflict (workspace_id, user_id) do update
    set role = excluded.role, status = 'active', joined_at = coalesce(public.workspace_members.joined_at, now());

  update public.workspace_invitations
     set status = 'accepted', accepted_at = now(), accepted_by = v_uid
   where id = v_invitation.id;

  update public.profiles
     set default_workspace_id = coalesce(default_workspace_id, v_invitation.workspace_id)
   where id = v_uid;

  perform app.write_audit(
    v_invitation.workspace_id, 'member.joined', 'workspace_member', v_uid,
    jsonb_build_object('role', v_invitation.role), null, 'user', v_uid
  );

  return jsonb_build_object('workspace_id', v_invitation.workspace_id, 'role', v_invitation.role);
end;
$$;

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
  v_limit integer;
begin
  if not app.is_workspace_member(p_workspace_id) then
    raise exception 'Not a member of this workspace' using errcode = 'insufficient_privilege';
  end if;
  if app.workspace_read_only(p_workspace_id) then
    return false;
  end if;

  v_limit := case
    when p_kind = 'ai_message' then app.workspace_limit(p_workspace_id, 'ai_message')
    when p_kind = 'export' then app.workspace_limit(p_workspace_id, 'export')
    else p_limit
  end;

  select coalesce(sum(quantity), 0) into v_used
  from public.usage_events
  where workspace_id = p_workspace_id
    and kind = p_kind
    and created_at >= date_trunc('month', now());

  if v_limit is not null and (v_limit <= 0 or v_used >= v_limit) then
    return false;
  end if;

  insert into public.usage_events (workspace_id, user_id, kind, quantity)
  values (p_workspace_id, auth.uid(), p_kind, 1);

  return true;
end;
$$;

-- Enforce the monthly transaction entitlement at the table boundary. The
-- trigger runs on a real insert only, so an idempotent replay returns the
-- original row before consuming another slot. It also covers service-role
-- channel writes, which have no auth.uid() but must obey the same plan.
create or replace function app.enforce_transaction_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform app.assert_transaction_limit(new.workspace_id);
  return new;
end;
$$;

drop trigger if exists transactions_enforce_entitlement on public.transactions;
create trigger transactions_enforce_entitlement
before insert on public.transactions
for each row execute function app.enforce_transaction_entitlement();

-- Invoice checks keep the legacy code while new plans use invoice_management.
create or replace function public.has_invoice_feature(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_workspace_feature(p_workspace_id, 'invoice_management')
      or public.has_workspace_feature(p_workspace_id, 'invoicing');
$$;

revoke all on function public.has_invoice_feature(uuid) from public, anon;
grant execute on function public.has_invoice_feature(uuid) to authenticated, service_role;
