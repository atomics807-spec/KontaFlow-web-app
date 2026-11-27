-- =============================================================================
-- KontaFlow · 0041 — report preferences, monthly deliveries and recipient audit
-- =============================================================================
-- Scheduled reports are per workspace member. Each member chooses a language,
-- a cadence and the channels they want. Delivery rows are idempotent per
-- recipient and channel, so a failed email never blocks an in-app notice.
-- =============================================================================

-- ------------------------- monthly report entitlement ------------------------
insert into public.subscription_features (code, name, description, category)
values
  ('monthly_reports', 'Monthly reports', 'Automated monthly business reviews.', 'reports')
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      category = excluded.category;

insert into public.plan_features (plan_id, feature_id, included, limit_value)
select p.id, f.id, true, null
from public.subscription_plans p
join public.subscription_features f on f.code = 'monthly_reports'
where p.code in ('starter', 'growth', 'scale')
on conflict (plan_id, feature_id) do update
  set included = true,
      limit_value = null;

-- ------------------------- report preferences --------------------------------
create table if not exists public.report_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  language text not null default 'en' check (language in ('en', 'fr', 'pcm')),
  frequency text not null default 'daily'
    check (frequency in ('daily', 'weekly', 'monthly', 'off')),
  email_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

comment on table public.report_preferences is
  'Per-member scheduled report settings. daily includes weekly and monthly reports; weekly includes monthly; monthly sends monthly only.';
comment on column public.report_preferences.frequency is
  'daily = daily + weekly + monthly, weekly = weekly + monthly, monthly = monthly only, off = none.';
comment on column public.report_preferences.language is
  'Language used for the member''s report email, in-app notice and WhatsApp message.';

create index if not exists report_preferences_workspace_idx
  on public.report_preferences (workspace_id);

drop trigger if exists report_preferences_set_updated_at on public.report_preferences;
create trigger report_preferences_set_updated_at before update on public.report_preferences
for each row execute function app.set_updated_at();

alter table public.report_preferences enable row level security;

drop policy if exists report_preferences_own on public.report_preferences;
create policy report_preferences_own on public.report_preferences
  for all to authenticated
  using (user_id = (select auth.uid()) and app.is_workspace_member(workspace_id))
  with check (user_id = (select auth.uid()) and app.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.report_preferences to authenticated;
grant all on table public.report_preferences to service_role;

-- Seed existing active members. Owners get email plus in-app by default;
-- teammates start with in-app only and can opt into email or WhatsApp.
insert into public.report_preferences (
  workspace_id, user_id, language, frequency, email_enabled, in_app_enabled, whatsapp_enabled
)
select
  wm.workspace_id,
  wm.user_id,
  case when p.locale in ('fr', 'pcm') then p.locale else coalesce(w.locale, 'en') end,
  'daily',
  wm.role = 'owner',
  true,
  false
from public.workspace_members wm
join public.workspaces w on w.id = wm.workspace_id
left join public.profiles p on p.id = wm.user_id
where wm.status = 'active'
on conflict (workspace_id, user_id) do nothing;

create or replace function app.seed_report_preferences_for_member()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_locale text;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select case when p.locale in ('fr', 'pcm') then p.locale else coalesce(w.locale, 'en') end
    into v_locale
  from public.workspaces w
  left join public.profiles p on p.id = new.user_id
  where w.id = new.workspace_id;

  insert into public.report_preferences (
    workspace_id, user_id, language, frequency, email_enabled, in_app_enabled, whatsapp_enabled
  )
  values (
    new.workspace_id,
    new.user_id,
    coalesce(v_locale, 'en'),
    'daily',
    new.role = 'owner',
    true,
    false
  )
  on conflict (workspace_id, user_id) do nothing;

  return new;
end;
$$;

revoke all on function app.seed_report_preferences_for_member() from public, anon, authenticated;

drop trigger if exists workspace_members_seed_report_preferences on public.workspace_members;
create trigger workspace_members_seed_report_preferences
after insert or update of status on public.workspace_members
for each row execute function app.seed_report_preferences_for_member();

-- ------------------------- delivery audit expansion -------------------------
alter table public.report_deliveries
  add column if not exists user_id uuid references public.profiles (id) on delete cascade,
  add column if not exists channel text not null default 'email'
    check (channel in ('email', 'in_app', 'whatsapp')),
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists provider_message_id text,
  add column if not exists last_attempt_at timestamptz;

update public.report_deliveries d
   set user_id = w.owner_id
  from public.workspaces w
 where w.id = d.workspace_id
   and d.user_id is null;

alter table public.report_deliveries
  alter column user_id set not null;

alter table public.report_deliveries
  drop constraint if exists report_deliveries_workspace_id_kind_report_date_key;
alter table public.report_deliveries
  drop constraint if exists report_deliveries_workspace_recipient_kind_date_channel_key;
alter table public.report_deliveries
  add constraint report_deliveries_workspace_recipient_kind_date_channel_key
  unique (workspace_id, user_id, kind, report_date, channel);

alter table public.report_deliveries
  drop constraint if exists report_deliveries_kind_check;
alter table public.report_deliveries
  add constraint report_deliveries_kind_check
  check (kind in ('daily', 'weekly', 'monthly'));

create index if not exists report_deliveries_retry_idx
  on public.report_deliveries (status, report_date, attempts);

drop policy if exists report_deliveries_select_own_or_manager on public.report_deliveries;
create policy report_deliveries_select_own_or_manager on public.report_deliveries
  for select to authenticated
  using (user_id = (select auth.uid()) or app.can_manage_workspace(workspace_id));

grant select on public.report_deliveries to authenticated;

comment on table public.report_deliveries is
  'Idempotency and audit trail for scheduled reports, per recipient and delivery channel.';

-- In-app report notices must not duplicate if a worker crashes after inserting
-- the notice but before marking the delivery row sent.
create unique index if not exists notifications_report_delivery_key
  on public.notifications (
    workspace_id,
    user_id,
    (data ->> 'report_kind'),
    (data ->> 'report_date')
  )
  where channel = 'in_app'
    and data ? 'report_kind'
    and data ? 'report_date';
