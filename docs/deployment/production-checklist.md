# Production readiness checklist

This is the go/no-go list for a production launch. Items marked **repo-verified**
have automated evidence in this repository. Items marked **operator** require
access to Vercel/Cloudflare, Supabase, the provider consoles or DNS; they cannot
be completed by a code commit alone.

Run the automated checks first:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run test:db
npm run test:e2e
npm run build
APP_ENV=production DEPLOYMENT_TARGET=vercel npm run verify:production
```

`npm run verify:production` is read-only. Use `-- --local` to check a local
database without production provider gates.

## Platform and data

| Item | Evidence / action | Status |
| --- | --- | --- |
| Database migrations applied | `npm run db:push`; `verify:production` reports every migration applied | Repo-verified locally (43 migrations) |
| RLS enabled | `npm run test:db` (362 assertions) and `verify:production` RLS query | Repo-verified locally |
| Tenant isolation | `e2e/security.spec.ts`; `npm run test:db` | Repo-verified |
| Service-only tables | `verify:production` checks `platform_settings` and `security_rate_limits` are not selectable by `authenticated` | Repo-verified locally |
| Storage buckets private | `verify:production` checks all buckets and SVG rejection | Repo-verified locally |
| Backup enabled | Supabase plan with daily backups and PITR; record retention and region | Operator |
| Restore tested | Restore a snapshot into a staging project, run `verify:production` and the smoke test | Operator |
| Migration rollback plan | Forward-only migrations; rehearse a forward fix on staging | Operator |

## Authentication and domains

| Item | Evidence / action | Status |
| --- | --- | --- |
| Production origin | `NEXT_PUBLIC_APP_URL=https://app.kontaflow.com` | Operator |
| Supabase Site URL | Authentication → URL Configuration → Site URL | Operator |
| Supabase redirect allow-list | `/auth/callback`, `/*/reset-password`, invitation URLs, preview origin if used | Operator |
| Email templates | Confirm signup, recovery, invite and trial reminder links use the production origin | Operator |
| Custom domain | Apex and `www` added; one canonical redirect | Operator |
| SSL/TLS | Vercel automatic certificate or Cloudflare Full (strict); HSTS header present | Operator + repo header |
| Preview auth | Preview Supabase project and preview redirect URLs; no production data | Operator |
| Session cookie policy | `SESSION_COOKIE_MAX_AGE_SECONDS` reviewed | Operator |

## Providers

| Item | Evidence / action | Status |
| --- | --- | --- |
| Email (Resend) | `RESEND_API_KEY`, verified sender domain, `EMAIL_FROM`, `EMAIL_REPLY_TO`; send a real test | Operator |
| SMS OTP (Africa's Talking) | `SMS_PROVIDER=africastalking`, username/API key/sender; receive a real OTP | Operator |
| OTP secret | `OTP_HMAC_SECRET` at least 32 bytes and different from the service-role key | Repo check + operator value |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_MODEL`; run a staging prompt evaluation | Operator |
| MTN MoMo | Production/sandbox base URL, subscription key, API user/key, callback URL | Operator |
| Orange Money | Client id/secret, merchant key, return/cancel URLs | Operator |
| Aggregator | Base URL, API key, webhook secret, create/status paths | Operator |
| Payment mode | `PAYMENT_MODE=production` only after provider certification | Operator |
| USSD | Short code, `USSD_CALLBACK_TOKEN`, callback URL registered with Africa's Talking | Operator |
| WhatsApp | Phone number id, access token, verify token, app secret, approved templates | Operator |
| Webhooks | Signed test callbacks for payments, USSD and WhatsApp return expected status | Operator |
| Cron secret | `CRON_SECRET` at least 32 random bytes | Repo check + operator value |

## Scheduled jobs

| Job | Vercel | Cloudflare | Status |
| --- | --- | --- | --- |
| Daily digest | `vercel.json` hourly `0 * * * *` | `workers/cron-trigger` hourly | Repo config; operator deploy |
| Trial reminders | `vercel.json` `0 8 * * *` | `workers/cron-trigger` `0 8 * * *` | Repo config; operator deploy |
| Payment reconciliation | `vercel.json` `*/5 * * * *` | `workers/cron-trigger` `*/5 * * * *` | Repo config; operator deploy |

Confirm at least one successful run in platform logs. The routes require
`Authorization: Bearer $CRON_SECRET` and return non-200 on failure.

## Observability

| Item | Evidence / action | Status |
| --- | --- | --- |
| Health endpoint | `GET /api/health` returns `200` and `checks.database=ok` | Repo-verified locally |
| Protected health check | `HEALTHCHECK_TOKEN` set; unauthenticated request returns 401 | Operator |
| Uptime monitor | Poll `/api/health` every minute from an external monitor | Operator |
| Error alerting | Alert on `level=error`, cron failures and webhook signature failures | Operator |
| Structured logs | JSON logs from `src/lib/logger.ts` reach the platform log sink | Operator |
| Release correlation | `APP_VERSION` set to commit SHA | Operator |
| Sentry | `SENTRY_DSN` configured if error tracking is required | Operator |
| Analytics | Vercel Web Analytics or Cloudflare Web Analytics enabled only after privacy review | Operator |

## Functional launch tests

| Test | Evidence | Status |
| --- | --- | --- |
| Registration, email, phone OTP, onboarding | `e2e/auth.spec.ts` | Repo-verified |
| Income, expense, dashboard, reports | `e2e/auth.spec.ts`, `e2e/performance.spec.ts` | Repo-verified |
| AI draft and confirmation | `e2e/ai.spec.ts` | Repo-verified |
| Offline capture and reconnect sync | `e2e/offline.spec.ts` | Repo-verified |
| Mobile layout and mobile offline capture | `e2e/mobile.spec.ts` | Repo-verified |
| Language switching EN/FR/PCM | `e2e/deployment.spec.ts`, `tests/i18n.test.ts` | Repo-verified |
| Subscription restrictions | `e2e/deployment.spec.ts`, `tests/entitlements.test.ts` | Repo-verified |
| Tenant isolation | `e2e/security.spec.ts`, `npm run test:db` | Repo-verified |
| CSRF and webhook forgery rejection | `e2e/security.spec.ts`, `e2e/channels.spec.ts` | Repo-verified |
| Health and security headers | `e2e/deployment.spec.ts` | Repo-verified |
| Production provider smoke tests | Real email, SMS, payment, USSD and WhatsApp calls | Operator |

## Launch sign-off

- [ ] Production database migrated and backed up
- [ ] `verify:production` passes with production credentials
- [ ] `npm run test:e2e` passes against the release build
- [ ] Domains, TLS and Supabase redirect URLs verified
- [ ] At least one real email, SMS OTP, payment, USSD and WhatsApp message received
- [ ] Cron jobs have run successfully in the platform scheduler
- [ ] Uptime monitor and error alerts are firing to an on-call destination
- [ ] Restore drill completed and documented
- [ ] Rollback owner and incident channel assigned
