-- =============================================================================
-- KontaFlow · 0034 — platform super administrators
-- Super-admin accounts are deliberately separate from tenant accounts:
--   * membership lives in public.platform_admins, not workspace_members
--   * a platform admin may never own or join a business workspace
--   * their console lives at /admin and is never rendered inside a tenant shell
-- Platform admins can restrict individual accounts. A restriction closes every
-- tenant policy and bypasses every SECURITY DEFINER workflow because the shared
-- membership helpers return false while a restriction is active.
-- =============================================================================

do $$ begin
  create type public.platform_admin_role as enum ('super_admin', 'admin', 'support');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.restriction_severity as enum ('limited', 'suspended');
exception when duplicate_object then null; end $$;

create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role public.platform_admin_role not null default 'admin',
  is_active boolean not null default true,
  created_by uuid references public.platform_admins (user_id) on delete set null,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.platform_admins is
  'Platform operators. These accounts are not tenant users and cannot join a workspace.';

create table if not exists public.account_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  severity public.restriction_severity not null,
  reason text not null check (char_length(trim(reason)) between 5 and 1000),
  expires_at timestamptz,
  created_by uuid references public.platform_admins (user_id) on delete set null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references public.platform_admins (user_id) on delete set null,
  lift_reason text check (lift_reason is null or char_length(lift_reason) <= 500),
  check (expires_at is null or expires_at > created_at)
);
comment on table public.account_restrictions is
  'Platform-imposed access restrictions. Only one restriction may be active per user.';

create unique index if not exists account_restrictions_one_active_idx
  on public.account_restrictions (user_id)
  where lifted_at is null;

create index if not exists account_restrictions_active_idx
  on public.account_restrictions (user_id, created_at desc)
  where lifted_at is null;

create table if not exists public.platform_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(action) between 3 and 120),
  target_type text not null check (char_length(target_type) between 3 and 60),
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);
comment on table public.platform_admin_audit_log is
  'Append-only record of platform administration actions. Never tenant-visible.';

create index if not exists platform_admin_audit_created_idx
  on public.platform_admin_audit_log (created_at desc);

drop trigger if exists platform_admins_set_updated_at on public.platform_admins;
create trigger platform_admins_set_updated_at before update on public.platform_admins
for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

create or replace function app.is_user_restricted(p_user_id uuid, p_at timestamptz default now())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.account_restrictions r
    where r.user_id = p_user_id
      and r.lifted_at is null
      and (r.expires_at is null or r.expires_at > coalesce(p_at, now()))
  );
$$;

create or replace function app.is_current_user_restricted()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app.is_user_restricted(auth.uid());
$$;

create or replace function app.platform_admin_role(p_user_id uuid default auth.uid())
returns public.platform_admin_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.role
  from public.platform_admins a
  where a.user_id = p_user_id
    and a.is_active
    and not app.is_user_restricted(p_user_id)
  limit 1;
$$;

create or replace function app.is_platform_admin_account(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.platform_admins a
    where a.user_id = p_user_id and a.is_active
  );
$$;

create or replace function app.is_platform_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app.platform_admin_role(p_user_id) is not null;
$$;

create or replace function app.is_super_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app.platform_admin_role(p_user_id) = 'super_admin';
$$;

