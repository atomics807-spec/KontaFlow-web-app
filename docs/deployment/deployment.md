# Deployment guide

KontaFlow runs unchanged on Vercel (Node runtime) and Cloudflare Workers
(OpenNext). Configuration comes from environment variables. Platform-specific
values are read only in `src/lib/platform/deployment.ts`; application code does
not import a Vercel or Cloudflare SDK.

Detailed platform guides:

- [Vercel](vercel.md)
- [Cloudflare Workers](cloudflare.md)
- [Production checklist](production-checklist.md)
- [Operations, monitoring and recovery](operations.md)

## Pre-flight

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run test:db
npm run test:e2e
npm run build
```

`npm run test:db` needs a disposable Postgres database. `npm run test:e2e`
builds and starts the production server on port 3000; stop `next dev` first.

## Environment

Set every variable from `.env.example`. The minimum for a working app:

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Canonical HTTPS origin, no trailing slash |
| `APP_ENV` | `development`, `preview` or `production` |
| `DEPLOYMENT_TARGET` | `local`, `node`, `vercel` or `cloudflare` |
| `APP_VERSION` | Release SHA for log and health correlation |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public client config |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only; required by USSD, WhatsApp and cron |
| `SUPABASE_DB_URL` | Direct Postgres URL for migrations and `verify:production`; never expose to the browser |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Invitations, trial reminders and scheduled reports |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Assistant; omit to disable cleanly |
| `CRON_SECRET` | Bearer token for `/api/cron/*` |
| `HEALTHCHECK_TOKEN` | Optional bearer token for `/api/health` |
| `SMS_PROVIDER=africastalking` + `AFRICASTALKING_*` | Phone OTP; `none` blocks onboarding, `console` is local-only |
| `OTP_HMAC_SECRET` | Dedicated 32-byte secret; do not reuse the service-role key |
| `USSD_SERVICE_CODE`, `USSD_CALLBACK_TOKEN` | Africa's Talking callback |
| `WHATSAPP_*` | Phone number id, access token, verify token, app secret, templates |
| `PAYMENT_MODE` | `disabled` (default), `sandbox` or `production` |
| `PAYMENT_PROVIDER` | Optional allow-list: `none`, `mtn-momo`, `orange-money`, `aggregator` |
| `MTN_MOMO_*`, `ORANGE_MONEY_*`, `PAYMENT_AGGREGATOR_*` | Provider credentials and callback secrets |
| `TRUSTED_ORIGINS` | Extra origins allowed to call Server Actions; keep empty on one custom domain |
| `SESSION_COOKIE_MAX_AGE_SECONDS` | Browser session cap, default seven days |
| `RATE_LIMIT_*` | Durable per-minute caps |
| `MALWARE_SCAN_MODE`, `MALWARE_SCAN_URL`, `MALWARE_SCAN_API_KEY` | Optional upload scanner |

Security-sensitive values added in Phase 18:

| Variable | Production guidance |
| --- | --- |
| `TRUSTED_ORIGINS` | Comma-separated extra origins allowed to invoke Server Actions. Preview proxies that rewrite the Host header need their public host listed. |
| `SESSION_COOKIE_MAX_AGE_SECONDS` | Lower it for high-risk tenants. |
| `MALWARE_SCAN_MODE` | Use `enforce` once a scanner is contracted. |
| `MALWARE_SCAN_URL`, `MALWARE_SCAN_API_KEY` | Scanner endpoint and bearer token. Server-only. |
| `RATE_LIMIT_AI_PER_MINUTE`, `RATE_LIMIT_UPLOAD_PER_MINUTE`, `RATE_LIMIT_SYNC_PER_MINUTE`, `RATE_LIMIT_EXPORT_PER_MINUTE` | Tune per plan and monitor `security_events`. |

Never commit `.env.local`, `.env.production` or `.dev.vars`. Vercel stores
encrypted environment variables per environment; Cloudflare uses
`wrangler secret put` or the dashboard.

For a local preview where Supabase runs beside the app, set
`SUPABASE_INTERNAL_URL=http://127.0.0.1:54321` and
`NEXT_PUBLIC_SUPABASE_URL=<preview-origin>/api/supabase`. The same-origin
gateway keeps browser auth calls on the preview host. Hosted deployments should
leave `SUPABASE_INTERNAL_URL` unset.

## Database rollout

1. Take a backup or confirm PITR before applying migrations.
2. Apply migrations with `supabase db push` (or `npm run db:push` against
   `SUPABASE_DB_URL`). Migrations are forward-only; never edit a shipped file.
3. Verify:
   - `npm run verify:production` reports every migration applied.
   - RLS is enabled on every public table.
   - `platform_settings` and `security_rate_limits` are not selectable by
     `authenticated`.
   - All storage buckets are private and workspace logos reject SVG.
   - `record_channel_transaction` and `expire_trials` are not executable by
     `authenticated`.
4. Run the database integration suite against a disposable database:
   `npm run test:db`.

## Vercel

1. Import the repository. The preset is Next.js; `vercel.json` sets `npm ci`,
   `npm run build`, region `cdg1` and the cron schedules.
2. Add environment variables for Production and Preview. Set
   `APP_ENV=production`, `DEPLOYMENT_TARGET=vercel` and `APP_VERSION` for the
   production environment.
3. Add the custom domain and DNS records. Keep one canonical origin in
   `NEXT_PUBLIC_APP_URL`. Vercel provisions TLS automatically.
4. Add the origin and `/auth/callback` to Supabase Auth URL Configuration.
5. Deploy. Route handlers run on the Node runtime for `node:crypto` HMAC
   verification and the Supabase SDK.
6. Confirm `GET /api/health` returns 200 and check the cron logs.

The digest job runs hourly and processes workspaces whose local hour is 21:00.
It reads each member's `report_preferences`; daily closes go out every day,
weekly reports on Sunday and monthly reports on the last day of the month.
Delivery is recorded per recipient and channel in `report_deliveries`, which
keeps the job idempotent and retries failed channels for two days.

The trial reminder job expires finished trials, sends the configured 7/3/1-day
emails and writes one reminder log row per workspace per interval. Vercel sends
`Authorization: Bearer $CRON_SECRET` automatically when the variable is set.

The payment reconciliation job polls pending and processing payments younger
than seven days and settles or expires them. Provider callbacks remain the fast
path; the cron is the safety net. Three cron jobs and a five-minute schedule need
a Vercel plan that allows them; otherwise use the Cloudflare cron worker or
accept a slower fallback.

See [vercel.md](vercel.md) for preview deployments, monitoring and rollback.

## Cloudflare

OpenNext compiles the same Next.js app to a Worker with static assets in R2/KV
bindings generated by the adapter.

```bash
npx wrangler r2 bucket create kontaflow-next-cache
npm run preview:cloudflare
npm run deploy:cloudflare
npm run deploy:cron:cloudflare
```

1. `wrangler.jsonc` configures `nodejs_compat`, the `ASSETS` binding,
   `WORKER_SELF_REFERENCE`, the R2 incremental cache and the Images binding.
2. Add secrets with `wrangler secret put` (see [cloudflare.md](cloudflare.md)).
3. Add the custom domain in Cloudflare and set SSL/TLS to Full (strict).
4. Deploy the separate cron Worker so the OpenNext Worker does not need a
   `scheduled()` handler. It calls the same authenticated routes with
   `CRON_SECRET`.
5. Edge caching: keep HTML on `no-store` (dynamic, per-tenant); static assets
   under `/_next/static`, `/icons` and `/fonts` are cached by `public/_headers`.

### Portability notes

- No Vercel KV/Blob/Postgres or `@vercel/*` imports.
- `next/image` uses the Cloudflare `IMAGES` binding; use explicit dimensions.
- File uploads go to Supabase Storage, not the platform filesystem.
- `nodejs_compat` supplies `node:crypto`; do not add filesystem or native
  modules to request paths.
- Long-running jobs are avoided; the digest processes at most 200 workspaces per
  invocation and can be sharded with an env-driven offset.
- Worker size limit: 3 MiB compressed on Free, 10 MiB on Paid. The current
  bundle is about 3.8 MiB gzipped, so use the Workers Paid plan.

## Post-deploy smoke test

1. Sign up, confirm email, receive the SMS code, verify the phone, complete
   onboarding → dashboard loads. Without a working SMS provider the phone gate
   blocks workspace creation by design.
2. Record income and expense; dashboard and reports reflect them.
3. Invite a teammate, accept the link in a private window, verify isolation in
   the new session.
4. `GET /api/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=ok`
   returns `ok`; a signed POST reaches the assistant.
5. `curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/daily-digest`
   and `/api/cron/trial-reminders` return `{ "processed": n, ... }`.
6. `GET /api/health` returns 200 with `checks.database=ok`; response headers
   include CSP and HSTS.
7. `GET /api/privacy/export` returns JSON with `cache-control: no-store` and only
   the signed-in user's workspace data.
8. A cross-origin POST to `/api/ai/chat` or `/api/sync` is rejected with 403.
9. `select count(*) from security_rate_limits` as `authenticated` fails with
   `42501`; the same query as `service_role` succeeds.
10. `security_events` contains `auth.signed_up` after a test registration and is
    not readable by a tenant account.
11. `MALWARE_SCAN_MODE=enforce` blocks uploads when the scanner is unreachable.
12. Switch language EN → FR → PCM and confirm the page and email templates use
    the selected locale.
13. Put the browser offline, record a transaction, reconnect and confirm it
    syncs exactly once.
14. Open the app on a phone, verify navigation, PWA install and offline capture.
15. End a test subscription and confirm the ledger becomes read-only.

## Go-live gate

Complete [production-checklist.md](production-checklist.md). Do not declare the
system ready until every operator item is checked and signed off.
