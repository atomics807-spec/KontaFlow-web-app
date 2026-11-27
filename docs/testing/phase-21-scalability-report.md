# Phase 21 — Scalability, concurrency and reliability report

Date: 2026-11-27
Environment: local Supabase (Postgres 17, Auth, Mailpit), production Next.js
build on Node 24, Playwright Chromium desktop and Pixel 7 emulation.

## Scope

Phase 21 makes the platform ready for enterprise load without weakening the
financial guarantees from earlier phases:

* daily financial rollups instead of full-ledger dashboard scans;
* a durable Postgres job queue and transactional outbox with leases, retries,
  bounded concurrency and dead-lettering;
* a two-layer distributed cache with a stampede lock;
* durable rate-limit decisions with remaining/reset metadata;
* operational metrics, protected metrics/health detail and request ids;
* keyset pagination for the transaction API;
* a dependency-free load harness and a k6 scenario.

Architecture: [../architecture/scalability.md](../architecture/scalability.md).
Operations: [../deployment/scalability-operations.md](../deployment/scalability-operations.md).

## Gates

| Gate | Command | Result |
| --- | --- | --- |
| TypeScript strict | `npm run typecheck` | Pass |
| Unit tests | `npm test` | 28 files, 223 tests passed |
| Database and RLS integration | `npm run test:db` | 376 assertions passed on a fresh DB |
| End-to-end | `npx playwright test` | 25 tests passed (23 desktop, 2 mobile) |
| Mobile E2E | included above | 2 tests passed |
| Lint | `npm run lint` | Pass |
| Production build | `npm run build` | Pass |
| Readiness verifier | `npm run verify:production -- --local` | 15 passed, 0 warnings, 0 failed |
| 100k health requests | `node load-tests/run.mjs ...` | 100,000/100,000 HTTP 200, 0 errors |
| 20k marketing requests | `node load-tests/run.mjs ...` | 20,000/20,000 HTTP 200, 0 errors |
| Authenticated dashboard | `node load-tests/run.mjs ...` | 500/500 HTTP 200, 0 errors |
| Async AI job | manual against local worker | 202 enqueued, job completed, draft left pending |

## Measured results

The harness ran against one local `next start` instance and the local Supabase
stack, not a multi-instance production deployment. Numbers are a regression
baseline, not a production capacity promise.

### `/api/health` — 100,000 requests

| Metric | Result |
| --- | --- |
| Requests | 100,000 |
| Completed | 100,000 |
| Errors | 0 |
| Concurrency | 100 |
| Wall time | 186.2 s (3 min 6 s) |
| Throughput | 536.9 req/s |
| p50 | 180 ms |
| p95 | 228 ms |
| p99 | 258 ms |
| Max | 694 ms |

The health route runs a real Supabase query on every request, so this also
demonstrates sustained database read capacity above 500 req/s from one app
instance. It finishes the 100k target in about 21% of the 15-minute window.

### `/en` — 20,000 requests

| Metric | Result |
| --- | --- |
| Requests | 20,000 |
| Errors | 0 |
| Concurrency | 100 |
| Wall time | 99.9 s |
| Throughput | 200.2 req/s |
| p50 | 493 ms |
| p95 | 592 ms |
| p99 | 674 ms |
| Max | 838 ms |

### Authenticated `/en/dashboard` — 500 requests

A real seeded owner with 300 transactions logged in through Playwright; the
resulting Supabase session cookie was replayed by the harness.

| Metric | Result |
| --- | --- |
| Requests | 500 |
| Errors | 0 |
| Concurrency | 20 |
| Wall time | 20.7 s |
| Throughput | 24.2 req/s |
| p50 | 799 ms |
| p95 | 1,025 ms |
| p99 | 1,082 ms |
| Max | 1,167 ms |

Dashboard rendering is intentionally heavier (RLS reads, entitlements, KPIs,
recent rows, chart data). The rollup-backed summary keeps it under 1.1 s at p99
on the local single instance; horizontal scaling and the entitlement cache are
the levers for higher concurrency.

Raw JSON is in `load-tests/results/phase21-health-100k.json`,
`phase21-marketing-20k.json` and `phase21-dashboard-500.json`.

## Correctness checks added

Database suite (Phase 21 block):

* daily rollup income matches posted ledger;
* daily rollup expense matches posted ledger;
* queue enqueue returns a job id;
* queue idempotency key reuses the job;
* queue claim increments attempts;
* queue complete closes the job;
* queue dead-letters after max attempts;
* transaction writes emit an outbox event;
* cache lock prevents concurrent fills;
* rate-limit v2 returns a decision;
* rate-limit v2 reports remaining capacity.

