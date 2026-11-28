# Vercel deployment

KontaFlow uses the standard Next.js runtime on Vercel. No Vercel SDK, KV, Blob
or Postgres product is imported by application code. Platform-specific values
are read in `src/lib/platform/deployment.ts` and surfaced by `/api/health`.

## Project settings

| Setting | Value |
| --- | --- |
| Framework preset | Next.js |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output | Next.js default (`.next`) |
| Node.js | 20.9 or newer |
| Region | `cdg1` (Paris) for Cameroon and West/Central Africa |
| Root directory | repository root |

`vercel.json` pins the install/build commands, region and cron schedules:

```json
{
  "framework": "nextjs",
  "installCommand": "npm ci",
  "buildCommand": "npm run build",
  "regions": ["cdg1"],
  "crons": [
    { "path": "/api/cron/queue-worker", "schedule": "0 2 * * *" },
    { "path": "/api/cron/daily-digest", "schedule": "0 20 * * *" },
    { "path": "/api/cron/trial-reminders", "schedule": "0 8 * * *" },
    { "path": "/api/cron/payment-reconciliation", "schedule": "0 3 * * *" }
  ]
}
```

## Environment variables

Create the values in **Project → Settings → Environment Variables**. Use
separate values for Production, Preview and Development. The full list and
comments are in `.env.example`; the minimum production set is:

| Group | Variables |
| --- | --- |
| Application | `NEXT_PUBLIC_APP_URL`, `APP_ENV=production`, `DEPLOYMENT_TARGET=vercel`, `APP_VERSION` |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` (for migrations/checks only) |
| Auth/OTP | `OTP_HMAC_SECRET`, `SMS_PROVIDER=africastalking`, `AFRICASTALKING_*` |
| Email | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` |
| AI | `OPENAI_API_KEY`, `OPENAI_MODEL`, optional `OPENAI_BASE_URL` |
| Cron | `CRON_SECRET` (at least 32 random bytes), `HEALTHCHECK_TOKEN` |
| USSD | `USSD_SERVICE_CODE`, `USSD_CALLBACK_TOKEN`, `USSD_SESSION_TTL_SECONDS` |
| WhatsApp | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_GRAPH_VERSION` |
| Payments | `PAYMENT_MODE`, `PAYMENT_PROVIDER` and the matching MTN/Orange/aggregator credentials |
| Security | `TRUSTED_ORIGINS` if a proxy rewrites the host, `SESSION_COOKIE_MAX_AGE_SECONDS`, rate-limit values |

`NEXT_PUBLIC_*` values are embedded at build time. Changing one requires a new
deployment, not just a restart. Server-only values are read at request time.

Never put the service-role key in a `NEXT_PUBLIC_*` variable.

## Domains and SSL

1. Add `kontaflow.com` and `www.kontaflow.com` in **Project → Settings →
   Domains**.
2. Create the DNS records Vercel shows. If DNS is on Cloudflare, keep the proxy
   enabled for WAF/TLS and set SSL mode to **Full (strict)**.
3. Redirect `www` to the apex, or the reverse, but keep one canonical origin in
   `NEXT_PUBLIC_APP_URL`.
4. Vercel provisions and renews the TLS certificate automatically. The app also
   sends HSTS (`max-age=63072000; includeSubDomains; preload`) and a strict CSP.
5. Add the final URLs to Supabase **Authentication → URL Configuration**:
   - Site URL: `https://app.kontaflow.com`
   - Redirect URLs: `https://app.kontaflow.com/auth/callback`,
     `https://app.kontaflow.com/*/reset-password`, and the preview wildcard if
     preview auth is required.

## Production deployment

1. Run `npm run db:push` against the production `SUPABASE_DB_URL` from a trusted
   machine or CI job. Migrations are forward-only.
2. Run `npm run verify:production` with production environment variables.
3. Push the release commit to the production branch. Vercel builds and deploys.
4. Check `GET /api/health` with the health token and confirm
   `{"status":"ok","checks":{"config":"ok","database":"ok"}}`.
5. Run the post-deploy smoke test in [deployment.md](deployment.md).

## Preview deployments

- Every pull request gets a preview URL. Use a separate Supabase project or a
  dedicated preview workspace; never point previews at production data.
- Set preview-only `NEXT_PUBLIC_APP_URL` to the preview origin and add it to
  Supabase redirect URLs. If Vercel previews use a changing host, use the
  project's stable preview domain or set `TRUSTED_ORIGINS`.
- Preview cron jobs do not run by default on Vercel. Trigger the routes manually
  with `Authorization: Bearer $CRON_SECRET` when testing.
- Protect preview deployments with Vercel Authentication. Automation that must
  reach a protected preview needs a Protection Bypass secret.

## Cron and background jobs

Vercel sends `Authorization: Bearer $CRON_SECRET` to cron routes when the
environment variable exists. The routes reject any other caller.

| Route | Hobby schedule (daily UTC) | Purpose |
| --- | --- | --- |
| `/api/cron/queue-worker` | `0 2 * * *` | Drains the durable queue and outbox once per day |
| `/api/cron/daily-digest` | `0 20 * * *` | Sends daily closes at 21:00 Africa/Douala; retries for two days |
| `/api/cron/trial-reminders` | `0 8 * * *` | Expires finished trials and sends 7/3/1-day reminders |
| `/api/cron/payment-reconciliation` | `0 3 * * *` | Reconciles missed provider callbacks once per day |

`vercel.json` uses daily schedules so the project deploys on the Vercel Hobby
plan. Vercel Hobby only allows once-per-day cron expressions.

Trade-offs on Hobby:

- async AI jobs and outbox rows can wait until the next 02:00 UTC queue drain;
- payment reconciliation is a daily safety net, so provider webhooks are the
  fast path;
- the digest runs at 20:00 UTC, which is 21:00 in Africa/Douala. Workspaces in
  other timezones may not match the 21:00 local window.

For per-minute queue draining, five-minute payment reconciliation and hourly
digests, use Vercel Pro or the Cloudflare cron worker. The Cloudflare cron
worker keeps the original finer-grained schedules. All routes declare
`runtime = "nodejs"` and `maxDuration = 60`.

## Monitoring

- Uptime: poll `GET /api/health` every minute with
  `Authorization: Bearer $HEALTHCHECK_TOKEN`. Treat any non-200 as a page.
- Logs: Vercel captures structured JSON from `src/lib/logger.ts`. Alert on
  `level=error`, `cron.*_failed`, `payment.*failed` and webhook signature
  failures.
- Release correlation: set `APP_VERSION` to the commit SHA. Vercel also exposes
  `VERCEL_GIT_COMMIT_SHA`, which the health adapter falls back to.
- Errors: send `SENTRY_DSN` to your Sentry project once the adapter is enabled;
  the app already redacts tokens, cookies and authorization headers.
- Analytics: use Vercel Web Analytics only after the privacy review. The product
  currently makes no third-party behavioural tracking calls.

## Rollback

Promote the previous deployment in Vercel. Do not roll back database migrations
blindly: the schema is forward-only. If a release is incompatible with the old
code, ship a forward fix or a new migration instead of reverting the database.
