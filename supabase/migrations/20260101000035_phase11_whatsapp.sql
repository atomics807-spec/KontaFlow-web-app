-- =============================================================================
-- KontaFlow · 0035 — WhatsApp Business Platform bookkeeping channel
-- =============================================================================
-- Meta retries webhooks and can deliver events out of order. This migration
-- adds the durable state needed to claim each inbound message exactly once,
-- record delivery statuses, verify a phone by a message sent from that phone,
-- and enforce consent / customer-service windows.
--
-- The webhook runs with the service role. Tenant data is still read through
-- the same RPCs used by the app, which re-check the linked member's role.
-- =============================================================================

-- ------------------------- phone-link verification --------------------------
alter table public.channel_identities
  add column if not exists verification_code_hash text,
  add column if not exists verification_expires_at timestamptz,
  add column if not exists verification_attempts integer not null default 0,
  add column if not exists verification_sent_at timestamptz,
  add column if not exists verification_method text,
  add column if not exists consent_at timestamptz,
  add column if not exists consent_version text,
  add column if not exists opted_out_at timestamptz,
  add column if not exists last_inbound_at timestamptz,
  add column if not exists last_outbound_at timestamptz,
  add column if not exists service_window_expires_at timestamptz,
  add column if not exists display_name text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.channel_identities
  drop constraint if exists channel_identities_verification_attempts_check;
alter table public.channel_identities
  add constraint channel_identities_verification_attempts_check
  check (verification_attempts between 0 and 100);

alter table public.channel_identities
  drop constraint if exists channel_identities_verification_method_check;
alter table public.channel_identities
  add constraint channel_identities_verification_method_check
  check (verification_method is null or verification_method in ('whatsapp_reply', 'template', 'ussd_link', 'legacy'));

-- Rows linked before this phase were accepted without a challenge. Keep them
-- working but label them so support can see which links predate verification.
update public.channel_identities
set verification_method = coalesce(verification_method, 'legacy'),
    consent_at = coalesce(consent_at, verified_at),
    consent_version = coalesce(consent_version, 'legacy')
where verified_at is not null;

create index if not exists channel_identities_pending_idx
  on public.channel_identities (channel, address)
  where verified_at is null;

comment on column public.channel_identities.verification_code_hash is
  'HMAC of the six-digit link code. Never stores the plaintext code.';
comment on column public.channel_identities.service_window_expires_at is
  'End of the 24-hour customer-service window opened by the last inbound message.';

-- --------------------------- message delivery state -------------------------
alter table public.whatsapp_messages
  add column if not exists status_updated_at timestamptz,
  add column if not exists error_code text,
  add column if not exists error_title text,
  add column if not exists wa_timestamp timestamptz,
  add column if not exists conversation_category text,
  add column if not exists display_name text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists whatsapp_messages_status_idx
  on public.whatsapp_messages (wa_message_id, status);

-- ------------------------- webhook claim / retry state ----------------------
alter table public.webhook_events
  drop constraint if exists webhook_events_status_check;
alter table public.webhook_events
  add constraint webhook_events_status_check
  check (status in ('received', 'processing', 'processed', 'failed', 'ignored'));

alter table public.webhook_events
  add column if not exists attempts integer not null default 0,
  add column if not exists last_attempt_at timestamptz;

create or replace function public.claim_webhook_event(
  p_provider text,
  p_external_id text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.webhook_events%rowtype;
  v_id uuid;
begin
  if nullif(btrim(p_provider), '') is null
     or nullif(btrim(p_external_id), '') is null then
    raise exception 'Provider and external id are required' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.webhook_events (provider, external_id, status, payload, attempts, last_attempt_at)
  values (
    left(btrim(p_provider), 60),
    left(btrim(p_external_id), 200),
    'processing',
    coalesce(p_payload, '{}'::jsonb),
    1,
    now()
  )
  on conflict (provider, external_id) do nothing
  returning id into v_id;

  if v_id is not null then
    return jsonb_build_object('claimed', true, 'event_id', v_id, 'attempt', 1, 'retry', false);
  end if;

  select * into v_event
  from public.webhook_events
  where provider = left(btrim(p_provider), 60)
    and external_id = left(btrim(p_external_id), 200)
  for update;

  if not found then
    return jsonb_build_object('claimed', false, 'status', 'missing');
  end if;

  if v_event.status in ('processed', 'ignored') then
    return jsonb_build_object('claimed', false, 'status', v_event.status, 'event_id', v_event.id);
  end if;

  -- A worker can die after claiming. Reclaim after a short lease, but never
  -- while another worker is likely still processing the same message.
  if v_event.status = 'processing'
     and coalesce(v_event.last_attempt_at, v_event.received_at) > now() - interval '2 minutes' then
    return jsonb_build_object(
      'claimed', false,
      'status', 'processing',
      'event_id', v_event.id,
      'retry_after_seconds', 120
    );
  end if;

  update public.webhook_events
  set status = 'processing',
      payload = coalesce(p_payload, payload),
      attempts = attempts + 1,
      last_attempt_at = now(),
      error = null,
      processed_at = null
  where id = v_event.id
  returning * into v_event;

  return jsonb_build_object(
    'claimed', true,
    'event_id', v_event.id,
    'attempt', v_event.attempts,
    'retry', true
  );
end;
$$;

revoke all on function public.claim_webhook_event(text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.claim_webhook_event(text, text, jsonb) to service_role;

-- --------------------------- service-role reporting -------------------------
-- get_report() derives the caller from auth.uid(). Webhooks have no JWT, so
-- assume the workspace owner only inside this SECURITY DEFINER wrapper. The
-- caller (the webhook) has already verified the linked member and permission.
create or replace function public.get_report_as_service(
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
  return public.get_report(p_workspace_id, p_from, p_to);
end;
$$;

revoke all on function public.get_report_as_service(uuid, date, date)
  from public, anon, authenticated;
grant execute on function public.get_report_as_service(uuid, date, date) to service_role;

-- --------------------------- channel identity access ------------------------
-- Linking is a server-side workflow now. Authenticated clients may read their
-- own links (and workspace managers may read the workspace directory), but
-- they may not insert a row with a self-asserted verified_at.
drop policy if exists channel_identities_write_own on public.channel_identities;

drop policy if exists channel_identities_select_workspace_admin on public.channel_identities;
create policy channel_identities_select_workspace_admin on public.channel_identities
  for select to authenticated
  using (app.can_manage_workspace(workspace_id));

revoke insert, update, delete on public.channel_identities from authenticated;
grant select on public.channel_identities to authenticated;

grant select on public.v_debts to service_role;

comment on table public.webhook_events is
  'Durable provider-event claim table. A row is claimed once, with a short lease for crash recovery.';
