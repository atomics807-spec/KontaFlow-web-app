-- =============================================================================
-- KontaFlow · 0010 — channel ingestion (USSD, WhatsApp, cron)
-- =============================================================================
-- Webhooks and scheduled jobs arrive without a user session, so they run on
-- the service role. These wrappers are the only service-role entry points into
-- the ledger: the actor is supplied explicitly, re-verified against
-- workspace_members, and the request JWT claims are set locally so the
-- existing user-facing RPCs (record_transaction, consume_quota,
-- get_dashboard_summary) apply their normal validation and audit trail.
-- =============================================================================

create or replace function app.assume_actor(p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = p_actor_id;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_actor_id,
      'role', 'authenticated',
      'email', coalesce(v_email, '')
    )::text,
    true
  );
  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);
end;
$$;

revoke all on function app.assume_actor(uuid) from public, anon, authenticated;

create or replace function public.record_channel_transaction(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_channel public.entry_channel,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.workspace_role;
begin
  if p_workspace_id is null or p_actor_id is null then
    raise exception 'Workspace and actor are required' using errcode = 'invalid_parameter_value';
  end if;
  if p_channel not in ('ussd', 'whatsapp', 'ai', 'sync', 'system') then
    raise exception 'Unsupported channel' using errcode = 'invalid_parameter_value';
  end if;

  select role into v_role
  from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = p_actor_id
    and status = 'active';

  if v_role is null then
    raise exception 'Actor is not an active member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  perform app.assume_actor(p_actor_id);

  return public.record_transaction(
    coalesce(p_payload, '{}'::jsonb)
      || jsonb_build_object('workspace_id', p_workspace_id, 'channel', p_channel)
  );
end;
$$;

revoke all on function public.record_channel_transaction(uuid, uuid, public.entry_channel, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_channel_transaction(uuid, uuid, public.entry_channel, jsonb)
  to service_role;

create or replace function public.consume_channel_quota(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_kind public.usage_kind,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = p_actor_id and status = 'active'
  ) then
    raise exception 'Actor is not an active member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  perform app.assume_actor(p_actor_id);
  return public.consume_quota(p_workspace_id, p_kind, p_limit);
end;
$$;

revoke all on function public.consume_channel_quota(uuid, uuid, public.usage_kind, integer)
  from public, anon, authenticated;
grant execute on function public.consume_channel_quota(uuid, uuid, public.usage_kind, integer)
  to service_role;

create or replace function public.get_workspace_summary_as_service(
  p_workspace_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.workspaces where id = p_workspace_id;
  if v_owner is null then
    raise exception 'Workspace not found' using errcode = 'no_data_found';
  end if;

  perform app.assume_actor(v_owner);
  return public.get_dashboard_summary(p_workspace_id, p_from, p_to);
end;
$$;

revoke all on function public.get_workspace_summary_as_service(uuid, date, date)
  from public, anon, authenticated;
grant execute on function public.get_workspace_summary_as_service(uuid, date, date)
  to service_role;
