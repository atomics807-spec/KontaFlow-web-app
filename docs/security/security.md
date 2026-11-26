# Security architecture

## Threat model

| Adversary | Capability | Primary control |
| --- | --- | --- |
| Authenticated user of another tenant | Knows table names, can call PostgREST directly with their JWT | RLS on every tenant table; workspace id taken from membership, not the request |
| Malicious browser extension / XSS | Reads tokens from storage | Sessions live in cookies managed by `@supabase/ssr`; strict CSP; the app never writes tokens to `localStorage` |
| Webhook spoofer | Posts to `/api/ussd`, `/api/whatsapp` | Shared USSD token, Meta HMAC signature, fail-closed when secrets are absent |
| Stolen service-role key | Full database access | Server-only env, never bundled; blast radius limited by audited RPCs and an out-of-band rotation runbook |
| Abusive user | Costs via AI or floods | Per-plan monthly quota in Postgres, per-minute limiter, 900-token output cap |
| Prompt injection through receipts | Trick the assistant into writing bad data | Interactive AI tools can only create drafts; confirmation re-validates through audited RPCs. Direct-channel tools call `record_channel_transaction`, which re-checks actor membership and amounts |

## Identity and sessions

* Supabase Auth issues JWTs; the browser never sees the service-role key.
* `src/lib/supabase/server.ts` builds an SSR client per request; `proxy.ts`
  refreshes cookies so server components never run with an expired token.
* `requireWorkspaceContext()` resolves the active workspace from the
  `kontaflow_workspace` cookie **and verifies membership**; an unknown workspace falls
  back to the first membership instead of trusting the cookie.
* Email confirmation, password reset and invitations use the
  `/auth/callback?next=...` route with `safeNextPath()` to prevent open
  redirects (only same-origin relative paths are accepted).
* Registration collects a real person (first name, last name, email, phone,
  country) and explicit privacy consent with policy version, locale, IP and
  user agent. `verification_required` forces both email and phone proof before
  onboarding.
* Phone OTPs are six digits from `crypto.randomInt`, HMAC-hashed with a
  server-only secret before storage, bound to user + purpose, delivered over
  the server-side SMS adapter and never returned to the browser. Verification
  allows five attempts, a 60-second resend cooldown and five codes per hour.
* Changing the phone number clears `phone_verified_at` and re-arms
  verification by trigger.
* `authenticated` has no column privilege on verification timestamps,
  `verification_required`, `onboarding_completed_at`, `workspaces.owner_id` or
  `workspaces.plan`, so a crafted PostgREST `update` cannot self-verify,
  clear onboarding, change ownership or upgrade billing.
* A database trigger refuses workspace creation for a self-authenticated,
  unverified owner even if the client calls `create_workspace` directly.
* The privacy notice is published at `/{locale}/security#privacy` and covers
  data collected, use, retention, processor categories and user rights. Signup
  links to it and stores the accepted policy version with every consent.

## Authorisation layers

1. **Database (authoritative)** — RLS plus `SECURITY DEFINER` RPCs that
   re-derive `auth.uid()`; direct ledger DML is revoked.
2. **Server actions** — `requireWorkspaceContext()` + `can(role, permission)`
   before calling a service; actions that mutate return typed `FormState`
   errors, never raw Postgres messages.
3. **UI** — hides actions the role cannot perform. Convenience only; the two
   layers above are the controls.

Role matrix lives in `src/lib/permissions.ts` and is unit-tested.

## Tenant isolation matrix

Every tenant-owned table has `workspace_id`, RLS enabled and at least one
policy. None of the policies trust a `workspace_id` from the client; they call
`app.is_workspace_member`, `app.can_write_finance`, `app.can_manage_records` or
`app.can_manage_workspace`, all of which resolve the caller from `auth.uid()`.

| Surface | Read | Write | Delete |
| --- | --- | --- | --- |
| invoices, invoice_items, debts, debt_payments | any member | finance roles | managers (drafts only for invoices) |
| budgets, financial_goals | any member | managers | managers |
| inventory_items | any member | finance roles | managers |
| financial_reports | any member | finance roles | managers or author |
| business_settings | any member | owner/admin | — |
| ai_interactions | author only | author only | — |
| ai_commands | author only | insert (RLS); lifecycle via RPCs | — |
| ai_suggestions | members, shared or own | author (status) | managers |
| notification_preferences, privacy_consents | owner | owner | — |
| offline_sync_records | owner | owner | — |
| integration_accounts | owner/admin | owner/admin | — |
| integration_messages | managers | service role | — |
| subscription_plans, subscription_features, plan_features | authenticated | service role | service role |
| subscriptions | owner/admin | owner/admin | — |
| payment_webhooks, otp_verifications, idempotency_records, contact_messages | service role only | service role only | service role only |

