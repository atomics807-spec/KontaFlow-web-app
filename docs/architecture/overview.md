# KontaFlow architecture

KontaFlow is a multi-tenant bookkeeping and business-intelligence SaaS for
African SMEs. This document describes how the pieces fit together, where the
tenant boundary lives, and which trade-offs were made deliberately.

## Request topology

```
Browser / PWA ─┐
USSD gateway ──┼─► Next.js (App Router, Node or Cloudflare Workers)
WhatsApp ──────┤        │
Cron ──────────┘        ├─ Server Components → services → Supabase (RLS authenticated)
                        ├─ Server Actions     → services → Supabase (RLS authenticated)
                        ├─ Route Handlers     → services → Supabase (RLS or service role)
                        └─ OpenAI SDK         → tool calling → record_transaction RPC
```

* **Server Components** read through `src/services/*` with the user-scoped
  Supabase client, so RLS applies to every read.
* **Server Actions** (`actions.ts` next to each route) validate with Zod,
  re-check permissions with `can(role, permission)`, then call a service.
* **Route Handlers** exist for machines: CSV export, offline sync, AI chat,
  USSD, WhatsApp and cron. They authenticate with a session, a shared secret,
  an HMAC signature or the cron bearer token — never with a client-supplied
  workspace id alone.
* **Background work** is stateless HTTP. `/api/cron/queue-worker` drains the
  durable `job_queue` and `outbox_events`; `/api/cron/daily-digest`,
  `/api/cron/trial-reminders` and `/api/cron/payment-reconciliation` run their
  own schedules. Vercel Cron or a Cloudflare Cron Trigger invokes the same
  routes, and `npm run queue:work` can poll them from a container.
* **Derived reads** use daily rollups (`workspace_daily_financials`) and a
  two-layer cache (`src/lib/cache/distributed.ts`), so dashboards do not scan
  the full ledger on every request. See [scalability.md](scalability.md).

## Tenant boundary

The tenant is a **workspace**. Every business table carries `workspace_id`.
Isolation is enforced in PostgreSQL through RLS policies built on:

| Helper | Meaning |
| --- | --- |
| `app.is_workspace_member(id)` | caller has an active membership |
| `app.can_manage_records(id)` | owner/admin/accountant/manager |
| `app.can_write_finance(id)` | owner/admin/accountant/manager/staff |
| `app.can_manage_workspace(id)` | owner/admin |
| `app.workspace_role(id)` | caller's role, used by policies that need rank |

Financial writes never insert straight into `transactions` from the client:
`public.record_transaction(jsonb)` and `public.void_transaction(...)` are
`SECURITY DEFINER`, re-validate membership and role from `auth.uid()`, write
balanced ledger lines, and append an audit record. Direct DML on
`transactions`, `ledger_lines` and `audit_logs` is revoked from `authenticated`.

A user can belong to several workspaces. The active one is stored in the
`kontaflow_workspace` cookie and validated on every request by
`requireWorkspaceContext()`; a stale or forged cookie falls back to the user's
first membership.

## Money and time

* Amounts are `bigint` **minor units** (`MinorUnits`) plus an explicit currency
  column (default `XAF`, zero decimals). No monetary value passes through
  binary floating point: parsing, summing and formatting operate on `bigint`.
* `Intl.NumberFormat` is fed a safe number only for display, and grouping for
  XAF/XOF follows French conventions regardless of UI language.
* A workspace has one currency. Changing it is blocked once transactions exist
  because it would reinterpret history.
* Timestamps are `timestamptz`. `occurred_on` is a `date` in the workspace
  timezone; `recorded_at`, `sync_received_at` and `recorded_timezone` are kept
  so offline or channel entries stay auditable. Default timezone:
  `Africa/Douala`.

## Localisation

Locales are `en`, `fr` and `pcm` (ISO 639-3 for Cameroon Pidgin English). `/wes` remains a permanent redirect alias so old links and emails keep working.
Dictionary modules are typed against the English shape, so a missing key is a
compile error, and `tests/i18n.test.ts` asserts runtime parity across all three.
Bundled dictionaries are the offline-safe source of truth. Tolgee can override any key at runtime through `src/lib/i18n/tolgee.ts`; when it is unreachable the app silently keeps the bundled copy. The client provider lives in `src/components/layout/i18n-provider.tsx`, and `npm run i18n:pull` checks the remote project against the bundled key set.

## Offline-first

The PWA is offline-first for recording, not for authoritative balances. Pending
entries live in IndexedDB with a client UUID and sync through `POST /api/sync`,
which re-checks membership, validates the payload and calls
`record_transaction`. The service worker caches only the app shell and offline
pages; authenticated API responses and tenant documents are never cached. See
[offline-first.md](offline-first.md) for the queue, conflict and purge rules.

## Deployment-independent integrations

Every provider sits behind a thin adapter so Vercel and Cloudflare deployments
behave identically:

| Capability | Adapter | Notes |
| --- | --- | --- |
| Database/auth/storage | `src/lib/supabase/*` | Works on any Node/Workers runtime |
| Email | `src/lib/integrations/email.ts` | Resend HTTP API |
| USSD/SMS | `src/app/api/ussd/route.ts` | Africa's Talking form posts |
| WhatsApp | `src/lib/integrations/whatsapp.ts` | Meta Cloud API + HMAC check |
| AI | `src/lib/ai/*` | OpenAI Chat Completions tool calling, server-side only; interactive drafts require confirmation |
| Payments | `src/lib/plans.ts` + `PAYMENT_PROVIDER` | Catalog exists; gateway adapter pending |

No Vercel-only SDK (KV, Blob, Cron JSON config, Image Optimization API) is used
in application code. Scheduled HTTP jobs are invoked by whichever platform cron
is available.

## Source layout

```
src/app/[locale]/(auth)        login, signup, password reset
src/app/[locale]/(dashboard)   dashboard, transactions, contacts, reports,
                               assistant, team, settings, billing
src/app/[locale]/onboarding    first-run workspace creation
src/app/[locale]/invite/[token] invitation acceptance
src/app/api/{ai,sync,offline,reports,ussd,whatsapp,cron}
src/components/{ui,layout,forms,dashboard,charts,assistant,pwa,offline}
src/lib/{supabase,ai,i18n,validation,permissions,offline,...}
public/sw.js                   app-shell cache, navigation fallback, update flow
src/services                  server-only data access
supabase/migrations           ordered SQL schema + policies + RPCs
tests                          unit tests (vitest)
scripts                        migration runner, DB integration tests
```

## Known limits (documented, not hidden)

* One currency per workspace; no FX conversion.
* Billing shows plans and usage; no card or mobile-money charge is executed yet
  (`PAYMENT_PROVIDER=none`).
* Inventory is schema-ready but has no UI.
* The in-process rate limiter is per instance; the durable Postgres bucket is
  the shared authority, and edge limits belong in Cloudflare.
* The queue is at-least-once. Handlers must be idempotent; see
  [scalability.md](scalability.md) for leases, backoff and dead-lettering.
