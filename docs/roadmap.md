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
| Reports (P&L, categories, daily series) + CSV export | done |
| Contacts (customers/suppliers/both) | done |
| Team management, invitations by email, role changes | done |
| Settings (business profile, currency/timezone guard, channels, audit trail) | done |
| Billing view: plan catalogue, usage, payment history | done |
| AI assistant with tool calling and monthly quotas | done |
| USSD menu (Africa's Talking) writing to the ledger | done |
| WhatsApp webhook with HMAC verification + assistant replies | done |
| Daily close email job (Vercel cron / Cloudflare trigger) | done |
| i18n en/fr/wes with typed dictionaries and runtime parity tests | done |
| PWA manifest + service worker + offline fallback | done |
| Security headers incl. CSP, HSTS, frame denial | done |
| Identity hardening: hashed OTPs, rate limits, column privileges, verified-tenant gate | done |
| Unit tests (money, permissions, i18n, validation, rate limits) | done |
| Database integration suite (149 assertions on a fresh DB) | done |

## Next

1. **Payments**: implement MTN MoMo / Orange Money adapters, checkout and
   signed webhooks; then make plan changes self-serve.
2. **Document uploads**: receipt capture to Supabase Storage with OCR feeding
   the assistant.
3. **Inventory**: items, stock movements and cost of goods sold.
4. **Multi-currency**: per-transaction FX rate with reporting currency.
5. **Reports**: balance sheet, aged receivables, tax summaries, PDF export.
6. **Notifications**: in-app centre, email/SMS preferences, low-cash alerts.
7. **Offline depth**: background sync, conflict review UI, storage for receipts
   captured offline.
8. **Hardening**: nonce-based CSP, distributed rate limiting (Cloudflare /
   Upstash), Sentry release tracking, load tests on reports.
9. **Compliance**: data-retention policy, export/delete for account closure,
   audit export for accountants.