Child rows of tenant-owned parents also carry composite foreign keys
`(workspace_id, parent_id)`, so a row cannot point at another tenant's parent
even if a policy were wrong. This is defence in depth, not a replacement for
RLS.

Deleting a workspace is the one case where delete-protection triggers must
yield: a transaction-local marker set by `workspaces_mark_deletion` lets
invoice, payment and system-record guards allow the cascade, and tenant
foreign keys are deferred so deletion order cannot fail. Normal deletes stay
blocked.

The throwaway-database suite exercises this matrix with a user who is not a
member of the tenant: reads return zero rows and writes fail with `42501` for
invoices, debts, budgets, inventory, AI suggestions, notification preferences,
offline sync, financial accounts, and the reversal RPC. It also asserts that
every table in `public` has RLS enabled and that the five compatibility views
use `security_invoker`.

## Storage isolation

All buckets are private. Object paths begin with the tenant id
(`<workspace_id>/...`) or the user id (`<user_id>/...` for profile images).
Policies map that folder to membership or ownership; malformed folders return
null through `app.uuid_or_null()` and therefore fail closed. Deletes are
limited to the uploader or a workspace manager, and the app only ever hands out
short-lived signed URLs. No bucket has `public = true`.

## Financial integrity as a security property

* Amounts are positive `bigint` minor units; direction is explicit.
* Two balanced ledger lines per transaction, enforced by a deferred trigger.
* Posted rows are immutable; `void_transaction` keeps history and writes an
  audit event.
* Corrections after a reporting period use `reverse_transaction`, which writes
  a mirrored entry with swapped debit/credit lines, links it with
  `reverses_transaction_id`, and audits both the original and the reversal. A
  transaction can only be reversed once.
* Invoice totals and debt balances are derived in SQL from integer values;
  issued invoices and recorded payments freeze their financial fields.
* Deleting a workspace is restricted to the owner, and the owner can never be
  removed or demoted while they are the last owner (trigger).

## Secrets and configuration

* `src/lib/env.ts` validates configuration with Zod. Public and server schemas
  are separate so a client component cannot accidentally import a secret.
* Missing optional secrets degrade features safely: email is skipped with a log
  line, WhatsApp rejects webhooks, the assistant reports "not configured".
* `.env.example` documents every variable; `.env.local` is git-ignored.

## Webhook hardening

| Control | Implementation |
| --- | --- |
| Signature | `X-Hub-Signature-256` HMAC-SHA256 over the raw body, constant-time compare |
| Shared token | USSD callback URL `?token=` or `x-ussd-token`, constant-time compare |
| Replay tolerance | Retries are idempotent through `client_generated_id` |
| Rate limit | Per-phone sliding window (in-process) plus Postgres quota |
| Fail closed | Missing app secret or service role returns 403/503, never "allow" |

## HTTP headers

Set in `next.config.ts` for every response:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; ...
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(self), microphone=(), geolocation=()
```

`'unsafe-inline'` for scripts is required by Next.js's inline bootstrap. A
nonce-based CSP is the next step; it must be implemented in middleware and kept
in sync with the framework version.

## Platform administrators and account restrictions

Platform operators are not tenant users. They are stored in
`public.platform_admins`, which is readable only for the caller's own row and
writable only through a `SECURITY DEFINER` RPC or the service role. Three
triggers prevent an operator from owning a workspace, joining one, or converting
an existing tenant account into an operator while it still belongs to a tenant.
See `docs/architecture/platform-administration.md`.

Account restrictions have two severities:

- `limited` closes tenant access immediately through a restrictive RLS policy
  and the shared membership helpers, while leaving sign-in and the reason page
  available.
- `suspended` does the same and also tells GoTrue to ban the Auth user for the
  matching duration.

Only `admin` and `super_admin` can restrict accounts. Only `super_admin` can
create or deactivate other platform administrators; the last active super admin
is protected by a database trigger. Every platform command writes an append-only
audit row with the acting operator, target, safe details and request IP.

The demo bootstrap script (`npm run demo:super-admin`) refuses to use its known
demo password when `APP_ENV=production` or `VERCEL_ENV=production`; production provisioning requires an
explicit `KONTAFLOW_SUPER_ADMIN_PASSWORD`.

## Logging and privacy

`src/lib/logger.ts` emits structured JSON with a redaction list (tokens, keys,
passwords). Errors returned to users are generic public messages; details stay
in server logs. The audit trail records actor, actor type (user/channel/system),
action, entity and workspace — never full message bodies or credentials.

## Operational checklist

- Rotate `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`,
  `WHATSAPP_ACCESS_TOKEN`, `CRON_SECRET`, `USSD_CALLBACK_TOKEN` on a schedule.
- Keep Supabase network restrictions / SSL enforcement on.
- Enable Cloudflare WAF and rate limiting in front of `/api/*`.
- Run `npm run test:db` and `npm test` in CI before deploy.
- Verify RLS after any migration that adds a table (`alter table ... enable row
  level security` must be present).
