# Operations, monitoring and recovery

## Health checks

`GET /api/health` is the liveness/readiness endpoint. It checks Supabase
connectivity through the service-role client and returns `200` with
`{"status":"ok","checks":{"config":"ok","database":"ok"}}`, or `503` when the database or required configuration is
unavailable. The response is always `no-store`.

When `HEALTHCHECK_TOKEN` is set, send one of:

```bash
curl -H "Authorization: Bearer $HEALTHCHECK_TOKEN" https://app.kontaflow.com/api/health
curl -H "x-healthcheck-token: $HEALTHCHECK_TOKEN" https://app.kontaflow.com/api/health
```

Without the token, the endpoint exposes only status, service, timestamp and
database state. Keep the token in the monitor's secret store.

## Logs and alerts

The app emits one JSON object per line through `src/lib/logger.ts`. Tokens,
cookies, authorization headers and API keys are redacted. Recommended alerts:

| Signal | Threshold | Action |
| --- | --- | --- |
| `/api/health` non-200 | 2 consecutive checks | Page on-call; check Supabase status and recent deploys |
| `level=error` | any burst above baseline | Inspect request id and release SHA |
| `cron.*_failed` | any | Check provider credentials and cron logs |
| `payment.*failed` | repeated for one provider | Switch checkout off with `PAYMENT_MODE=disabled` if needed |
| webhook signature failures | sustained spike | Treat as abuse; check WAF and rotate secrets |
| 5xx rate | > 1% for 5 minutes | Roll back or disable the affected integration |

Vercel: use Log Drains or the dashboard. Cloudflare: use Workers Logs and
observability sampling (already enabled in `wrangler.jsonc`). If Sentry is
enabled, set `SENTRY_DSN` and keep the same redaction rules.

## Backups

- Supabase: enable daily backups and point-in-time recovery for production.
  Record the retention window, region and who can restore.
- Storage: Supabase Storage is backed up with the project. Do not rely on R2 for
  tenant documents; R2 only holds the Next.js incremental cache.
- Configuration: keep `.env.example`, `wrangler.jsonc`, `vercel.json` and this
  runbook in version control. Secrets stay in the platform secret store.
- Before a destructive migration, take an on-demand backup and record the
  migration filename in the change ticket.

## Recovery drill

Run this at least quarterly on staging:

1. Restore the latest production backup into a staging Supabase project.
2. Point a staging deployment at the restored project.
3. Run `APP_ENV=production DEPLOYMENT_TARGET=vercel npm run verify:production`
   with the staging database URL.
4. Sign in, record an income and an expense, open reports and confirm totals.
5. Run the tenant-isolation E2E test against staging.
6. Record the restore duration (RTO) and any data loss window (RPO).

## Incident runbook

1. Declare severity and open an incident channel.
2. Check `/api/health`, platform status pages, recent deployments and cron logs.
3. If the database is unavailable, stop writes by setting the affected
   integration off; do not run migrations during the incident.
4. If a release is the cause, promote the previous Vercel deployment or roll
   back the Cloudflare Worker version. Keep the database forward-compatible.
5. If a provider is compromised, rotate the provider secret, then
   `wrangler secret put` or update Vercel env and redeploy.
6. After recovery, write a short retrospective with timeline, impact, root
   cause, and follow-up owners.
