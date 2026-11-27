-- Phase 21: return abandoned outbox deliveries to the queue.
create or replace function public.reap_stale_outbox_events(p_limit integer default 50)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  update public.outbox_events
     set status = case when attempts >= max_attempts then 'dead_lettered' else 'failed' end,
         available_at = now(),
         last_error = coalesce(last_error, 'worker_lease_expired'),
         locked_at = null,
         locked_by = null,
         lease_expires_at = null,
         updated_at = now()
   where id in (
     select id from public.outbox_events
     where status = 'processing' and lease_expires_at < now()
     order by lease_expires_at
     limit greatest(1, least(coalesce(p_limit, 50), 500))
     for update skip locked
   );
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.reap_stale_outbox_events(integer) from public, anon, authenticated;
grant execute on function public.reap_stale_outbox_events(integer) to service_role;
