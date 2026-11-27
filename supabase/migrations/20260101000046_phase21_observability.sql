-- =============================================================================
-- KontaFlow · 0046 — operational metrics for queue, outbox and cache
-- =============================================================================

create or replace function public.get_operational_stats()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'queue', jsonb_build_object(
      'queued', (select count(*) from public.job_queue where status in ('queued', 'retrying')),
      'processing', (select count(*) from public.job_queue where status = 'processing'),
      'completed', (select count(*) from public.job_queue where status = 'completed'),
      'failed', (select count(*) from public.job_queue where status = 'failed'),
      'dead_lettered', (select count(*) from public.job_queue where status = 'dead_lettered'),
      'oldest_queued_seconds', coalesce((
        select extract(epoch from (now() - min(created_at)))::integer
        from public.job_queue
        where status in ('queued', 'retrying')
      ), 0)
    ),
    'outbox', jsonb_build_object(
      'pending', (select count(*) from public.outbox_events where status in ('pending', 'failed')),
      'processing', (select count(*) from public.outbox_events where status = 'processing'),
      'dead_lettered', (select count(*) from public.outbox_events where status = 'dead_lettered')
    ),
    'cache', jsonb_build_object(
      'entries', (select count(*) from public.app_cache),
      'expired', (select count(*) from public.app_cache where expires_at <= now())
    )
  );
$$;

revoke all on function public.get_operational_stats() from public, anon, authenticated;
grant execute on function public.get_operational_stats() to service_role;