-- Restriction is checked inside the same helpers every tenant policy and every
-- financial RPC already calls. That keeps one choke point instead of hundreds.
create or replace function app.workspace_role(p_workspace_id uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role
  from public.workspace_members m
  where m.workspace_id = p_workspace_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and not app.is_user_restricted(auth.uid())
  limit 1;
$$;

create or replace function app.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and not app.is_user_restricted(auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Separation triggers
-- ---------------------------------------------------------------------------

create or replace function app.reject_tenant_link_for_platform_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if app.is_platform_admin_account(new.user_id) then
    raise exception 'Platform administrator accounts cannot join a business workspace'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists members_reject_platform_admin on public.workspace_members;
create trigger members_reject_platform_admin
before insert or update of user_id on public.workspace_members
for each row execute function app.reject_tenant_link_for_platform_admin();

create or replace function app.reject_platform_admin_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if app.is_platform_admin_account(new.owner_id) then
    raise exception 'Platform administrator accounts cannot own a business workspace'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists workspaces_reject_platform_admin_owner on public.workspaces;
create trigger workspaces_reject_platform_admin_owner
before insert or update of owner_id on public.workspaces
for each row execute function app.reject_platform_admin_workspace_owner();

create or replace function app.reject_platform_admin_with_tenants()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_active and (
    exists (
      select 1 from public.workspace_members m
      where m.user_id = new.user_id and m.status = 'active'
    )
    or exists (
      select 1 from public.workspaces w where w.owner_id = new.user_id
    )
  ) then
    raise exception 'An account that belongs to a business workspace cannot become a platform administrator'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists platform_admins_require_separation on public.platform_admins;
create trigger platform_admins_require_separation
before insert or update of user_id, is_active on public.platform_admins
for each row execute function app.reject_platform_admin_with_tenants();

create or replace function app.guard_last_super_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_remaining integer;
begin
  if tg_op = 'DELETE' then
    if old.role = 'super_admin' and old.is_active then
      select count(*) into v_remaining
      from public.platform_admins
      where user_id <> old.user_id and role = 'super_admin' and is_active;
      if v_remaining = 0 then
        raise exception 'At least one active super administrator must remain'
          using errcode = 'check_violation';
      end if;
    end if;
    return old;
  end if;

  if old.role = 'super_admin' and old.is_active
     and not (new.role = 'super_admin' and new.is_active) then
    select count(*) into v_remaining
    from public.platform_admins
    where user_id <> old.user_id and role = 'super_admin' and is_active;
    if v_remaining = 0 then
      raise exception 'At least one active super administrator must remain'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists platform_admins_keep_super_admin on public.platform_admins;
create trigger platform_admins_keep_super_admin
before update or delete on public.platform_admins
for each row execute function app.guard_last_super_admin();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.platform_admins enable row level security;
alter table public.account_restrictions enable row level security;
alter table public.platform_admin_audit_log enable row level security;

drop policy if exists platform_admins_select_own on public.platform_admins;
create policy platform_admins_select_own on public.platform_admins
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists account_restrictions_select_own on public.account_restrictions;
create policy account_restrictions_select_own on public.account_restrictions
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.platform_admins from public, anon;
revoke all on table public.account_restrictions from public, anon;
revoke all on table public.platform_admin_audit_log from public, anon;
grant select on table public.platform_admins to authenticated;
grant select on table public.account_restrictions to authenticated;
grant all on table public.platform_admins to service_role;
grant all on table public.account_restrictions to service_role;
grant all on table public.platform_admin_audit_log to service_role;

-- A restriction applies immediately to any token already in circulation, not
-- just to future sign-ins. profiles stays readable so the restricted person can
-- see the reason, and the two platform tables are handled by their own policies.
do $$
declare
  table_name text;
begin
  for table_name in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
      and c.relname not in ('profiles', 'platform_admins', 'account_restrictions', 'platform_admin_audit_log')
  loop
    execute format('drop policy if exists account_not_restricted on public.%I', table_name);
    execute format(
      'create policy account_not_restricted on public.%I as restrictive for all to authenticated using (not app.is_current_user_restricted()) with check (not app.is_current_user_restricted())',
      table_name
    );
  end loop;
end $$;

revoke all on function app.is_user_restricted(uuid, timestamptz) from public, anon;
revoke all on function app.is_current_user_restricted() from public, anon;
revoke all on function app.platform_admin_role(uuid) from public, anon;
revoke all on function app.is_platform_admin_account(uuid) from public, anon;
revoke all on function app.is_platform_admin(uuid) from public, anon;
revoke all on function app.is_super_admin(uuid) from public, anon;
grant execute on function app.is_user_restricted(uuid, timestamptz) to authenticated;
grant execute on function app.is_current_user_restricted() to authenticated;
grant execute on function app.platform_admin_role(uuid) to authenticated;
grant execute on function app.is_platform_admin(uuid) to authenticated;
grant execute on function app.is_super_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Audit helper
-- ---------------------------------------------------------------------------

create or replace function app.write_platform_audit(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_details jsonb default '{}'::jsonb,
  p_ip text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.platform_admin_audit_log (
    admin_user_id, action, target_type, target_id, details, ip
  )
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb), p_ip);
end;
$$;

revoke all on function app.write_platform_audit(text, text, uuid, jsonb, text) from public, anon;
grant execute on function app.write_platform_audit(text, text, uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Console read models
-- ---------------------------------------------------------------------------

create or replace function public.platform_admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not app.is_platform_admin() then
    raise exception 'Platform administrator access required' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'new_users_30d', (select count(*) from auth.users where created_at >= now() - interval '30 days'),
    'restricted_users', (
      select count(distinct r.user_id) from public.account_restrictions r
      where r.lifted_at is null and (r.expires_at is null or r.expires_at > now())
    ),
    'suspended_users', (
      select count(distinct r.user_id) from public.account_restrictions r
      where r.lifted_at is null and r.severity = 'suspended'
        and (r.expires_at is null or r.expires_at > now())
    ),
    'workspaces', (select count(*) from public.workspaces),
    'active_subscriptions', (select count(*) from public.subscriptions where status = 'active'),
    'trialing_subscriptions', (select count(*) from public.subscriptions where status = 'trialing'),
    'transactions_30d', (
      select count(*) from public.transactions
      where status = 'posted' and occurred_on >= current_date - 30
    ),
    'volume_30d_by_currency', coalesce((
      select jsonb_object_agg(currency, total)
      from (
        select currency, sum(amount_minor)::text as total
        from public.transactions
        where status = 'posted' and occurred_on >= current_date - 30
        group by currency
      ) v
    ), '{}'::jsonb),
    'plan_distribution', coalesce((
      select jsonb_object_agg(plan, count)
      from (
        select plan::text as plan, count(*) as count
        from public.workspaces
        group by plan
      ) p
    ), '{}'::jsonb),
    'recent_restrictions', coalesce((
      select jsonb_agg(row_to_json(r) order by r.created_at desc)
      from (
        select a.id, a.user_id, u.email, a.severity, a.reason, a.expires_at, a.created_at
        from public.account_restrictions a
        left join auth.users u on u.id = a.user_id
        where a.lifted_at is null and (a.expires_at is null or a.expires_at > now())
        order by a.created_at desc
        limit 6
      ) r
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.platform_admin_list_users(
  p_search text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_result jsonb;
begin
  if not app.is_platform_admin() then
    raise exception 'Platform administrator access required' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(jsonb_agg(row_to_json(r) order by r.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select
      u.id,
      u.email,
      u.created_at,
      u.last_sign_in_at,
      u.email_confirmed_at,
      u.banned_until,
      p.full_name,
      p.phone,
      p.locale,
      coalesce(m.membership_count, 0) as membership_count,
      coalesce(m.workspaces, '[]'::jsonb) as workspaces,
      r.id as restriction_id,
      r.severity,
      r.reason as restriction_reason,
      r.expires_at as restriction_expires_at,
      r.created_at as restricted_at,
      app.is_platform_admin_account(u.id) as is_platform_admin
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join lateral (
      select count(*) as membership_count,
             jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name, 'role', wm.role)
                       order by w.name) as workspaces
      from public.workspace_members wm
      join public.workspaces w on w.id = wm.workspace_id
      where wm.user_id = u.id and wm.status = 'active'
    ) m on true
    left join lateral (
      select a.id, a.severity, a.reason, a.expires_at, a.created_at
      from public.account_restrictions a
      where a.user_id = u.id
        and a.lifted_at is null
        and (a.expires_at is null or a.expires_at > now())
      order by a.created_at desc
      limit 1
    ) r on true
    where v_search is null
       or u.email ilike '%' || v_search || '%'
       or coalesce(p.full_name, '') ilike '%' || v_search || '%'
    order by u.created_at desc
    limit greatest(1, least(200, coalesce(p_limit, 100)))
    offset greatest(0, coalesce(p_offset, 0))
  ) r;

  return v_result;
end;
$$;

create or replace function public.platform_admin_list_workspaces(
  p_search text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_result jsonb;
begin
  if not app.is_platform_admin() then
    raise exception 'Platform administrator access required' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(jsonb_agg(row_to_json(r) order by r.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select
      w.id,
      w.name,
      w.slug,
      w.plan,
      w.currency,
      w.country_code,
      w.timezone,
      w.created_at,
      uo.email as owner_email,
      coalesce(o.full_name, '') as owner_name,
      coalesce(mm.member_count, 0) as member_count,
      coalesce(tx.transaction_count, 0) as transaction_count,
      s.status as subscription_status,
      s.plan as subscription_plan
    from public.workspaces w
    left join auth.users uo on uo.id = w.owner_id
    left join public.profiles o on o.id = w.owner_id
    left join lateral (
      select count(*) as member_count
      from public.workspace_members wm
      where wm.workspace_id = w.id and wm.status = 'active'
    ) mm on true
    left join lateral (
      select count(*) as transaction_count
      from public.transactions t
      where t.workspace_id = w.id and t.status = 'posted'
    ) tx on true
    left join public.subscriptions s on s.workspace_id = w.id
    where v_search is null
       or w.name ilike '%' || v_search || '%'
       or w.slug ilike '%' || v_search || '%'
       or coalesce(uo.email, '') ilike '%' || v_search || '%'
    order by w.created_at desc
    limit greatest(1, least(200, coalesce(p_limit, 100)))
    offset greatest(0, coalesce(p_offset, 0))
  ) r;

  return v_result;
end;
$$;

create or replace function public.platform_admin_list_admins()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not app.is_platform_admin() then
    raise exception 'Platform administrator access required' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(jsonb_agg(row_to_json(r) order by r.created_at), '[]'::jsonb)
  into v_result
  from (
    select a.user_id, a.role, a.is_active, a.created_at, a.last_seen_at,
           u.email, coalesce(p.full_name, '') as full_name
    from public.platform_admins a
    left join auth.users u on u.id = a.user_id
    left join public.profiles p on p.id = a.user_id
    order by a.created_at
  ) r;

  return v_result;
end;
$$;

create or replace function public.platform_admin_list_audit(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not app.is_platform_admin() then
    raise exception 'Platform administrator access required' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(jsonb_agg(row_to_json(r) order by r.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select l.id, l.action, l.target_type, l.target_id, l.details, l.ip, l.created_at,
           u.email as admin_email
    from public.platform_admin_audit_log l
    left join auth.users u on u.id = l.admin_user_id
    order by l.created_at desc
    limit greatest(1, least(500, coalesce(p_limit, 100)))
  ) r;

  return v_result;
end;
$$;

revoke all on function public.platform_admin_overview() from public, anon;
revoke all on function public.platform_admin_list_users(text, integer, integer) from public, anon;
revoke all on function public.platform_admin_list_workspaces(text, integer, integer) from public, anon;
revoke all on function public.platform_admin_list_admins() from public, anon;
revoke all on function public.platform_admin_list_audit(integer) from public, anon;
grant execute on function public.platform_admin_overview() to authenticated, service_role;
grant execute on function public.platform_admin_list_users(text, integer, integer) to authenticated, service_role;
grant execute on function public.platform_admin_list_workspaces(text, integer, integer) to authenticated, service_role;
grant execute on function public.platform_admin_list_admins() to authenticated, service_role;
grant execute on function public.platform_admin_list_audit(integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Console commands
-- ---------------------------------------------------------------------------

create or replace function public.platform_admin_restrict_user(
  p_user_id uuid,
  p_severity public.restriction_severity,
  p_reason text,
  p_expires_at timestamptz default null,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_restriction public.account_restrictions%rowtype;
  v_email text;
begin
  if not app.is_platform_admin() then
    raise exception 'Platform administrator access required' using errcode = 'insufficient_privilege';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot restrict your own account' using errcode = 'check_violation';
  end if;
  if app.is_platform_admin_account(p_user_id) then
    raise exception 'Platform administrators must be deactivated, not restricted'
      using errcode = 'check_violation';
  end if;
  if v_reason is null or char_length(v_reason) < 5 or char_length(v_reason) > 1000 then
    raise exception 'A restriction reason between 5 and 1000 characters is required'
      using errcode = 'check_violation';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Restriction expiry must be in the future' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Account not found' using errcode = 'no_data_found';
  end if;

  update public.account_restrictions
  set lifted_at = now(),
      lifted_by = auth.uid(),
      lift_reason = 'Replaced by a new platform restriction'
  where user_id = p_user_id and lifted_at is null;

  insert into public.account_restrictions (
    user_id, severity, reason, expires_at, created_by
  )
  values (p_user_id, p_severity, v_reason, p_expires_at, auth.uid())
  returning * into v_restriction;

  select email into v_email from auth.users where id = p_user_id;

  perform app.write_platform_audit(
    'user.restricted',
    'user',
    p_user_id,
    jsonb_build_object(
      'severity', p_severity,
      'reason', v_reason,
      'expires_at', p_expires_at,
      'email', v_email,
      'restriction_id', v_restriction.id
    ),
    p_ip
  );

  return jsonb_build_object(
    'id', v_restriction.id,
    'user_id', v_restriction.user_id,
    'severity', v_restriction.severity,
    'reason', v_restriction.reason,
    'expires_at', v_restriction.expires_at,
    'created_at', v_restriction.created_at
  );
end;
$$;

create or replace function public.platform_admin_lift_restriction(
  p_restriction_id uuid,
  p_reason text default null,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_restriction public.account_restrictions%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not app.is_platform_admin() then
    raise exception 'Platform administrator access required' using errcode = 'insufficient_privilege';
  end if;

  select * into v_restriction
  from public.account_restrictions
  where id = p_restriction_id and lifted_at is null
  for update;

  if not found then
    raise exception 'Active restriction not found' using errcode = 'no_data_found';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'Lift reason must be 500 characters or fewer' using errcode = 'check_violation';
  end if;

  update public.account_restrictions
  set lifted_at = now(),
      lifted_by = auth.uid(),
      lift_reason = v_reason
  where id = p_restriction_id;

  perform app.write_platform_audit(
    'user.restriction_lifted',
    'user',
    v_restriction.user_id,
    jsonb_build_object(
      'restriction_id', p_restriction_id,
      'previous_severity', v_restriction.severity,
      'reason', v_reason
    ),
    p_ip
  );

  return jsonb_build_object(
    'id', p_restriction_id,
    'user_id', v_restriction.user_id,
    'previous_severity', v_restriction.severity
  );
end;
$$;

create or replace function public.platform_admin_set_workspace_plan(
  p_workspace_id uuid,
  p_plan public.workspace_plan,
  p_note text default null,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_previous public.workspace_plan;
  v_name text;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not app.is_platform_admin() then
    raise exception 'Platform administrator access required' using errcode = 'insufficient_privilege';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Note must be 500 characters or fewer' using errcode = 'check_violation';
  end if;

  select plan, name into v_previous, v_name
  from public.workspaces where id = p_workspace_id;
  if not found then
    raise exception 'Workspace not found' using errcode = 'no_data_found';
  end if;

  update public.workspaces set plan = p_plan where id = p_workspace_id;
  update public.subscriptions set plan = p_plan where workspace_id = p_workspace_id;

  perform app.write_platform_audit(
    'workspace.plan_changed',
    'workspace',
    p_workspace_id,
    jsonb_build_object(
      'workspace_name', v_name,
      'previous_plan', v_previous,
      'plan', p_plan,
      'note', v_note
    ),
    p_ip
  );

  return jsonb_build_object(
    'workspace_id', p_workspace_id,
    'previous_plan', v_previous,
    'plan', p_plan
  );
end;
$$;

create or replace function public.platform_admin_set_admin_status(
  p_user_id uuid,
  p_is_active boolean,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.platform_admin_role;
begin
  if not app.is_super_admin() then
    raise exception 'Super administrator access required' using errcode = 'insufficient_privilege';
  end if;
  if p_user_id = auth.uid() and not p_is_active then
    raise exception 'You cannot deactivate your own account' using errcode = 'check_violation';
  end if;

  select role into v_role from public.platform_admins where user_id = p_user_id;
  if not found then
    raise exception 'Platform administrator not found' using errcode = 'no_data_found';
  end if;

  update public.platform_admins set is_active = p_is_active where user_id = p_user_id;

  perform app.write_platform_audit(
    case when p_is_active then 'platform_admin.activated' else 'platform_admin.deactivated' end,
    'platform_admin',
    p_user_id,
    jsonb_build_object('role', v_role, 'is_active', p_is_active),
    p_ip
  );

  return jsonb_build_object('user_id', p_user_id, 'is_active', p_is_active);
end;
$$;

revoke all on function public.platform_admin_restrict_user(uuid, public.restriction_severity, text, timestamptz, text) from public, anon;
revoke all on function public.platform_admin_lift_restriction(uuid, text, text) from public, anon;
revoke all on function public.platform_admin_set_workspace_plan(uuid, public.workspace_plan, text, text) from public, anon;
revoke all on function public.platform_admin_set_admin_status(uuid, boolean, text) from public, anon;
grant execute on function public.platform_admin_restrict_user(uuid, public.restriction_severity, text, timestamptz, text) to authenticated, service_role;
grant execute on function public.platform_admin_lift_restriction(uuid, text, text) to authenticated, service_role;
grant execute on function public.platform_admin_set_workspace_plan(uuid, public.workspace_plan, text, text) to authenticated, service_role;
grant execute on function public.platform_admin_set_admin_status(uuid, boolean, text) to authenticated, service_role;
