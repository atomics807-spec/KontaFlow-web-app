-- =============================================================================
-- KontaFlow · 0042 — dashboard operations and controlled support access
-- =============================================================================
-- Platform operators can inspect operational health without receiving blanket
-- access to tenant ledgers. Financial records are only exposed through a
-- time-boxed grant that is requested with a justification and approved by a
-- second administrator. Every grant and every access is audited.
-- =============================================================================

-- ---------------------------- announcements ---------------------------------
create table if not exists public.system_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 160),
  body text not null check (char_length(trim(body)) between 3 and 2000),
  tone text not null default 'info' check (tone in ('info', 'success', 'warning', 'critical')),
  audience text not null default 'all' check (audience in ('all', 'workspace_admins')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists system_announcements_active_idx
  on public.system_announcements (is_active, starts_at desc, ends_at);

drop trigger if exists system_announcements_set_updated_at on public.system_announcements;
create trigger system_announcements_set_updated_at before update on public.system_announcements
for each row execute function app.set_updated_at();

alter table public.system_announcements enable row level security;

drop policy if exists system_announcements_read_active on public.system_announcements;
create policy system_announcements_read_active on public.system_announcements
  for select to authenticated
  using (
    is_active
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
    and (
      audience = 'all'
      or exists (
        select 1
        from public.workspace_members m
        where m.user_id = (select auth.uid())
          and m.status = 'active'
          and m.role in ('owner', 'admin')
      )
    )
  );

revoke all on table public.system_announcements from public, anon;
grant select on table public.system_announcements to authenticated;
grant all on table public.system_announcements to service_role;

-- --------------------------- email delivery audit ---------------------------
create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete set null,
  recipient text not null check (char_length(recipient) <= 320),
  subject text not null check (char_length(subject) <= 500),
  kind text not null default 'transactional' check (char_length(kind) between 1 and 60),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider text not null default 'resend' check (char_length(provider) between 1 and 60),
  provider_message_id text,
  error text check (error is null or char_length(error) <= 1000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists email_deliveries_created_idx
  on public.email_deliveries (created_at desc);
create index if not exists email_deliveries_status_idx
  on public.email_deliveries (status, created_at desc);
create index if not exists email_deliveries_workspace_idx
  on public.email_deliveries (workspace_id, created_at desc);

alter table public.email_deliveries enable row level security;
revoke all on table public.email_deliveries from public, anon, authenticated;
grant all on table public.email_deliveries to service_role;

-- --------------------------- support access grants --------------------------
create table if not exists public.support_access_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  approved_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'revoked', 'expired')),
  justification text not null check (char_length(trim(justification)) between 20 and 1000),
  requested_hours integer not null default 24 check (requested_hours between 1 and 72),
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  access_count integer not null default 0 check (access_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or decided_at is null or expires_at > decided_at)
);

create unique index if not exists support_access_one_open_idx
  on public.support_access_grants (workspace_id, requested_by)
  where status in ('pending', 'approved');
create index if not exists support_access_status_idx
  on public.support_access_grants (status, requested_at desc);
create index if not exists support_access_workspace_idx
  on public.support_access_grants (workspace_id, requested_at desc);

drop trigger if exists support_access_grants_set_updated_at on public.support_access_grants;
create trigger support_access_grants_set_updated_at before update on public.support_access_grants
for each row execute function app.set_updated_at();

alter table public.support_access_grants enable row level security;
revoke all on table public.support_access_grants from public, anon, authenticated;
grant all on table public.support_access_grants to service_role;

