# KontaFlow

**Intelligence behind every business decision.**

KontaFlow is a multi-tenant bookkeeping and business-intelligence SaaS for SMEs
in Cameroon and across Africa. Owners record income and expenses from a modern
web app, a USSD menu, WhatsApp or offline, and get AI-written answers and
automatic reports in English, French or Cameroon Pidgin English.

## Stack

* Next.js 16 (App Router), React 19, strict TypeScript, Tailwind CSS v4
* Supabase (Postgres + RLS, Auth, Storage)
* OpenAI Responses API with schema-constrained tool calling (server-side only)
* Resend email, Africa's Talking USSD, Meta WhatsApp Cloud API
* Recharts + Lucide + Motion
* Vitest unit tests, a Postgres integration suite with tenant-isolation checks,
  and Playwright desktop/mobile journeys
* Deployable to Vercel (Node) or Cloudflare Workers via OpenNext, with a
  platform-neutral health endpoint and cron strategy

## Getting started

```bash
npm ci
cp .env.example .env.local    # fill in Supabase + optional providers
npx supabase start            # or point NEXT_PUBLIC_SUPABASE_URL at a project
npm run db:push               # applies supabase/migrations
npm run dev
```

Open http://localhost:3000 — you are redirected to `/en`, `/fr` or `/pcm`
depending on the `Accept-Language` header. Sign up, confirm the email (or use
the local inbox from `supabase start`), create a business, and start recording.

### Verify before shipping

```bash
npm run typecheck
npm test
npm run test:db      # needs Postgres reachable via SUPABASE_DB_URL
npm run test:e2e     # builds, starts production Next.js on :3000 and runs Playwright
npm run lint
npm run build
```

## Deployment

Both targets use the same Next.js build. Platform-specific code is isolated in
`src/lib/platform/deployment.ts`; application code does not import a Vercel or
Cloudflare SDK.

### Vercel

```bash
npm run db:push
npm run verify:production
# Import the repository in Vercel; vercel.json supplies build, region and cron settings.
```

Set `APP_ENV=production`, `DEPLOYMENT_TARGET=vercel`, `NEXT_PUBLIC_APP_URL` and
the provider secrets in Vercel. Cron routes are authenticated with
`CRON_SECRET`. `vercel.json` uses daily cron schedules so the project can deploy
on the Hobby plan; Vercel Pro or the Cloudflare cron worker can run the finer
schedules.

### Cloudflare Workers

```bash
npx wrangler r2 bucket create kontaflow-next-cache
npm run deploy:cloudflare
npm run deploy:cron:cloudflare
```

`wrangler.jsonc` enables `nodejs_compat`, static assets, R2 incremental cache
and Cloudflare Images. The separate `workers/cron-trigger` Worker calls the same
cron routes on a schedule, so the OpenNext Worker needs no platform-specific
scheduler code.

### Readiness

```bash
npm run verify:production          # read-only env + migration + RLS checks
curl -H "Authorization: Bearer $HEALTHCHECK_TOKEN" https://app.kontaflow.com/api/health
```

The full go-live gate is in
[docs/deployment/production-checklist.md](docs/deployment/production-checklist.md).
External provider and DNS items are marked **operator**; they cannot be
completed by a commit alone.

## What is implemented

* Workspaces with owners, admins, accountants, managers and staff; role-aware
  server actions and UI.
* Email invitations with single-use tokens, role changes and member removal.
* Double-entry bookkeeping: balanced ledger lines, immutable posted entries,
  void-with-audit, bigint minor-unit money, per-workspace currency (XAF default).
* Dashboard KPIs, cash-flow charts, reports plus CSV and localized PDF export.
* Contacts, categories, cash/mobile-money/bank accounts.
* AI assistant that reads the books and records entries through validated tools.
* USSD menu and WhatsApp webhook writing real transactions for verified linked numbers, with role, subscription and idempotency checks.
* Offline outbox with idempotent sync.
* Billing page with plan catalogue, usage and payment history.
* Per-member daily, weekly and monthly reports by email, in-app notification or WhatsApp, with retries, idempotency and a delivery log.
* Low-literacy Easy Mode: large picture actions and three-step number-pad
  entry in EN/FR/PCM, without typing a description or using a microphone.
* PWA shell, strict security headers, audit trail, i18n EN/FR/PCM (Cameroon Pidgin).
* Daily financial rollups, a durable queue/outbox with lease recovery, a shared
  cache, protected metrics and keyset pagination for large ledgers.

Known gaps and next steps: [docs/roadmap.md](docs/roadmap.md).

## Documentation

| Document | Contents |
| --- | --- |
| [docs/architecture/overview.md](docs/architecture/overview.md) | System design, tenant boundary, money/time rules, folder layout |
| [docs/architecture/database.md](docs/architecture/database.md) | Schema, invariants, RLS, service-role boundary |
| [docs/architecture/scalability.md](docs/architecture/scalability.md) | Rollups, cache, queue/outbox, pagination, async AI and scaling limits |
| [docs/security/security.md](docs/security/security.md) | Threat model, authz layers, webhook hardening, headers |
| [docs/deployment/deployment.md](docs/deployment/deployment.md) | Deployment overview, env matrix, migrations, smoke tests |
| [docs/deployment/vercel.md](docs/deployment/vercel.md) | Vercel build, domains, previews, cron and monitoring |
| [docs/deployment/cloudflare.md](docs/deployment/cloudflare.md) | OpenNext adapter, bindings, secrets, cron Worker and limits |
| [docs/deployment/production-checklist.md](docs/deployment/production-checklist.md) | Go/no-go checklist with evidence and operator items |
| [docs/deployment/operations.md](docs/deployment/operations.md) | Health checks, alerts, backups, recovery and incident runbook |
| [docs/deployment/scalability-operations.md](docs/deployment/scalability-operations.md) | Queue, outbox, cache and rollup runbooks; load testing |
| [docs/integrations/channels.md](docs/integrations/channels.md) | USSD, WhatsApp, OpenAI, Resend, payments, offline sync |
| [docs/integrations/ussd.md](docs/integrations/ussd.md) | Africa's Talking setup, handset verification, menu map and USSD checklist |
| [docs/integrations/localization.md](docs/integrations/localization.md) | Locales, Pidgin convention, Tolgee overrides and formatting rules |
| [docs/api/reference.md](docs/api/reference.md) | Routes, actions, RPCs, sync payloads |
| [docs/testing/phase-21-scalability-report.md](docs/testing/phase-21-scalability-report.md) | Phase 21 gates, load results and residual risks |
| [docs/roadmap.md](docs/roadmap.md) | Shipped vs next |

## Project layout

```
src/app/[locale]      marketing, auth, dashboard, onboarding, invite
src/app/api           ai, sync, reports export, ussd, whatsapp, cron
src/components        ui, layout, forms, dashboard, charts, assistant
src/lib               supabase, ai, i18n, money, permissions, validation, platform
workers/cron-trigger  Cloudflare Cron Trigger Worker
src/services          server-only data access
supabase/migrations   schema, RLS, RPCs
tests                 unit tests
scripts               migration runner, DB integration tests
```

## Brand

Logo assets live in `public/icons`; the palette is forest green, jade, sand,
clay and mango. Never commit secrets — `.env.local` is git-ignored and
`.env.example` only contains placeholders.
