# Scalability operations runbook

This runbook covers the Phase 21 queue, cache, rollups, metrics and load tests.
It assumes the production database has migrations 0044-0047 applied.

## Scheduled workers

The queue worker is a normal protected route:

```
POST /api/cron/queue-worker
Authorization: Bearer $CRON_SECRET
```

It reaps stale leases, drains up to 10 jobs and 50 outbox events (10 job handlers run concurrently), and returns:

```json
{ "claimed": 1, "completed": 1, "failed": 0, "deadLettered": 0,
  "outboxDelivered": 3, "outboxFailed": 0 }
```

Recommended cadence: every minute. The work is bounded, so a missed run simply
leaves jobs for the next one.

### Vercel

`vercel.json` includes a `queue-worker` cron. On the Vercel Hobby plan it runs
once daily at `0 2 * * *`; async jobs and outbox rows can wait until that drain.
Use Vercel Pro, the Cloudflare cron worker, or an external scheduler for
per-minute draining. Keep `CRON_SECRET` set in the project environment.

### Cloudflare

`workers/cron-trigger` calls the same route with the same secret. Its
`wrangler.jsonc` includes the queue-worker schedule. Deploy it after the main
Worker and set `APP_URL` plus `CRON_SECRET` as Worker secrets.

### Container or VM

```bash
APP_URL=https://app.example.com CRON_SECRET=... npm run queue:work
```

The process polls once per interval and exits cleanly on SIGTERM.

## Health and metrics

* `GET /api/health` - liveness/readiness; returns `checks.database` and, for an
  authorized caller, `operational` queue/outbox/cache counts.
* `GET /api/metrics` - JSON counters, histograms and operational stats;
  `cache-control: no-store`.
* Both accept `Authorization: Bearer $HEALTHCHECK_TOKEN`; metrics also accepts
  `$CRON_SECRET`.

Suggested alerts:

| Signal | Warning | Critical |
| --- | --- | --- |
| `operational.queue.oldest_queued_seconds` | > 300 | > 900 |
| `operational.queue.dead_lettered` | > 0 | > 10 |
| `operational.outbox.pending` | > 500 for 10 min | > 5,000 |
| `operational.outbox.dead_lettered` | > 0 | > 10 |
| `/api/health` non-200 for 2 min | page | page |
| `queue_job_duration_ms` p95 | > 20 s | > 40 s |

Counters are per process. Sum across instances or scrape the log platform; do
not treat one instance's counter as the global total.

## Queue backlog

1. Check `operational.queue` and `operational.outbox`.
2. Confirm the cron is running and `CRON_SECRET` is valid.
3. Call the worker manually and inspect the response. `claimed > 0` and
   `completed = 0` means a handler is failing.
4. Read the failed job:

```sql
select id, job_type, status, attempts, last_error, available_at
from job_queue
where status in ('failed', 'retrying', 'dead_lettered')
order by updated_at desc
limit 20;
```

5. Fix the handler or data, then requeue a dead letter explicitly:

```sql
update job_queue
set status = 'queued', attempts = 0, available_at = now(),
    locked_at = null, locked_by = null, lease_expires_at = null,
    last_error = null, updated_at = now()
where id = '<job-id>';
```

Never mass-requeue a dead letter without understanding the error; a poisoned
payload will simply dead-letter again.

## Outbox backlog

The outbox delivers cache invalidations and integration events. Pending rows
are normal after a busy period; a monotonically growing count is not.

```sql
select event_type, status, count(*)
from outbox_events
group by 1, 2
order by 1, 2;
```

If rows are stuck in `processing`, the worker crashed. The next worker call
reaps expired leases. If they are `dead_lettered`, fix the consumer and reset
`attempts`/`status` as above.

## Cache

* `operational.cache.entries` is the shared row count.
* `operational.cache.expired` counts rows past `expires_at`; they are ignored
  and can be deleted in a maintenance job.
* To invalidate one tenant after a manual data fix:

```sql
select public.cache_delete_workspace('<workspace-id>');
```

* A hot key with a stuck lock is safe: locks expire. To force-release:

```sql
select public.release_cache_lock('<key>', '<owner>');
```

The cache is derived data. Clearing `app_cache` only costs latency, never
correctness.

## Rollups

Verify the rollup against the ledger:

```sql
select workspace_id, day,
       income_minor, expense_minor,
       (select coalesce(sum(amount_minor), 0) from transactions t
        where t.workspace_id = f.workspace_id and t.kind = 'income'
          and t.status = 'posted' and t.occurred_on = f.day) as ledger_income
from workspace_daily_financials f
where workspace_id = '<workspace-id>'
order by day desc
limit 30;
```

If a row is wrong, rebuild it from the ledger:

```sql
delete from workspace_daily_financials where workspace_id = '<workspace-id>';
insert into workspace_daily_financials (workspace_id, day, currency, income_minor, expense_minor, net_minor, transaction_count)
select workspace_id, occurred_on, currency,
       sum(case when kind = 'income' then amount_minor else 0 end),
       sum(case when kind = 'expense' then amount_minor else 0 end),
       sum(case when kind = 'income' then amount_minor else -amount_minor end),
       count(*)
from transactions
where workspace_id = '<workspace-id>' and status = 'posted'
group by workspace_id, occurred_on, currency;
```

The rebuild is safe while writes continue only if the trigger is disabled for
the affected rows; for a live incident, prefer a maintenance window or rebuild
the specific days after the write burst.

## Load tests

```bash
# public health endpoint, 100k requests
node load-tests/run.mjs --url https://app.example.com/api/health --requests 100000 --concurrency 100

# public marketing page, 20k requests
node load-tests/run.mjs --url https://app.example.com/en --requests 20000 --concurrency 100

# authenticated dashboard, 500 requests
node load-tests/run.mjs --url https://app.example.com/en/dashboard \
  --cookie-file /secure/cookies.txt --requests 500 --concurrency 20

# k6 alternative
k6 run -e BASE_URL=https://app.example.com load-tests/k6.js
```

Run from a network location close to users, not from the app host. Record the
commit, database size, instance count and provider. Compare p95/p99, not just
throughput. A 0% error rate at low concurrency is not evidence of capacity.

## Incident checklist

1. Is `/api/health` 200? If not, check database connectivity and migrations.
2. Is the queue cron running? Check the scheduler's last run and response.
3. Is the outbox growing? Check consumer errors and dead letters.
4. Is the cache serving stale data? Invalidate the workspace and confirm the
   outbox event was delivered.
5. Is a report export slow? Check CPU and move exports to the queue before
   adding instances.
6. Is a tenant seeing another tenant's data? Treat as a security incident:
   disable the route, preserve logs, and follow
   [incident-response.md](../security/incident-response.md).
