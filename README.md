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
* Vitest unit tests and a Postgres integration suite with tenant-isolation checks
* Deployable to Vercel (Node) or Cloudflare Workers via OpenNext

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
* PWA shell, strict security headers, audit trail, i18n EN/FR/PCM (Cameroon Pidgin).

Known gaps and next steps: [docs/roadmap.md](docs/roadmap.md).

## Documentation

| Document | Contents |
| --- | --- |
| [docs/architecture/overview.md](docs/architecture/overview.md) | System design, tenant boundary, money/time rules, folder layout |
| [docs/architecture/database.md](docs/architecture/database.md) | Schema, invariants, RLS, service-role boundary |
| [docs/security/security.md](docs/security/security.md) | Threat model, authz layers, webhook hardening, headers |
| [docs/deployment/deployment.md](docs/deployment/deployment.md) | Vercel and Cloudflare procedures, env matrix, smoke tests |
| [docs/integrations/channels.md](docs/integrations/channels.md) | USSD, WhatsApp, OpenAI, Resend, payments, offline sync |
| [docs/integrations/ussd.md](docs/integrations/ussd.md) | Africa's Talking setup, handset verification, menu map and USSD checklist |
| [docs/integrations/localization.md](docs/integrations/localization.md) | Locales, Pidgin convention, Tolgee overrides and formatting rules |
| [docs/api/reference.md](docs/api/reference.md) | Routes, actions, RPCs, sync payloads |
| [docs/roadmap.md](docs/roadmap.md) | Shipped vs next |

## Project layout

```
src/app/[locale]      marketing, auth, dashboard, onboarding, invite
src/app/api           ai, sync, reports export, ussd, whatsapp, cron
src/components        ui, layout, forms, dashboard, charts, assistant
src/lib               supabase, ai, i18n, money, permissions, validation
src/services          server-only data access
supabase/migrations   schema, RLS, RPCs
tests                 unit tests
scripts               migration runner, DB integration tests
```

## Brand

Logo assets live in `public/icons`; the palette is forest green, jade, sand,
clay and mango. Never commit secrets — `.env.local` is git-ignored and
`.env.example` only contains placeholders.
