# KontaFlow load and resilience harness

These scripts are deliberately dependency-free so they can run in CI, on a
laptop, or against a preview deployment without installing k6.

## Profiles

| Profile | Command | Goal |
| --- | --- | --- |
| API readiness (100k) | `node load-tests/run.mjs --path /api/health --requests 100000 --concurrency 250 --max-p95 800` | 100k requests within the 15-minute window while exercising the database readiness query. |
| Marketing/SSR read | `node load-tests/run.mjs --path /en --requests 20000 --concurrency 100 --max-p95 1200` | Warm SSR and CDN-cacheable pages. |
| Authenticated ledger | `node load-tests/run.mjs --path /en/dashboard --cookie "sb-...=..." --requests 10000 --concurrency 100` | Dashboard reads through RLS, entitlements and rollups. |
| Paginated API | `node load-tests/run.mjs --path "/api/transactions?limit=50" --cookie "sb-...=..." --requests 10000 --concurrency 50` | Keyset pagination on a large ledger. |

`--max-p95` makes the command exit non-zero when the latency budget is missed.
`--max-error-rate` defaults to 1%.

The harness prints p50/p95/p99, throughput, status distribution and up to ten
error samples. Save the JSON with `--out load-tests/results/<name>.json` so a
run can be attached to the release record.

## k6 alternative

`load-tests/k6.js` is a constant-VU authenticated dashboard scenario. It uses
the same thresholds and accepts `BASE_URL`, `PATH`, `SESSION_COOKIE`, `VUS` and
`DURATION`.

## What to watch

* `queue.oldest_queued_seconds` from `GET /api/metrics` (authorized) should stay
  under one minute during normal operation.
* `outbox.dead_lettered` should remain zero; inspect the `last_error` column if
  it moves.
* A rising p99 with a stable p50 usually means a lock or provider timeout, not
  raw CPU. Check the queue lease and webhook retry counts.
* Run the database suite (`npm run test:db`) after load tests that write data so
  rollups and idempotency are re-checked against the ledger.
