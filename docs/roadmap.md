# Implementation roadmap and status

Phase 1 (foundation) and the core of Phase 2 (bookkeeping) are implemented and
verified. This page tracks what is real today and what comes next.

## Shipped

| Area | Status |
| --- | --- |
| Next.js App Router + strict TypeScript + Tailwind v4 | done |
| Supabase auth, named registration, email + phone verification, consent, onboarding | done |
| Multi-tenant schema, RLS, owner protection, invites/roles | done |
| Money in bigint minor units, XAF default, per-workspace currency | done |
| Transactions: record, list, void, receipts metadata, offline idempotency | done |
| Dashboard KPIs, cash-flow and daily charts | done |
| Reports (P&L, categories, daily series) + localized CSV and PDF export | done |
| Contacts (customers/suppliers/both) | done |
| Team management, invitations by email, role changes | done |
| Settings (business profile, currency/timezone guard, channels, audit trail) | done |
| Billing view: plan catalogue, usage, payment history | done |
| Mobile money: MTN MoMo, Orange Money and aggregator checkout, signed callbacks, reconciliation cron and admin refunds/reversals | done |
| AI assistant with tool calling and monthly quotas | done |
| USSD (Africa's Talking): verified handset linking, bounded sessions, localized menu, role/subscription enforcement and idempotent writes | done |
| WhatsApp Business Platform: verified linking, commands, AI fallback, delivery statuses, consent and 24-hour window | done |
| Daily close and weekly report emails (hourly Vercel cron / Cloudflare trigger, per-workspace timezone, delivery audit) | done |
| i18n en/fr/pcm (Cameroon Pidgin) with typed dictionaries, ICU plurals and runtime parity tests | done |
| PWA manifest + service worker + offline fallback | done |
| Security headers incl. CSP, HSTS, frame denial | done |
| Phase 18 hardening: HttpOnly session cap, CSRF/origin checks, durable rate limits, upload MIME/malware gate, AI abuse controls, security events, privacy export/delete | done |
| Identity hardening: hashed OTPs, rate limits, column privileges, verified-tenant gate | done |
| Unit tests (223 tests across money, permissions, i18n, validation, rate limits, security, backoff, metrics) | done |
| Database integration suite (376 assertions on a fresh DB) | done |
| Deployment readiness: Vercel config, Cloudflare OpenNext + cron Worker, health endpoint, production checklist and recovery runbook | done |
| Daily financial rollups and rollup-backed dashboard summary | done |
| Durable `job_queue` + transactional `outbox_events`, lease/retry/dead-letter, queue-worker cron and container worker | done |
| Two-layer distributed cache (L1 + Postgres) with stampede lock and outbox invalidation | done |
| Durable rate-limit v2 with remaining/reset headers; keyset-paginated `/api/transactions` | done |
| Operational metrics, protected `/api/metrics`, health operational detail and `x-request-id` propagation | done |
| 100k-request load harness + k6 scenario; 100k health and 20k marketing baseline recorded | done |
| Async AI turns through the durable queue with owner-scoped confirmation | done |

## Next

1. **Document uploads**: receipt capture to Supabase Storage with OCR feeding
   the assistant.
2. **Inventory**: items, stock movements and cost of goods sold.
3. **Multi-currency**: per-transaction FX rate with reporting currency.
4. **Reports**: balance sheet, aged receivables and tax summaries.
5. **Notifications**: in-app centre, email/SMS preferences, low-cash alerts.
6. **Offline depth**: background sync, conflict review UI, storage for receipts
   captured offline.
7. **Hardening**: nonce-based CSP, Sentry release tracking, report-export load
   tests, external malware scanner in enforce mode, production game-day.
8. **Compliance**: retention schedule, accountant audit export, DPA and
   international-transfer review for every subprocessor.
