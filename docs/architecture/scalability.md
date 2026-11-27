# Scalability architecture

KontaFlow is a multi-tenant bookkeeping system, so scaling cannot be reduced to
adding app instances. The database must keep tenant isolation, every financial
write must stay atomic, and the dashboard must not scan a multi-year ledger on
each page view. This document describes the read, write, background and
observability paths added in Phase 21.

## Read path

### Daily financial rollups

`workspace_daily_financials` stores one row per workspace, day and currency with
`income_minor`, `expense_minor`, `net_minor` and a transaction count. A delta
trigger on `transactions` keeps the row in sync on insert, update and void. The
rollup is derived data: the posted ledger remains the source of truth.

`get_dashboard_summary` (migration 0045) reads the rollup for period totals and
the monthly series. The cash balance still reads `ledger_entries` because it
must reflect account-level postings. Indexes on
`(workspace_id, occurred_on desc, created_at desc)` support both paths.

Why this shape:

* dashboards and reports stop growing with ledger size;
* voids and edits update a single small row instead of rescanning history;
* the rollup can be rebuilt from the ledger, so a trigger bug is recoverable.

### Two-layer cache

`src/lib/cache/distributed.ts` combines:

* **L1** - a short-lived in-process map for repeated reads in one instance;
* **L2** - `app_cache` in Postgres for cross-instance reuse.

Keys are hashed with SHA-256 and include the workspace and authorization scope.
The cache stores JSON, never raw personal data in the key. A failed L2 read is a
cache miss, not an error. Writes use `cache_set`; invalidation uses
`cache_delete_workspace` and is also emitted through the outbox so every
instance converges.

A stampede lock (`acquire_cache_lock`) lets one worker fill a hot key while
others wait briefly and then fall back to the loader. Locks expire, so a crashed
holder cannot block a key forever.

### Keyset pagination

`GET /api/transactions` uses `listTransactionsPage()` with a cursor containing
the last `(occurred_on, created_at, id)`. It never uses `OFFSET`, so page 500
costs the same as page 1 and concurrent inserts cannot duplicate rows across
pages. The cursor is base64url JSON, bounded to 100 rows per request, and every
filter is applied before the keyset predicate.

## Write path

A transaction is posted by `record_transaction`, which writes the transaction,
its balanced ledger lines, the rollup delta and an audit record in one database
transaction. The same transaction inserts an `outbox_events` row. The outbox is
the only reliable way to trigger side effects without a distributed
transaction: if the commit succeeds, the event exists; if it rolls back, no
event exists.

`enqueue_job` is used for work that is not part of the financial commit, such as
an asynchronous AI turn or an email. It accepts an idempotency key, so a retried
request returns the existing job instead of duplicating work.

## Queue and outbox

Both use Postgres `FOR UPDATE SKIP LOCKED`:

1. A worker claims up to N rows and sets `status = processing`, `locked_by` and
   `lease_expires_at`.
2. The handler runs with a 45-second application timeout.
3. `complete_job` closes the row; `fail_job` retries with exponential backoff
   (capped at 300 seconds) or dead-letters after `max_attempts`.
4. `reap_stale_jobs` and `reap_stale_outbox_events` return rows whose lease
   expired to the queue. This covers a killed process, not just a thrown error.

Delivery is at-least-once. Handlers must be idempotent. The AI handler creates a
pending draft and never posts it from the worker; the confirmation RPC is
user-scoped and must run with the owner's session.

The worker is invoked by `/api/cron/queue-worker`. Vercel Cron, a Cloudflare
Cron Trigger, or `npm run queue:work` in a container can call it. The endpoint
requires `CRON_SECRET` and is safe to call when the queue is empty.

## Rate limiting

`consumeRateLimitDetailed` checks the local fixed window first, then the shared
Postgres bucket (`consume_security_rate_limit_v2`). The local layer keeps the
process protected if the database is briefly unavailable; the database layer
makes the limit hold across instances. Responses include
`retry-after`, `x-ratelimit-limit`, `x-ratelimit-remaining` and
`x-ratelimit-reset`.

## Async AI

`POST /api/ai/chat` with `{ "async": true }` enqueues an `ai.bookkeeping` job and
returns `202 { jobId, poll }`. The worker calls `runAssistant` with the
service-role client, loads workspace reference data through that same client,
and returns a pending draft. `GET /api/ai/jobs/[id]` lets the owner poll; it
checks both `actor_id` and `workspace_id` before returning a result.

A queued turn is never auto-posted. This is deliberate: the confirmation RPC
requires the owner's `auth.uid()`, and silently posting from a background worker
would bypass the review step that the product promises.

## Observability

`src/lib/observability/metrics.ts` keeps process counters and histograms.
`/api/metrics` exposes them with a protected token and `no-store`; `/api/health`
adds queue, outbox and cache depth when the caller is authorized. `x-request-id`
is generated (or propagated) by the proxy and included in logs and responses.
Metrics are per instance; aggregate them in the log platform.

## Scaling path

* **App tier**: stateless Next.js instances behind Vercel or Cloudflare. The
  proxy, auth cookies and cache adapter have no instance affinity.
* **Database**: Supabase Postgres. Add read replicas only for read-only
  analytics after measuring; writes stay on the primary.
* **Queue**: one cron invocation can claim 10 jobs and run 10 handlers concurrently; add more frequent
  invocations or dedicated workers as backlog grows. Leases make parallel
  workers safe.
* **Cache**: Postgres L2 is enough for plan/entitlement keys. If key volume
  grows, replace `app_cache` behind the existing adapter with Redis or
  Cloudflare KV without changing callers.
* **Reports**: exports are CPU-heavy. Move them to a queue handler before
  raising concurrency; the current route is intentionally synchronous.

## Known limits

* Cash balance still reads indexed ledger lines; add an `account_balances`
  projection before multi-million-line ledgers.
* Rollups are per currency. A workspace with mixed currencies needs a
  currency-aware summary before enabling that workflow.
* `app_cache` is not a high-churn cache; it is a correctness-first shared cache.
* The queue is at-least-once; a handler that is not idempotent will duplicate
  side effects.
* Process metrics disappear on restart; export them to durable storage for
  capacity planning.

See [the operations runbook](../deployment/scalability-operations.md) and the
[Phase 21 report](../testing/phase-21-scalability-report.md).
