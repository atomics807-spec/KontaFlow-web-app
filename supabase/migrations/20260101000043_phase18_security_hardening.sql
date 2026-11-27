-- =============================================================================
-- KontaFlow · 0043 — Phase 18 security hardening
-- =============================================================================
-- Adds the durable security-event trail, account-deletion request workflow and
-- cross-instance rate-limit buckets. Tenant tables remain RLS-protected; these
-- operational tables are service-role only except for the narrowly scoped
-- self-service reads and the SECURITY DEFINER request/cancel RPCs.
-- =============================================================================

-- ---------------------------- security events -------------------------------
create table if not exists public.security_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  workspace_id uuid references public.workspaces (id) on delete set null,
  event_type text not null check (char_length(event_type) between 3 and 80),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  ip inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.security_events is
  'Append-only security and privacy events. No tenant member may insert directly.';
create index if not exists security_events_created_idx
  on public.security_events (created_at desc);
create index if not exists security_events_user_idx
  on public.security_events (user_id, created_at desc);
create index if not exists security_events_type_idx
  on public.security_events (event_type, created_at desc);

alter table public.security_events enable row level security;

drop policy if exists security_events_select_platform on public.security_events;
create policy security_events_select_platform on public.security_events
  for select to authenticated
  using (app.is_platform_admin());

revoke all on table public.security_events from public, anon, authenticated;
grant select on table public.security_events to authenticated;
grant all on table public.security_events to service_role;

-- ---------------------- account deletion requests ---------------------------
create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'in_review', 'approved', 'completed', 'rejected', 'cancelled')),
  reason text not null default '' check (char_length(reason) <= 2000),
  decision_note text check (decision_note is null or char_length(decision_note) <= 2000),
  requested_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  completed_at timestamptz,
  retention_hold_until date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.account_deletion_requests is
  'Privacy workflow for access, export and erasure requests. Financial records may be retained under an explicit hold.';
create unique index if not exists account_deletion_requests_active_key
  on public.account_deletion_requests (user_id)
  where status in ('pending', 'in_review', 'approved');
create index if not exists account_deletion_requests_status_idx
  on public.account_deletion_requests (status, requested_at desc);

drop trigger if exists account_deletion_requests_set_updated_at
  on public.account_deletion_requests;
create trigger account_deletion_requests_set_updated_at
  before update on public.account_deletion_requests
  for each row execute function app.set_updated_at();

alter table public.account_deletion_requests enable row level security;

drop policy if exists account_deletion_requests_select_own on public.account_deletion_requests;
create policy account_deletion_requests_select_own on public.account_deletion_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or app.is_platform_admin());

revoke all on table public.account_deletion_requests from public, anon, authenticated;
grant select on table public.account_deletion_requests to authenticated;
grant all on table public.account_deletion_requests to service_role;

-- ------------------------- durable rate-limit buckets ------------------------
create table if not exists public.security_rate_limits (
  bucket_key text primary key check (char_length(bucket_key) between 8 and 200),
  count integer not null default 0 check (count >= 0),
  window_start timestamptz not null default now()
);
comment on table public.security_rate_limits is
  'Service-role-only fixed-window counters for multi-instance abuse protection.';
create index if not exists security_rate_limits_window_idx
  on public.security_rate_limits (window_start);

alter table public.security_rate_limits enable row level security;
revoke all on table public.security_rate_limits from public, anon, authenticated;
grant all on table public.security_rate_limits to service_role;

create or replace function public.consume_security_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if p_key is null or char_length(p_key) < 8 or char_length(p_key) > 200 then
    raise exception 'Invalid rate-limit key' using errcode = 'check_violation';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100000 then
    raise exception 'Invalid rate-limit limit' using errcode = 'check_violation';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit window' using errcode = 'check_violation';
  end if;

  insert into public.security_rate_limits as r (bucket_key, count, window_start)
  values (p_key, 1, now())
  on conflict (bucket_key) do update
    set count = case
          when r.window_start <= now() - make_interval(secs => p_window_seconds) then 1
          else r.count + 1
        end,
        window_start = case
          when r.window_start <= now() - make_interval(secs => p_window_seconds) then now()
          else r.window_start
        end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_security_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_security_rate_limit(text, integer, integer)
  to service_role;

-- --------------------------- privacy request RPCs ---------------------------
create or replace function public.request_account_deletion(
  p_reason text default null,
  p_workspace_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_reason text := left(trim(coalesce(p_reason, '')), 2000);
  v_request public.account_deletion_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;
  if p_workspace_id is not null and not app.is_workspace_member(p_workspace_id) then
    raise exception 'Workspace access denied' using errcode = 'insufficient_privilege';
  end if;

  select * into v_request
  from public.account_deletion_requests
  where user_id = v_uid and status in ('pending', 'in_review', 'approved')
  order by requested_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'id', v_request.id,
      'status', v_request.status,
      'requested_at', v_request.requested_at,
      'existing', true
    );
  end if;

  insert into public.account_deletion_requests (user_id, workspace_id, reason)
  values (v_uid, p_workspace_id, v_reason)
  returning * into v_request;

  insert into public.security_events (user_id, workspace_id, event_type, severity, metadata)
  values (
    v_uid,
    p_workspace_id,
    'privacy.deletion_requested',
    'warning',
    jsonb_build_object('request_id', v_request.id, 'source', 'web')
  );

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'requested_at', v_request.requested_at,
    'existing', false
  );
end;
$$;

revoke all on function public.request_account_deletion(text, uuid) from public, anon;
grant execute on function public.request_account_deletion(text, uuid) to authenticated;

create or replace function public.cancel_account_deletion(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.account_deletion_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = 'insufficient_privilege';
  end if;

  update public.account_deletion_requests
  set status = 'cancelled',
      decision_note = 'Cancelled by the account holder',
      updated_at = now()
  where id = p_request_id
    and user_id = v_uid
    and status in ('pending', 'in_review')
  returning * into v_request;

  if not found then
    raise exception 'Request not found or no longer cancellable'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.security_events (user_id, workspace_id, event_type, severity, metadata)
  values (
    v_uid,
    v_request.workspace_id,
    'privacy.deletion_cancelled',
    'info',
    jsonb_build_object('request_id', v_request.id)
  );

  return jsonb_build_object('id', v_request.id, 'status', v_request.status);
end;
$$;

revoke all on function public.cancel_account_deletion(uuid) from public, anon;
grant execute on function public.cancel_account_deletion(uuid) to authenticated;

-- --------------------------- storage hardening ------------------------------
-- SVG is an active document format. Workspace logos must be raster images so a
-- private object cannot become a same-site script if a signed URL is opened.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    update storage.buckets
    set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
    where id = 'kontaflow-workspace-logos';
  end if;
end $$;

-- The audit writer is an internal helper. RPCs run as the definer and keep
-- working; browser roles must not call it directly.
revoke all on function app.write_audit(
  uuid, text, text, uuid, jsonb, jsonb, public.actor_type, uuid
) from public, anon, authenticated;
grant execute on function app.write_audit(
  uuid, text, text, uuid, jsonb, jsonb, public.actor_type, uuid
) to service_role;