-- --------------------------- operational overview ---------------------------
create or replace function public.platform_admin_operations_overview()
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
    'workspaces', (select count(*) from public.workspaces),
    'active_subscriptions', (select count(*) from public.subscriptions where status = 'active'),
    'trialing_subscriptions', (select count(*) from public.subscriptions where status = 'trialing'),
    'past_due_subscriptions', (select count(*) from public.subscriptions where status = 'past_due'),
    'failed_payments_30d', (
      select count(*) from public.payment_transactions
      where status in ('failed', 'expired') and created_at >= now() - interval '30 days'
    ),
    'ai_interactions_30d', (
      select count(*) from public.ai_interactions where created_at >= now() - interval '30 days'
    ),
    'ai_tokens_30d', (
      select coalesce(sum(coalesce(prompt_tokens, 0) + coalesce(completion_tokens, 0)), 0)
      from public.ai_interactions where created_at >= now() - interval '30 days'
    ),
    'ai_cost_minor_30d', (
      select coalesce(sum(cost_minor), 0) from public.ai_interactions
      where created_at >= now() - interval '30 days'
    )::text,
    'emails_sent_30d', (
      select count(*) from public.email_deliveries
      where status = 'sent' and created_at >= now() - interval '30 days'
    ),
    'emails_failed_30d', (
      select count(*) from public.email_deliveries
      where status = 'failed' and created_at >= now() - interval '30 days'
    ),
    'ussd_sessions_30d', (
      select count(*) from public.ussd_sessions where created_at >= now() - interval '30 days'
    ),
    'whatsapp_messages_30d', (
      select count(*) from public.whatsapp_messages where created_at >= now() - interval '30 days'
    ),
    'whatsapp_failed_30d', (
      select count(*) from public.whatsapp_messages
      where status in ('failed', 'undelivered') and created_at >= now() - interval '30 days'
    ),
    'new_support_requests', (select count(*) from public.contact_messages where status = 'new'),
    'pending_support_access', (
      select count(*) from public.support_access_grants where status = 'pending'
    ),
    'webhook_failures_24h', (
      select count(*) from public.webhook_events
      where status = 'failed' and received_at >= now() - interval '24 hours'
    ),
    'active_announcements', (
      select count(*) from public.system_announcements
      where is_active and starts_at <= now() and (ends_at is null or ends_at > now())
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ------------------------------- payments -----------------------------------
create or replace function public.platform_admin_list_payments(
  p_status text default null,
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
  v_status text := nullif(trim(coalesce(p_status, '')), '');
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
      p.id,
      p.workspace_id,
      w.name as workspace_name,
      u.email as owner_email,
      p.amount_minor::text,
      p.currency,
      p.status::text,
      p.provider,
      p.provider_ref,
      p.merchant_reference,
      p.plan_code,
      p.failure_code,
      p.failure_message,
      p.refunded_amount_minor::text,
      p.created_at,
      p.paid_at,
      p.expires_at
    from public.payment_transactions p
    join public.workspaces w on w.id = p.workspace_id
    left join auth.users u on u.id = w.owner_id
    where (v_status is null or v_status = 'all' or p.status::text = v_status)
      and (
        v_search is null
        or w.name ilike '%' || v_search || '%'
        or coalesce(u.email, '') ilike '%' || v_search || '%'
        or coalesce(p.merchant_reference, '') ilike '%' || v_search || '%'
        or coalesce(p.provider_ref, '') ilike '%' || v_search || '%'
      )
    order by p.created_at desc
    limit greatest(1, least(200, coalesce(p_limit, 100)))
    offset greatest(0, coalesce(p_offset, 0))
  ) r;

  return v_result;
end;
$$;

-- ---------------------------- support requests ------------------------------
create or replace function public.platform_admin_list_support_requests(
  p_status text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text := nullif(trim(coalesce(p_status, '')), '');
  v_result jsonb;
begin
  if not app.is_platform_admin() then
    raise exception 'Platform administrator access required' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(jsonb_agg(row_to_json(r) order by r.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select
      m.id, m.name, m.email, m.company, m.topic, m.message, m.locale,
      m.status, m.source, m.created_at, m.handled_at,
      u.email as handled_by_email
    from public.contact_messages m
    left join auth.users u on u.id = m.handled_by
    where v_status is null or v_status = 'all' or m.status = v_status
    order by m.created_at desc
    limit greatest(1, least(200, coalesce(p_limit, 100)))
  ) r;

  return v_result;
end;
$$;

create or replace function public.platform_admin_update_support_request(
  p_id uuid,
  p_status text,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.contact_messages%rowtype;
begin
  if not app.is_platform_admin() then
    raise exception 'Platform administrator access required' using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('new', 'read', 'replied', 'closed', 'spam') then
    raise exception 'Unsupported support request status' using errcode = 'check_violation';
  end if;

  update public.contact_messages
  set status = p_status,
      handled_at = case when p_status = 'new' then null else now() end,
      handled_by = case when p_status = 'new' then null else auth.uid() end
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'Support request not found' using errcode = 'no_data_found';
  end if;

  perform app.write_platform_audit(
    'support_request.updated',
    'support_request',
    p_id,
    jsonb_build_object('status', p_status, 'email', v_row.email, 'topic', v_row.topic),
    p_ip
  );

  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'handled_at', v_row.handled_at);
end;
$$;

-- ---------------------------- integration health -----------------------------
create or replace function public.platform_admin_integration_status()
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
    'accounts', coalesce((
      select jsonb_agg(row_to_json(a) order by a.provider)
      from (
        select provider,
               count(*) as account_count,
               count(*) filter (where status = 'active') as active_count,
               count(*) filter (where status = 'error') as error_count,
               max(last_synced_at) as last_synced_at
        from public.integration_accounts
        where archived_at is null
        group by provider
      ) a
    ), '[]'::jsonb),
    'webhook_failures', coalesce((
      select jsonb_agg(row_to_json(f) order by f.received_at desc)
      from (
        select provider, external_id, error, received_at
        from public.webhook_events
        where status = 'failed' and received_at >= now() - interval '7 days'
        order by received_at desc
        limit 20
      ) f
    ), '[]'::jsonb),
    'message_failures', coalesce((
      select jsonb_agg(row_to_json(f) order by f.provider)
      from (
        select provider, count(*) as failed_count
        from public.integration_messages
        where status = 'failed' and occurred_at >= now() - interval '7 days'
        group by provider
      ) f
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ------------------------------- usage --------------------------------------
create or replace function public.platform_admin_usage_metrics()
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
    'totals', jsonb_build_object(
      'events_30d', (select count(*) from public.usage_events where created_at >= now() - interval '30 days'),
      'active_workspaces_30d', (
        select count(distinct workspace_id) from public.usage_events
        where created_at >= now() - interval '30 days'
      ),
      'transactions_30d', (
        select count(*) from public.transactions where created_at >= now() - interval '30 days'
      ),
      'ai_messages_30d', (
        select coalesce(sum(quantity), 0) from public.usage_events
        where kind = 'ai_message' and created_at >= now() - interval '30 days'
      ),
      'sync_pushes_30d', (
        select coalesce(sum(quantity), 0) from public.usage_events
        where kind = 'sync_push' and created_at >= now() - interval '30 days'
      )
    ),
    'by_kind', coalesce((
      select jsonb_agg(row_to_json(k) order by k.kind)
      from (
        select kind::text, sum(quantity) as quantity, count(distinct workspace_id) as workspaces
        from public.usage_events
        where created_at >= now() - interval '30 days'
        group by kind
      ) k
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(row_to_json(d) order by d.day)
      from (
        select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, sum(quantity) as quantity
        from public.usage_events
        where created_at >= now() - interval '14 days'
        group by 1
      ) d
    ), '[]'::jsonb),
    'top_workspaces', coalesce((
      select jsonb_agg(row_to_json(t) order by t.quantity desc)
      from (
        select w.id, w.name, sum(u.quantity) as quantity
        from public.usage_events u
        join public.workspaces w on w.id = u.workspace_id
        where u.created_at >= now() - interval '30 days'
        group by w.id, w.name
        order by sum(u.quantity) desc
        limit 10
      ) t
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ------------------------------- AI usage -----------------------------------
create or replace function public.platform_admin_ai_usage()
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
    'totals', jsonb_build_object(
      'interactions_30d', (select count(*) from public.ai_interactions where created_at >= now() - interval '30 days'),
      'prompt_tokens_30d', (select coalesce(sum(prompt_tokens), 0) from public.ai_interactions where created_at >= now() - interval '30 days'),
      'completion_tokens_30d', (select coalesce(sum(completion_tokens), 0) from public.ai_interactions where created_at >= now() - interval '30 days'),
      'cost_minor_30d', (select coalesce(sum(cost_minor), 0) from public.ai_interactions where created_at >= now() - interval '30 days')::text,
      'errors_30d', (select count(*) from public.ai_interactions where status = 'error' and created_at >= now() - interval '30 days'),
      'blocked_30d', (select count(*) from public.ai_interactions where status = 'blocked' and created_at >= now() - interval '30 days'),
      'avg_latency_ms_30d', (select coalesce(round(avg(latency_ms)), 0) from public.ai_interactions where created_at >= now() - interval '30 days')
    ),
    'by_status', coalesce((
      select jsonb_agg(row_to_json(s) order by s.status)
      from (
        select status, count(*) as count
        from public.ai_interactions
        where created_at >= now() - interval '30 days'
        group by status
      ) s
    ), '[]'::jsonb),
    'by_model', coalesce((
      select jsonb_agg(row_to_json(m) order by m.count desc)
      from (
        select coalesce(model, 'unknown') as model, count(*) as count,
               coalesce(sum(coalesce(prompt_tokens, 0) + coalesce(completion_tokens, 0)), 0) as tokens
        from public.ai_interactions
        where created_at >= now() - interval '30 days'
        group by coalesce(model, 'unknown')
        order by count(*) desc
        limit 10
      ) m
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(row_to_json(d) order by d.day)
      from (
        select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
               count(*) as interactions,
               coalesce(sum(coalesce(prompt_tokens, 0) + coalesce(completion_tokens, 0)), 0) as tokens,
               coalesce(sum(cost_minor), 0) as cost_minor
        from public.ai_interactions
        where created_at >= now() - interval '14 days'
        group by 1
      ) d
    ), '[]'::jsonb),
    'top_workspaces', coalesce((
      select jsonb_agg(row_to_json(t) order by t.interactions desc)
      from (
        select w.id, w.name, count(*) as interactions,
               coalesce(sum(coalesce(a.prompt_tokens, 0) + coalesce(a.completion_tokens, 0)), 0) as tokens
        from public.ai_interactions a
        join public.workspaces w on w.id = a.workspace_id
        where a.created_at >= now() - interval '30 days'
        group by w.id, w.name
        order by count(*) desc
        limit 10
      ) t
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- --------------------------- email delivery log -----------------------------
create or replace function public.platform_admin_email_delivery()
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
    'totals', jsonb_build_object(
      'sent_30d', (select count(*) from public.email_deliveries where status = 'sent' and created_at >= now() - interval '30 days'),
      'failed_30d', (select count(*) from public.email_deliveries where status = 'failed' and created_at >= now() - interval '30 days'),
      'skipped_30d', (select count(*) from public.email_deliveries where status = 'skipped' and created_at >= now() - interval '30 days')
    ),
    'recent', coalesce((
      select jsonb_agg(row_to_json(r) order by r.created_at desc)
      from (
        select d.id, d.recipient, d.subject, d.kind, d.status, d.provider,
               d.provider_message_id, d.error, d.created_at, w.name as workspace_name
        from public.email_deliveries d
        left join public.workspaces w on w.id = d.workspace_id
        order by d.created_at desc
        limit 100
      ) r
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ------------------------------ USSD activity -------------------------------
create or replace function public.platform_admin_ussd_activity()
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
    'totals', jsonb_build_object(
      'sessions_30d', (select count(*) from public.ussd_sessions where created_at >= now() - interval '30 days'),
      'active_sessions', (select count(*) from public.ussd_sessions where expires_at > now()),
      'unique_phones_30d', (select count(distinct phone) from public.ussd_sessions where created_at >= now() - interval '30 days'),
      'linked_sessions_30d', (select count(*) from public.ussd_sessions where created_at >= now() - interval '30 days' and user_id is not null)
    ),
    'daily', coalesce((
      select jsonb_agg(row_to_json(d) order by d.day)
      from (
        select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*) as sessions
        from public.ussd_sessions
        where created_at >= now() - interval '14 days'
        group by 1
      ) d
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(row_to_json(r) order by r.created_at desc)
      from (
        select s.session_id,
               left(s.phone, 3) || '****' || right(s.phone, 2) as phone_masked,
               s.service_code, s.expires_at, s.created_at, s.updated_at,
               w.name as workspace_name
        from public.ussd_sessions s
        left join public.workspaces w on w.id = s.workspace_id
        order by s.created_at desc
        limit 50
      ) r
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------- WhatsApp activity -----------------------------
create or replace function public.platform_admin_whatsapp_activity()
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
    'totals', jsonb_build_object(
      'messages_30d', (select count(*) from public.whatsapp_messages where created_at >= now() - interval '30 days'),
      'inbound_30d', (select count(*) from public.whatsapp_messages where direction = 'inbound' and created_at >= now() - interval '30 days'),
      'outbound_30d', (select count(*) from public.whatsapp_messages where direction = 'outbound' and created_at >= now() - interval '30 days'),
      'failed_30d', (select count(*) from public.whatsapp_messages where status in ('failed', 'undelivered') and created_at >= now() - interval '30 days')
    ),
    'daily', coalesce((
      select jsonb_agg(row_to_json(d) order by d.day)
      from (
        select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
               count(*) as messages,
               count(*) filter (where direction = 'inbound') as inbound,
               count(*) filter (where direction = 'outbound') as outbound
        from public.whatsapp_messages
        where created_at >= now() - interval '14 days'
        group by 1
      ) d
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(row_to_json(r) order by r.created_at desc)
      from (
        select m.id, m.direction, m.message_type, m.status,
               left(m.from_phone, 3) || '****' || right(m.from_phone, 2) as from_phone_masked,
               left(m.to_phone, 3) || '****' || right(m.to_phone, 2) as to_phone_masked,
               m.created_at, w.name as workspace_name
        from public.whatsapp_messages m
        left join public.workspaces w on w.id = m.workspace_id
        order by m.created_at desc
        limit 50
      ) r
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------- security audit --------------------------------
create or replace function public.platform_admin_security_audit(p_limit integer default 100)
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
    'actions', coalesce((
      select jsonb_agg(row_to_json(a) order by a.created_at desc)
      from (
        select l.id, l.action, l.target_type, l.target_id, l.details, l.ip, l.created_at,
               u.email as admin_email
        from public.platform_admin_audit_log l
        left join auth.users u on u.id = l.admin_user_id
        order by l.created_at desc
        limit greatest(1, least(500, coalesce(p_limit, 100)))
      ) a
    ), '[]'::jsonb),
    'restrictions', coalesce((
      select jsonb_agg(row_to_json(r) order by r.created_at desc)
      from (
        select a.id, a.user_id, a.severity::text, a.reason, a.expires_at, a.created_at,
               a.lifted_at, a.lift_reason, u.email
        from public.account_restrictions a
        left join auth.users u on u.id = a.user_id
        order by a.created_at desc
        limit 50
      ) r
    ), '[]'::jsonb),
    'support_access', coalesce((
      select jsonb_agg(row_to_json(s) order by s.requested_at desc)
      from (
        select g.id, g.workspace_id, w.name as workspace_name, g.status, g.justification,
               g.requested_hours, g.requested_at, g.decided_at, g.expires_at,
               g.access_count, g.last_accessed_at,
               requester.email as requested_by_email,
               approver.email as approved_by_email
        from public.support_access_grants g
        join public.workspaces w on w.id = g.workspace_id
        left join auth.users requester on requester.id = g.requested_by
        left join auth.users approver on approver.id = g.approved_by
        order by g.requested_at desc
        limit 50
      ) s
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------- announcements API -----------------------------
create or replace function public.platform_admin_list_announcements()
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

  select coalesce(jsonb_agg(row_to_json(a) order by a.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select s.id, s.title, s.body, s.tone, s.audience, s.starts_at, s.ends_at,
           s.is_active, s.created_at, u.email as created_by_email
    from public.system_announcements s
    left join auth.users u on u.id = s.created_by
    order by s.created_at desc
    limit 100
  ) a;

  return v_result;
end;
$$;

create or replace function public.platform_admin_save_announcement(
  p_id uuid default null,
  p_title text default null,
  p_body text default null,
  p_tone text default 'info',
  p_audience text default 'all',
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_is_active boolean default true,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.system_announcements%rowtype;
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_body text := nullif(trim(coalesce(p_body, '')), '');
  v_starts timestamptz := coalesce(p_starts_at, now());
begin
  if not app.is_platform_admin() then
    raise exception 'Platform administrator access required' using errcode = 'insufficient_privilege';
  end if;
  if v_title is null or char_length(v_title) < 3 or char_length(v_title) > 160 then
    raise exception 'Announcement title must be between 3 and 160 characters' using errcode = 'check_violation';
  end if;
  if v_body is null or char_length(v_body) < 3 or char_length(v_body) > 2000 then
    raise exception 'Announcement body must be between 3 and 2000 characters' using errcode = 'check_violation';
  end if;
  if p_tone not in ('info', 'success', 'warning', 'critical') then
    raise exception 'Unsupported announcement tone' using errcode = 'check_violation';
  end if;
  if p_audience not in ('all', 'workspace_admins') then
    raise exception 'Unsupported announcement audience' using errcode = 'check_violation';
  end if;
  if p_ends_at is not null and p_ends_at <= v_starts then
    raise exception 'Announcement end must be after its start' using errcode = 'check_violation';
  end if;

  if p_id is null then
    insert into public.system_announcements (
      title, body, tone, audience, starts_at, ends_at, is_active, created_by
    )
    values (v_title, v_body, p_tone, p_audience, v_starts, p_ends_at, coalesce(p_is_active, true), auth.uid())
    returning * into v_row;
  else
    update public.system_announcements
    set title = v_title,
        body = v_body,
        tone = p_tone,
        audience = p_audience,
        starts_at = v_starts,
        ends_at = p_ends_at,
        is_active = coalesce(p_is_active, true)
    where id = p_id
    returning * into v_row;
    if not found then
      raise exception 'Announcement not found' using errcode = 'no_data_found';
    end if;
  end if;

  perform app.write_platform_audit(
    case when p_id is null then 'announcement.created' else 'announcement.updated' end,
    'announcement',
    v_row.id,
    jsonb_build_object('title', v_row.title, 'tone', v_row.tone, 'audience', v_row.audience, 'is_active', v_row.is_active),
    p_ip
  );

  return jsonb_build_object('id', v_row.id, 'title', v_row.title, 'is_active', v_row.is_active);
end;
$$;

create or replace function public.platform_admin_toggle_announcement(
  p_id uuid,
  p_is_active boolean,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.system_announcements%rowtype;
begin
  if not app.is_platform_admin() then
    raise exception 'Platform administrator access required' using errcode = 'insufficient_privilege';
  end if;

  update public.system_announcements
  set is_active = p_is_active
  where id = p_id
  returning * into v_row;
  if not found then
    raise exception 'Announcement not found' using errcode = 'no_data_found';
  end if;

  perform app.write_platform_audit(
    'announcement.toggled',
    'announcement',
    p_id,
    jsonb_build_object('title', v_row.title, 'is_active', v_row.is_active),
    p_ip
  );

  return jsonb_build_object('id', v_row.id, 'is_active', v_row.is_active);
end;
$$;

-- ------------------------- support access workflow --------------------------
create or replace function public.platform_admin_support_access_list(p_limit integer default 100)
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

  update public.support_access_grants
  set status = 'expired'
  where status = 'approved' and expires_at is not null and expires_at <= now();

  select coalesce(jsonb_agg(row_to_json(g) order by g.requested_at desc), '[]'::jsonb)
  into v_result
  from (
    select s.id, s.workspace_id, w.name as workspace_name, s.status,
           s.justification, s.requested_hours, s.decision_note,
           s.requested_at, s.decided_at, s.expires_at, s.revoked_at,
           s.last_accessed_at, s.access_count,
           requester.email as requested_by_email,
           approver.email as approved_by_email,
           s.requested_by, s.approved_by
    from public.support_access_grants s
    join public.workspaces w on w.id = s.workspace_id
    left join auth.users requester on requester.id = s.requested_by
    left join auth.users approver on approver.id = s.approved_by
    order by s.requested_at desc
    limit greatest(1, least(200, coalesce(p_limit, 100)))
  ) g;

  return v_result;
end;
$$;

create or replace function public.platform_admin_request_support_access(
  p_workspace_id uuid,
  p_justification text,
  p_hours integer default 24,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.support_access_grants%rowtype;
  v_justification text := nullif(trim(coalesce(p_justification, '')), '');
  v_workspace_name text;
begin
  if not app.is_platform_admin() then
    raise exception 'Platform administrator access required' using errcode = 'insufficient_privilege';
  end if;
  if v_justification is null or char_length(v_justification) < 20 or char_length(v_justification) > 1000 then
    raise exception 'A justification between 20 and 1000 characters is required' using errcode = 'check_violation';
  end if;
  if p_hours is null or p_hours < 1 or p_hours > 72 then
    raise exception 'Support access must last between 1 and 72 hours' using errcode = 'check_violation';
  end if;

  select name into v_workspace_name from public.workspaces where id = p_workspace_id;
  if not found then
    raise exception 'Workspace not found' using errcode = 'no_data_found';
  end if;

  insert into public.support_access_grants (
    workspace_id, requested_by, status, justification, requested_hours
  )
  values (p_workspace_id, auth.uid(), 'pending', v_justification, p_hours)
  returning * into v_row;

  perform app.write_platform_audit(
    'support_access.requested',
    'workspace',
    p_workspace_id,
    jsonb_build_object(
      'grant_id', v_row.id,
      'workspace_name', v_workspace_name,
      'requested_hours', p_hours,
      'justification', v_justification
    ),
    p_ip
  );

  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'workspace_id', p_workspace_id);
end;
$$;

create or replace function public.platform_admin_decide_support_access(
  p_grant_id uuid,
  p_approve boolean,
  p_note text default null,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.support_access_grants%rowtype;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_workspace_name text;
begin
  if not app.is_super_admin() then
    raise exception 'Super administrator access required' using errcode = 'insufficient_privilege';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Decision note must be 500 characters or fewer' using errcode = 'check_violation';
  end if;

  select * into v_row
  from public.support_access_grants
  where id = p_grant_id and status = 'pending'
  for update;
  if not found then
    raise exception 'Pending support access request not found' using errcode = 'no_data_found';
  end if;
  if v_row.requested_by = auth.uid() then
    raise exception 'You cannot approve your own support access request' using errcode = 'check_violation';
  end if;

  update public.support_access_grants
  set status = case when p_approve then 'approved' else 'denied' end,
      approved_by = auth.uid(),
      decided_at = now(),
      decision_note = v_note,
      expires_at = case when p_approve then now() + make_interval(hours => v_row.requested_hours) else null end
  where id = p_grant_id
  returning * into v_row;

  select name into v_workspace_name from public.workspaces where id = v_row.workspace_id;

  perform app.write_platform_audit(
    case when p_approve then 'support_access.approved' else 'support_access.denied' end,
    'workspace',
    v_row.workspace_id,
    jsonb_build_object(
      'grant_id', v_row.id,
      'workspace_name', v_workspace_name,
      'requested_by', v_row.requested_by,
      'expires_at', v_row.expires_at,
      'note', v_note
    ),
    p_ip
  );

  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'expires_at', v_row.expires_at);
end;
$$;

create or replace function public.platform_admin_revoke_support_access(
  p_grant_id uuid,
  p_reason text default null,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.support_access_grants%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not app.is_super_admin() then
    raise exception 'Super administrator access required' using errcode = 'insufficient_privilege';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'Revocation reason must be 500 characters or fewer' using errcode = 'check_violation';
  end if;

  update public.support_access_grants
  set status = 'revoked', revoked_at = now(), decision_note = coalesce(v_reason, decision_note)
  where id = p_grant_id and status in ('pending', 'approved')
  returning * into v_row;
  if not found then
    raise exception 'Active support access grant not found' using errcode = 'no_data_found';
  end if;

  perform app.write_platform_audit(
    'support_access.revoked',
    'workspace',
    v_row.workspace_id,
    jsonb_build_object('grant_id', v_row.id, 'reason', v_reason),
    p_ip
  );

  return jsonb_build_object('id', v_row.id, 'status', v_row.status);
end;
$$;

create or replace function public.platform_admin_support_snapshot(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_grant public.support_access_grants%rowtype;
  v_result jsonb;
  v_workspace public.workspaces%rowtype;
  v_owner_email text;
begin
  if not app.is_platform_admin() then
    raise exception 'Platform administrator access required' using errcode = 'insufficient_privilege';
  end if;

  select * into v_grant
  from public.support_access_grants
  where workspace_id = p_workspace_id
    and requested_by = auth.uid()
    and status = 'approved'
    and expires_at is not null
    and expires_at > now()
  order by decided_at desc
  limit 1;

  if not found then
    raise exception 'An approved support access grant is required' using errcode = 'insufficient_privilege';
  end if;

  update public.support_access_grants
  set last_accessed_at = now(),
      access_count = access_count + 1
  where id = v_grant.id;

  perform app.write_platform_audit(
    'support_access.accessed',
    'workspace',
    p_workspace_id,
    jsonb_build_object('grant_id', v_grant.id, 'expires_at', v_grant.expires_at),
    null
  );

  select * into v_workspace from public.workspaces where id = p_workspace_id;
  select email into v_owner_email from auth.users where id = v_workspace.owner_id;

  select jsonb_build_object(
    'workspace', jsonb_build_object(
      'id', v_workspace.id,
      'name', v_workspace.name,
      'slug', v_workspace.slug,
      'plan', v_workspace.plan::text,
      'currency', v_workspace.currency,
      'timezone', v_workspace.timezone,
      'created_at', v_workspace.created_at,
      'owner_email', v_owner_email
    ),
    'grant', jsonb_build_object(
      'id', v_grant.id,
      'justification', v_grant.justification,
      'expires_at', v_grant.expires_at,
      'access_count', v_grant.access_count + 1
    ),
    'counts', jsonb_build_object(
      'members', (select count(*) from public.workspace_members m where m.workspace_id = p_workspace_id and m.status = 'active'),
      'transactions', (select count(*) from public.transactions t where t.workspace_id = p_workspace_id),
      'customers', (select count(*) from public.contacts c where c.workspace_id = p_workspace_id and c.kind in ('customer', 'both')),
      'suppliers', (select count(*) from public.contacts c where c.workspace_id = p_workspace_id and c.kind in ('supplier', 'both'))
    ),
    'totals_30d', (
      select jsonb_build_object(
        'income_minor', coalesce(sum(t.amount_minor) filter (where t.kind = 'income' and t.status = 'posted'), 0)::text,
        'expense_minor', coalesce(sum(t.amount_minor) filter (where t.kind = 'expense' and t.status = 'posted'), 0)::text,
        'currency', v_workspace.currency
      )
      from public.transactions t
      where t.workspace_id = p_workspace_id
        and t.occurred_on >= current_date - 30
    ),
    'recent_transactions', coalesce((
      select jsonb_agg(row_to_json(t) order by t.occurred_on desc)
      from (
        select tx.id, tx.occurred_on, tx.kind::text, tx.description,
               tx.amount_minor::text, tx.currency, tx.status::text,
               c.name as category_name
        from public.transactions tx
        left join public.categories c on c.id = tx.category_id
        where tx.workspace_id = p_workspace_id
        order by tx.occurred_on desc, tx.created_at desc
        limit 10
      ) t
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- amend_transaction: corrections are atomic. The original entry is voided and
-- a replacement is posted in one transaction, with the link kept in metadata.
-- ---------------------------------------------------------------------------
create or replace function public.amend_transaction(
  p_transaction_id uuid,
  p_payload jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.transactions;
  v_payload jsonb;
  v_result jsonb;
begin
  select * into v_old from public.transactions where id = p_transaction_id;
  if not found then
    raise exception 'Transaction not found' using errcode = 'no_data_found';
  end if;
  if v_old.status = 'voided' then
    raise exception 'Transaction is already voided' using errcode = 'check_violation';
  end if;
  if (p_payload ->> 'workspace_id')::uuid is distinct from v_old.workspace_id then
    raise exception 'Transaction does not belong to this workspace' using errcode = 'insufficient_privilege';
  end if;
  if not app.can_manage_records(v_old.workspace_id) then
    raise exception 'Not allowed to amend transactions' using errcode = 'insufficient_privilege';
  end if;

  v_payload := jsonb_set(
    coalesce(p_payload, '{}'::jsonb),
    '{metadata}',
    coalesce(p_payload -> 'metadata', '{}'::jsonb)
      || jsonb_build_object('amends_transaction_id', p_transaction_id),
    true
  );
  v_result := public.record_transaction(v_payload);
  perform public.void_transaction(
    p_transaction_id,
    coalesce(nullif(trim(p_reason), ''), 'Amended transaction')
  );
  return v_result || jsonb_build_object('amended_from', p_transaction_id);
end;
$$;

-- ------------------------------- grants -------------------------------------
revoke all on function public.platform_admin_operations_overview() from public, anon;
revoke all on function public.platform_admin_list_payments(text, text, integer, integer) from public, anon;
revoke all on function public.platform_admin_list_support_requests(text, integer) from public, anon;
revoke all on function public.platform_admin_update_support_request(uuid, text, text) from public, anon;
revoke all on function public.platform_admin_integration_status() from public, anon;
revoke all on function public.platform_admin_usage_metrics() from public, anon;
revoke all on function public.platform_admin_ai_usage() from public, anon;
revoke all on function public.platform_admin_email_delivery() from public, anon;
revoke all on function public.platform_admin_ussd_activity() from public, anon;
revoke all on function public.platform_admin_whatsapp_activity() from public, anon;
revoke all on function public.platform_admin_security_audit(integer) from public, anon;
revoke all on function public.platform_admin_list_announcements() from public, anon;
revoke all on function public.platform_admin_save_announcement(uuid, text, text, text, text, timestamptz, timestamptz, boolean, text) from public, anon;
revoke all on function public.platform_admin_toggle_announcement(uuid, boolean, text) from public, anon;
revoke all on function public.platform_admin_support_access_list(integer) from public, anon;
revoke all on function public.platform_admin_request_support_access(uuid, text, integer, text) from public, anon;
revoke all on function public.platform_admin_decide_support_access(uuid, boolean, text, text) from public, anon;
revoke all on function public.platform_admin_revoke_support_access(uuid, text, text) from public, anon;
revoke all on function public.platform_admin_support_snapshot(uuid) from public, anon;
revoke all on function public.amend_transaction(uuid, jsonb, text) from public, anon;

grant execute on function public.platform_admin_operations_overview() to authenticated, service_role;
grant execute on function public.platform_admin_list_payments(text, text, integer, integer) to authenticated, service_role;
grant execute on function public.platform_admin_list_support_requests(text, integer) to authenticated, service_role;
grant execute on function public.platform_admin_update_support_request(uuid, text, text) to authenticated, service_role;
grant execute on function public.platform_admin_integration_status() to authenticated, service_role;
grant execute on function public.platform_admin_usage_metrics() to authenticated, service_role;
grant execute on function public.platform_admin_ai_usage() to authenticated, service_role;
grant execute on function public.platform_admin_email_delivery() to authenticated, service_role;
grant execute on function public.platform_admin_ussd_activity() to authenticated, service_role;
grant execute on function public.platform_admin_whatsapp_activity() to authenticated, service_role;
grant execute on function public.platform_admin_security_audit(integer) to authenticated, service_role;
grant execute on function public.platform_admin_list_announcements() to authenticated, service_role;
grant execute on function public.platform_admin_save_announcement(uuid, text, text, text, text, timestamptz, timestamptz, boolean, text) to authenticated, service_role;
grant execute on function public.platform_admin_toggle_announcement(uuid, boolean, text) to authenticated, service_role;
grant execute on function public.platform_admin_support_access_list(integer) to authenticated, service_role;
grant execute on function public.platform_admin_request_support_access(uuid, text, integer, text) to authenticated, service_role;
grant execute on function public.platform_admin_decide_support_access(uuid, boolean, text, text) to authenticated, service_role;
grant execute on function public.platform_admin_revoke_support_access(uuid, text, text) to authenticated, service_role;
grant execute on function public.platform_admin_support_snapshot(uuid) to authenticated, service_role;
grant execute on function public.amend_transaction(uuid, jsonb, text) to authenticated, service_role;
