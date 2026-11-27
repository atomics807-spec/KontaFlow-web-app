-- =============================================================================
-- KontaFlow · 0040 — starter trial, scheduled reports and delivery audit
-- =============================================================================
-- Starter is a 14-day trial plan. Every active workspace receives daily closes
-- at 21:00 in its timezone and a weekly report on Sunday evenings; expired
-- trials and unpaid subscriptions become read-only and stop receiving them.
-- =============================================================================

-- --------------------------- scheduled report feature ------------------------
insert into public.subscription_features (code, name, description, category)
values
  ('daily_reports', 'Daily reports', 'Automated daily book-close emails.', 'reports')
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      category = excluded.category;

-- ------------------------------ starter trial -------------------------------
update public.subscription_plans
   set description = 'A 14-day starter trial for small businesses beginning digital bookkeeping.'
 where code = 'starter';

-- Every plan gets both scheduled report cadences. Starter keeps its existing
-- monthly reports and CSV exports during the 14-day trial.
insert into public.plan_features (plan_id, feature_id, included, limit_value)
select p.id, f.id, true, null
from public.subscription_plans p
join public.subscription_features f on f.code in ('daily_reports', 'weekly_reports')
where p.code in ('starter', 'growth', 'scale')
on conflict (plan_id, feature_id) do update
  set included = true,
      limit_value = null;

-- New signups start on the Starter trial for 14 days. Growth and Scale remain
-- paid upgrades; existing trials are left untouched.
update public.platform_settings
   set value = jsonb_set(
     jsonb_set(value, '{trial_days}', '14'::jsonb, true),
     '{trial_plan_code}', '"starter"'::jsonb, true
   )
 where key = 'billing';

insert into public.platform_settings (key, value)
select 'billing', jsonb_build_object(
  'trial_days', 14,
  'trial_plan_code', 'starter',
  'trial_reminder_days', jsonb_build_array(7, 3, 1),
  'expired_policy', 'read_only'
)
where not exists (select 1 from public.platform_settings where key = 'billing');

-- The cron runs as service_role without a workspace member JWT. Allow that
-- role to use the same entitlement check; tenant users keep the membership
-- requirement.
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
  select (auth.role() = 'service_role' or app.is_workspace_member(p_workspace_id))
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

revoke all on function public.has_workspace_feature(uuid, text) from public, anon;
grant execute on function public.has_workspace_feature(uuid, text)
  to authenticated, service_role;

-- --------------------------- report delivery audit ---------------------------
create table if not exists public.report_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('daily', 'weekly')),
  report_date date not null,
  status text not null default 'sending'
    check (status in ('sending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 1 check (attempts > 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, kind, report_date)
);

create index if not exists report_deliveries_status_idx
  on public.report_deliveries (status, created_at);

comment on table public.report_deliveries is
  'Idempotency and audit trail for scheduled daily and weekly report emails.';

alter table public.report_deliveries enable row level security;
revoke all on public.report_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.report_deliveries to service_role;
