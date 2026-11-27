-- =============================================================================
-- KontaFlow · 0044 — Phase 21 scalability foundation
-- =============================================================================
-- Durable queue, transactional outbox, distributed cache and per-workspace
-- daily financial rollups. Operational tables are service-role only; tenant
-- reads continue through SECURITY DEFINER RPCs and RLS-protected views.
-- =============================================================================

-- ---------------------- daily financial rollups ----------------------------
create table if not exists public.workspace_daily_financials (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  business_date date not null,
  income_minor bigint not null default 0 check (income_minor >= 0),
  expense_minor bigint not null default 0 check (expense_minor >= 0),
  posted_count integer not null default 0 check (posted_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, business_date)
);
comment on table public.workspace_daily_financials is
  'Incremental per-workspace daily totals. Maintained by the transactions trigger so dashboards avoid repeated full-table aggregates.';

create index if not exists workspace_daily_financials_date_idx
  on public.workspace_daily_financials (business_date desc);

alter table public.workspace_daily_financials enable row level security;
revoke all on table public.workspace_daily_financials from public, anon, authenticated;
grant all on table public.workspace_daily_financials to service_role;

create or replace function app.add_workspace_daily_delta(
  p_workspace_id uuid,
  p_business_date date,
  p_income bigint,
  p_expense bigint,
  p_count integer
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.workspace_daily_financials (
    workspace_id, business_date, income_minor, expense_minor, posted_count, updated_at
  )
  values (
    p_workspace_id,
    p_business_date,
    greatest(p_income, 0),
    greatest(p_expense, 0),
    greatest(p_count, 0),
    now()
  )
  on conflict (workspace_id, business_date) do update
    set income_minor = greatest(0, public.workspace_daily_financials.income_minor + p_income),
        expense_minor = greatest(0, public.workspace_daily_financials.expense_minor + p_expense),
        posted_count = greatest(0, public.workspace_daily_financials.posted_count + p_count),
        updated_at = now();
$$;

revoke all on function app.add_workspace_daily_delta(uuid, date, bigint, bigint, integer)
  from public, anon, authenticated;

create or replace function app.sync_transaction_daily_totals()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_income bigint := 0;
  v_old_expense bigint := 0;
  v_old_count integer := 0;
  v_new_income bigint := 0;
  v_new_expense bigint := 0;
  v_new_count integer := 0;
  v_old_workspace uuid;
  v_old_date date;
  v_new_workspace uuid;
  v_new_date date;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old_workspace := old.workspace_id;
    v_old_date := old.occurred_on;
    if old.status = 'posted' then
      v_old_count := 1;
      if old.kind = 'income' then
        v_old_income := old.amount_minor;
      elsif old.kind = 'expense' then
        v_old_expense := old.amount_minor;
      end if;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    v_new_workspace := new.workspace_id;
    v_new_date := new.occurred_on;
    if new.status = 'posted' then
      v_new_count := 1;
      if new.kind = 'income' then
        v_new_income := new.amount_minor;
      elsif new.kind = 'expense' then
        v_new_expense := new.amount_minor;
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE'
     and (old.workspace_id <> new.workspace_id or old.occurred_on <> new.occurred_on) then
    perform app.add_workspace_daily_delta(
      v_old_workspace, v_old_date, -v_old_income, -v_old_expense, -v_old_count
    );
    perform app.add_workspace_daily_delta(
      v_new_workspace, v_new_date, v_new_income, v_new_expense, v_new_count
    );
  else
    perform app.add_workspace_daily_delta(
      coalesce(v_new_workspace, v_old_workspace),
      coalesce(v_new_date, v_old_date),
      v_new_income - v_old_income,
      v_new_expense - v_old_expense,
      v_new_count - v_old_count
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_daily_totals on public.transactions;
create trigger transactions_daily_totals
after insert or update of status, kind, amount_minor, occurred_on, workspace_id
on public.transactions
for each row execute function app.sync_transaction_daily_totals();

drop trigger if exists transactions_daily_totals_delete on public.transactions;
create trigger transactions_daily_totals_delete
after delete on public.transactions
for each row execute function app.sync_transaction_daily_totals();

insert into public.workspace_daily_financials (
  workspace_id, business_date, income_minor, expense_minor, posted_count
)
select
  workspace_id,
  occurred_on,
  coalesce(sum(case when kind = 'income' then amount_minor else 0 end), 0),
  coalesce(sum(case when kind = 'expense' then amount_minor else 0 end), 0),
  count(*)
from public.transactions
where status = 'posted'
group by workspace_id, occurred_on
on conflict (workspace_id, business_date) do update
  set income_minor = excluded.income_minor,
      expense_minor = excluded.expense_minor,
      posted_count = excluded.posted_count,
      updated_at = now();

-- ------------------------- durable job queue -------------------------------
create table if not exists public.job_queue (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  job_type text not null check (char_length(job_type) between 1 and 80),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'retrying', 'dead_lettered')),
  priority smallint not null default 100 check (priority between 1 and 1000),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  lease_expires_at timestamptz,
  last_error text,
  result jsonb,
  result_ref text,
  idempotency_key text check (idempotency_key is null or char_length(idempotency_key) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
comment on table public.job_queue is
  'Provider-independent durable job queue. Workers claim rows with FOR UPDATE SKIP LOCKED and leases.';

create unique index if not exists job_queue_idempotency_key
  on public.job_queue (job_type, idempotency_key)
  where idempotency_key is not null;
create index if not exists job_queue_ready_idx
  on public.job_queue (status, available_at, priority, created_at)
  where status in ('queued', 'retrying');
create index if not exists job_queue_lease_idx
  on public.job_queue (lease_expires_at)
  where status = 'processing';
create index if not exists job_queue_workspace_idx
  on public.job_queue (workspace_id, status, created_at desc);
create index if not exists job_queue_type_idx
  on public.job_queue (job_type, status, created_at desc);

drop trigger if exists job_queue_set_updated_at on public.job_queue;
create trigger job_queue_set_updated_at before update on public.job_queue
for each row execute function app.set_updated_at();

alter table public.job_queue enable row level security;
revoke all on table public.job_queue from public, anon, authenticated;
grant all on table public.job_queue to service_role;

-- ---------------------- transactional outbox ------------------------------
create table if not exists public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 80),
  aggregate_type text not null check (char_length(aggregate_type) between 1 and 80),
  aggregate_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'delivered', 'failed', 'dead_lettered')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 8 check (max_attempts between 1 and 20),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  lease_expires_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  idempotency_key text check (idempotency_key is null or char_length(idempotency_key) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.outbox_events is
  'Transactional outbox. Financial writes and their events commit in one database transaction.';

create unique index if not exists outbox_events_idempotency_key
  on public.outbox_events (event_type, idempotency_key)
  where idempotency_key is not null;
create index if not exists outbox_events_ready_idx
  on public.outbox_events (status, available_at, created_at)
  where status in ('pending', 'failed');
create index if not exists outbox_events_workspace_idx
  on public.outbox_events (workspace_id, created_at desc);
create index if not exists outbox_events_lease_idx
  on public.outbox_events (lease_expires_at)
  where status = 'processing';

drop trigger if exists outbox_events_set_updated_at on public.outbox_events;
create trigger outbox_events_set_updated_at before update on public.outbox_events
for each row execute function app.set_updated_at();

alter table public.outbox_events enable row level security;
revoke all on table public.outbox_events from public, anon, authenticated;
grant all on table public.outbox_events to service_role;

create or replace function app.emit_transaction_outbox()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_type text;
begin
  if tg_op = 'INSERT' and new.status = 'posted' then
    v_event_type := 'transaction.posted';
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'voided' then
    v_event_type := 'transaction.voided';
  else
    return new;
  end if;

  insert into public.outbox_events (
    workspace_id, event_type, aggregate_type, aggregate_id, payload, idempotency_key
  )
  values (
    new.workspace_id,
    v_event_type,
    'transaction',
    new.id,
    jsonb_build_object(
      'transaction_id', new.id,
      'kind', new.kind,
      'amount_minor', new.amount_minor,
      'currency', new.currency,
      'occurred_on', new.occurred_on,
      'status', new.status
    ),
    'transaction:' || new.id::text || ':' || v_event_type
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists transactions_emit_outbox on public.transactions;
create trigger transactions_emit_outbox
after insert or update of status on public.transactions
for each row execute function app.emit_transaction_outbox();

-- -------------------------- distributed cache -----------------------------
create table if not exists public.app_cache (
  cache_key text primary key check (char_length(cache_key) between 8 and 240),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  value jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.app_cache is
  'Shared JSON cache for expensive tenant-scoped reads. Keys must include the workspace and authorization scope.';
create index if not exists app_cache_expiry_idx on public.app_cache (expires_at);
create index if not exists app_cache_workspace_idx on public.app_cache (workspace_id);

alter table public.app_cache enable row level security;
revoke all on table public.app_cache from public, anon, authenticated;
grant all on table public.app_cache to service_role;

create table if not exists public.app_cache_locks (
  cache_key text primary key check (char_length(cache_key) between 8 and 240),
  owner text not null,
  expires_at timestamptz not null
);
comment on table public.app_cache_locks is
  'Short-lived cache-fill locks that prevent stampedes across application instances.';

alter table public.app_cache_locks enable row level security;
revoke all on table public.app_cache_locks from public, anon, authenticated;
grant all on table public.app_cache_locks to service_role;

create or replace function public.acquire_cache_lock(
  p_key text,
  p_owner text,
  p_ttl_seconds integer default 15
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ok boolean := false;
begin
  if p_key is null or char_length(p_key) < 8 or char_length(p_key) > 240 then
    raise exception 'Invalid cache key' using errcode = 'check_violation';
  end if;
  if p_owner is null or char_length(p_owner) < 1 or char_length(p_owner) > 120 then
    raise exception 'Invalid cache lock owner' using errcode = 'check_violation';
  end if;

  insert into public.app_cache_locks (cache_key, owner, expires_at)
  values (p_key, p_owner, now() + make_interval(secs => greatest(1, least(p_ttl_seconds, 60))))
  on conflict (cache_key) do update
    set owner = excluded.owner,
        expires_at = excluded.expires_at
    where public.app_cache_locks.expires_at <= now()
       or public.app_cache_locks.owner = excluded.owner
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

create or replace function public.release_cache_lock(p_key text, p_owner text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.app_cache_locks
  where cache_key = p_key and owner = p_owner;
$$;

revoke all on function public.acquire_cache_lock(text, text, integer) from public, anon, authenticated;
revoke all on function public.release_cache_lock(text, text) from public, anon, authenticated;
grant execute on function public.acquire_cache_lock(text, text, integer) to service_role;
grant execute on function public.release_cache_lock(text, text) to service_role;

-- --------------------------- rate-limit v2 --------------------------------
create or replace function public.consume_security_rate_limit_v2(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_window_start timestamptz;
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
  returning count, window_start into v_count, v_window_start;

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'count', v_count,
    'limit', p_limit,
    'remaining', greatest(p_limit - v_count, 0),
    'reset_at', v_window_start + make_interval(secs => p_window_seconds)
  );
end;
$$;

revoke all on function public.consume_security_rate_limit_v2(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_security_rate_limit_v2(text, integer, integer)
  to service_role;

-- --------------------------- queue operations ------------------------------
create or replace function public.enqueue_job(
  p_job_type text,
  p_payload jsonb default '{}'::jsonb,
  p_workspace_id uuid default null,
  p_actor_id uuid default null,
  p_priority integer default 100,
  p_run_at timestamptz default now(),
  p_max_attempts integer default 5,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_job_type is null or char_length(btrim(p_job_type)) < 1 or char_length(p_job_type) > 80 then
    raise exception 'Invalid job type' using errcode = 'check_violation';
  end if;
  if p_idempotency_key is not null and char_length(p_idempotency_key) > 200 then
    raise exception 'Idempotency key is too long' using errcode = 'check_violation';
  end if;

  insert into public.job_queue (
    workspace_id, actor_id, job_type, payload, priority, available_at,
    max_attempts, idempotency_key
  )
  values (
    p_workspace_id, p_actor_id, btrim(p_job_type), coalesce(p_payload, '{}'::jsonb),
    greatest(1, least(coalesce(p_priority, 100), 1000)),
    coalesce(p_run_at, now()),
    greatest(1, least(coalesce(p_max_attempts, 5), 20)),
    nullif(btrim(coalesce(p_idempotency_key, '')), '')
  )
  on conflict do nothing
  returning id into v_id;

  if v_id is null and p_idempotency_key is not null then
    select id into v_id
    from public.job_queue
    where job_type = btrim(p_job_type)
      and idempotency_key = btrim(p_idempotency_key)
    limit 1;
  end if;

  return v_id;
end;
$$;

create or replace function public.claim_jobs(
  p_worker_id text,
  p_limit integer default 10,
  p_job_types text[] default null,
  p_lease_seconds integer default 120
)
returns setof public.job_queue
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_worker_id is null or char_length(p_worker_id) < 1 or char_length(p_worker_id) > 120 then
    raise exception 'Invalid worker id' using errcode = 'check_violation';
  end if;

  return query
  with candidates as (
    select id
    from public.job_queue
    where status in ('queued', 'retrying')
      and available_at <= now()
      and (p_job_types is null or job_type = any(p_job_types))
    order by priority asc, available_at asc, created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  )
  update public.job_queue q
     set status = 'processing',
         attempts = q.attempts + 1,
         locked_at = now(),
         locked_by = p_worker_id,
         lease_expires_at = now() + make_interval(secs => greatest(10, least(coalesce(p_lease_seconds, 120), 900))),
         updated_at = now()
    from candidates c
   where q.id = c.id
  returning q.*;
end;
$$;

create or replace function public.complete_job(
  p_job_id uuid,
  p_worker_id text,
  p_result jsonb default null,
  p_result_ref text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  update public.job_queue
     set status = 'completed',
         result = coalesce(p_result, result),
         result_ref = coalesce(p_result_ref, result_ref),
         completed_at = now(),
         locked_at = null,
         locked_by = null,
         lease_expires_at = null,
         last_error = null,
         updated_at = now()
   where id = p_job_id
     and status = 'processing'
     and locked_by = p_worker_id;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function public.fail_job(
  p_job_id uuid,
  p_worker_id text,
  p_error text,
  p_retry_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  update public.job_queue
     set status = case when attempts >= max_attempts then 'dead_lettered' else 'retrying' end,
         available_at = coalesce(p_retry_at, now() + interval '30 seconds'),
         last_error = left(coalesce(p_error, 'unknown'), 2000),
         completed_at = case when attempts >= max_attempts then now() else null end,
         locked_at = null,
         locked_by = null,
         lease_expires_at = null,
         updated_at = now()
   where id = p_job_id
     and status = 'processing'
     and locked_by = p_worker_id
  returning status into v_status;
  return v_status;
end;
$$;

create or replace function public.reap_stale_jobs(p_limit integer default 50)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  update public.job_queue
     set status = case when attempts >= max_attempts then 'dead_lettered' else 'retrying' end,
         available_at = now(),
         last_error = coalesce(last_error, 'worker_lease_expired'),
         completed_at = case when attempts >= max_attempts then now() else null end,
         locked_at = null,
         locked_by = null,
         lease_expires_at = null,
         updated_at = now()
   where id in (
     select id from public.job_queue
     where status = 'processing' and lease_expires_at < now()
     order by lease_expires_at
     limit greatest(1, least(coalesce(p_limit, 50), 500))
     for update skip locked
   );
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

create or replace function public.claim_outbox_events(
  p_worker_id text,
  p_limit integer default 20,
  p_lease_seconds integer default 120
)
returns setof public.outbox_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with candidates as (
    select id
    from public.outbox_events
    where status in ('pending', 'failed')
      and available_at <= now()
    order by created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  update public.outbox_events o
     set status = 'processing',
         attempts = o.attempts + 1,
         locked_at = now(),
         locked_by = p_worker_id,
         lease_expires_at = now() + make_interval(secs => greatest(10, least(coalesce(p_lease_seconds, 120), 900))),
         updated_at = now()
    from candidates c
   where o.id = c.id
  returning o.*;
end;
$$;

create or replace function public.complete_outbox_event(
  p_event_id uuid,
  p_worker_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  update public.outbox_events
     set status = 'delivered',
         delivered_at = now(),
         locked_at = null,
         locked_by = null,
         lease_expires_at = null,
         last_error = null,
         updated_at = now()
   where id = p_event_id
     and status = 'processing'
     and locked_by = p_worker_id;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function public.fail_outbox_event(
  p_event_id uuid,
  p_worker_id text,
  p_error text,
  p_retry_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  update public.outbox_events
     set status = case when attempts >= max_attempts then 'dead_lettered' else 'failed' end,
         available_at = coalesce(p_retry_at, now() + interval '30 seconds'),
         last_error = left(coalesce(p_error, 'unknown'), 2000),
         locked_at = null,
         locked_by = null,
         lease_expires_at = null,
         updated_at = now()
   where id = p_event_id
     and status = 'processing'
     and locked_by = p_worker_id
  returning status into v_status;
  return v_status;
end;
$$;

revoke all on function public.enqueue_job(text, jsonb, uuid, uuid, integer, timestamptz, integer, text)
  from public, anon, authenticated;
revoke all on function public.claim_jobs(text, integer, text[], integer)
  from public, anon, authenticated;
revoke all on function public.complete_job(uuid, text, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.fail_job(uuid, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.reap_stale_jobs(integer)
  from public, anon, authenticated;
revoke all on function public.claim_outbox_events(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_outbox_event(uuid, text)
  from public, anon, authenticated;
revoke all on function public.fail_outbox_event(uuid, text, text, timestamptz)
  from public, anon, authenticated;

grant execute on function public.enqueue_job(text, jsonb, uuid, uuid, integer, timestamptz, integer, text) to service_role;
grant execute on function public.claim_jobs(text, integer, text[], integer) to service_role;
grant execute on function public.complete_job(uuid, text, jsonb, text) to service_role;
grant execute on function public.fail_job(uuid, text, text, timestamptz) to service_role;
grant execute on function public.reap_stale_jobs(integer) to service_role;
grant execute on function public.claim_outbox_events(text, integer, integer) to service_role;
grant execute on function public.complete_outbox_event(uuid, text) to service_role;
grant execute on function public.fail_outbox_event(uuid, text, text, timestamptz) to service_role;

-- ------------------------- high-traffic indexes ----------------------------
create index if not exists transactions_workspace_status_date_idx
  on public.transactions (workspace_id, status, occurred_on desc, created_at desc);
create index if not exists transactions_workspace_cursor_idx
  on public.transactions (workspace_id, occurred_on desc, created_at desc, id desc);
create index if not exists transactions_workspace_category_date_idx
  on public.transactions (workspace_id, category_id, occurred_on desc)
  where category_id is not null;
create index if not exists transactions_workspace_contact_date_idx
  on public.transactions (workspace_id, contact_id, occurred_on desc)
  where contact_id is not null;
create index if not exists ledger_lines_workspace_transaction_idx
  on public.ledger_lines (workspace_id, transaction_id, line_no);
create index if not exists usage_events_workspace_kind_created_idx
  on public.usage_events (workspace_id, kind, created_at desc);

-- ---------------------- payment and subscription outbox ---------------------
create or replace function app.emit_payment_outbox()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'succeeded' and old.status is distinct from new.status then
    insert into public.outbox_events (
      workspace_id, event_type, aggregate_type, aggregate_id, payload, idempotency_key
    )
    values (
      new.workspace_id,
      'payment.succeeded',
      'payment',
      new.id,
      jsonb_build_object(
        'payment_id', new.id,
        'amount_minor', new.amount_minor,
        'currency', new.currency,
        'provider', new.provider
      ),
      'payment:' || new.id::text || ':succeeded'
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_emit_outbox on public.payment_transactions;
create trigger payments_emit_outbox
after update of status on public.payment_transactions
for each row execute function app.emit_payment_outbox();

create or replace function app.emit_subscription_outbox()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.outbox_events (
    workspace_id, event_type, aggregate_type, aggregate_id, payload, idempotency_key
  )
  values (
    new.workspace_id,
    'subscription.changed',
    'subscription',
    new.id,
    jsonb_build_object(
      'subscription_id', new.id,
      'plan', new.plan,
      'status', new.status,
      'current_period_end', new.current_period_end
    ),
    'subscription:' || new.id::text || ':' || new.plan::text || ':' || new.status::text
      || ':' || coalesce(new.current_period_end::text, 'none')
  )
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists subscriptions_emit_outbox on public.subscriptions;
create trigger subscriptions_emit_outbox
after insert or update of plan, status, current_period_end on public.subscriptions
for each row execute function app.emit_subscription_outbox();