End-to-end suite (new `e2e/scalability.spec.ts`):

* `/api/health` returns `x-request-id` and operational queue/outbox detail to
  an authorized caller;
* `/api/metrics` returns 401 without a token and 200 with `no-store` when
  authorized;
* `/api/cron/queue-worker` returns 403 without the cron secret;
* `/api/transactions` returns 401 without a session, then paginates a 60-row
  ledger into 25-row pages with no overlap using `nextCursor`.

Async AI smoke test:

1. A Growth workspace sent `POST /api/ai/chat` with `async: true`.
2. The route returned `202 { jobId, poll }`.
3. `POST /api/cron/queue-worker` claimed and completed the job in one attempt.
4. `GET /api/ai/jobs/[id]` returned the assistant reply and a pending command
   with `autoPosted: false`; no transaction was posted before confirmation.
5. Replaying the same `requestId` returned the existing draft without a second
   model call or a second quota event.

Manual queue smoke test:

1. Enqueued `cache.invalidate` for a real workspace.
2. Called `POST /api/cron/queue-worker` with the cron secret.
3. Result: `{"claimed":1,"completed":1,"failed":0,"deadLettered":0}`; the job
   row became `completed` with one attempt.
4. `/api/metrics` reported `queue_claimed_total=1`, `queue_completed_total=1`
   and `queue.completed=1`.
5. `/api/health` and `/api/metrics` both included `x-request-id`/operational
   data and `cache-control: no-store`.

## Security review

* Queue, outbox, cache and operational-stats tables are service-role only; no
  tenant policy can read another workspace's queue rows.
* The cache key is hashed and includes the workspace and authorization scope;
  raw emails and names are not stored in keys.
* `/api/metrics` accepts only `HEALTHCHECK_TOKEN` or `CRON_SECRET`; comparison
  uses the constant-time helper.
* The transaction list API requires a session plus `transactions:read` and
  applies the user-scoped Supabase client, so RLS remains the final authority.
* The sync batch is capped at 256 KiB and 100 items; duplicate client ids inside
  one batch resolve once and cannot race a unique index.
* Cache and queue failures degrade to the loader/local limiter rather than
  bypassing authorization.
* Cron responses and metrics are `no-store`; request ids are random UUIDs and do
  not contain tenant data.

## Defects found and fixed during this phase

* The first 100k harness run targeted the wrong port (3000) and reported fetch
  failures; the harness now requires an explicit `--url` or `LOADTEST_URL` and
  was rerun on the live port.
* The queue smoke test initially used an unquoted `$1` inside a shell-expanded
  Node snippet; the corrected SQL call proved the full claim/complete path.
* The health E2E initially read `checks.operational`; the route returns
  `operational` at the top level. The test now matches the contract.
* The outbox worker had no stale-lease reaper, so a crashed worker could leave
  events in `processing`. Migration 0047 adds `reap_stale_outbox_events`, the
  worker calls it before claiming, and the database suite covers the transition.
* The async AI worker first loaded reference data with a cookie-scoped client
  and attempted the user-scoped confirmation RPC with the service role. It
  failed with "You do not have permission to do that." The reference loader now
  accepts the worker client, and a queued turn never auto-posts; the smoke test
  now returns a pending draft.
* The first worker drain was sequential. Ten 45-second jobs could outlive the
  60-second route limit. The worker now claims ten jobs and runs them with a
  concurrency of ten, while the outbox drains in parallel with a concurrency of
  ten, so every claimed job finishes inside the route budget.
* A retried AI job could call the model and consume quota twice before hitting
  the unique request id. `runAssistant` now returns the existing command for a
  repeated `requestId`, and the insert path recovers from a concurrent unique
  violation.

## Residual risks

* Measurements are from one local instance. Run the harness against staging
  with the production Vercel/Cloudflare topology before a launch game day.
* Dashboard throughput at 20 concurrent users is ~24 req/s per local instance;
  production relies on multiple instances and the entitlement cache. A 100k
  all-dashboard workload is not a target; the 100k target is API/marketing mix.
* `app_cache` is Postgres. It is adequate for entitlement/plan keys but not for
  a very high-churn cache; move to a dedicated store behind the adapter if the
  key volume grows.
* Process metrics are per instance; aggregate them in the log platform.
* The queue is at-least-once and handlers must be idempotent.
* The dashboard cash balance still reads indexed ledger lines; add an
  `account_balances` projection before multi-million-line ledgers.
* Vercel per-minute cron requires a plan that supports it; Cloudflare Cron
  Triggers are the alternative.
