# Security architecture

## Threat model

| Adversary | Capability | Primary control |
| --- | --- | --- |
| Authenticated user of another tenant | Knows table names, can call PostgREST directly with their JWT | RLS on every tenant table; workspace id taken from membership, not the request |
| Malicious browser extension / XSS | Reads tokens from storage | Sessions live in cookies managed by `@supabase/ssr`; strict CSP; the app never writes tokens to `localStorage` |
| Webhook spoofer | Posts to `/api/ussd`, `/api/whatsapp`, `/api/webhooks/payments/*` | Shared USSD token, Meta HMAC signature, per-payment callback token + optional HMAC, fail-closed when secrets are absent |
| Payment callback replayer | Replays a valid callback or changes its amount | `(provider, external_event_id)` deduplication; amount/currency/reference are re-read from the provider before activation |
| Stolen service-role key | Full database access | Server-only env, never bundled; blast radius limited by audited RPCs and an out-of-band rotation runbook |
| Abusive user | Costs via AI or floods | Per-plan monthly quota in Postgres, durable per-minute limiter, configured output-token cap |
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
| channel_identities | own row, or owner/admin of the workspace | service role only | service role only |
| whatsapp_messages | workspace managers (select) | service role | service role |
| payment_transactions | workspace owner/admin (no insert/update/delete) | service role only | service role only |
| payment_refunds | service role only | service role only | service role only |
| payment_webhooks | service role only | service role only | service role only |
| webhook_events | service role only | service role only | service role only |
| subscription_plans, subscription_features, plan_features | authenticated | service role | service role |
| subscriptions | owner/admin | owner/admin | — |
| otp_verifications, idempotency_records, contact_messages | service role only | service role only | service role only |

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
| Replay tolerance | `claim_webhook_event` leases each provider message id once; transaction writes also use `client_generated_id` |
| Rate limit | Per-phone sliding window (in-process) plus Postgres quota |
| Body size | `/api/whatsapp` rejects bodies over 1 MB before parsing |
| Fail closed | Missing app secret or service role returns 403/503, never "allow" |

## WhatsApp channel security

* **Ownership proof.** A phone number is linked only after the person sends a
  six-digit code from that number on WhatsApp. The code is HMAC-hashed, expires
  in ten minutes, allows five attempts, and is bound to the requesting user.
  Possession of a browser session alone cannot create a verified link.
* **No client-side linking.** Migration 35 revokes insert/update/delete on
  `channel_identities` from `authenticated`. The server action checks an active
  membership and `integrations:manage`, then uses the service role. A database
  test proves both direct insert and self-verification fail with `42501`.
* **Per-message authorisation.** Each inbound message re-checks that the linked
  member is still active, is not restricted at platform level, belongs to an
  active workspace, and has the role required for the requested operation.
  Platform administrators cannot inherit tenant access through a phone link.
* **Replay and concurrency.** The webhook verifies Meta's HMAC over the exact
  raw body before parsing. Each `message:<wamid>` is claimed transactionally;
  processed and ignored events are terminal, failed events are retryable, and a
  concurrent worker's lease returns a retryable response instead of dropping
  the message.
* **Consent and windows.** `STOP` sets `opted_out_at`; only `START` clears it.
  Free-form replies are refused outside the 24-hour customer-service window, so
  the platform cannot use WhatsApp for unsolicited marketing.
* **Audit without message bodies.** Link, verify and unlink write audit rows;
  failed webhook processing is recorded in `webhook_events`. Message content is
  stored in `whatsapp_messages` for the workspace, not copied into audit
  metadata or logs.
* **Service report boundary.** `get_report_as_service` and
  `get_workspace_summary_as_service` are executable only by `service_role`;
  the channel handler checks the member's read permission before calling them.
  `authenticated` receives `42501`, covered by the database suite.

## USSD channel

* **Shared callback secret.** `USSD_CALLBACK_TOKEN` is required. The callback
  accepts it as `?token=` or `x-ussd-token` and compares it in constant time;
  a missing token disables the route instead of accepting anonymous input.
* **Handset verification.** A link starts as pending with an HMAC of a
  six-digit code, a ten-minute expiry and a five-attempt limit. The code is
  only accepted from the same phone number through the USSD session. Browser
  clients cannot insert, update or self-verify `channel_identities`.
* **Bounded sessions.** `sessionId` is required. The callback rejects missing,
  expired, wrong-phone, wrong-workspace and non-monotonic input paths. A
  terminal response is cached so provider retries do not write twice.
* **Role and subscription checks.** Each verified request re-reads membership,
  restrictions and subscription status. A `past_due` workspace is read-only;
  suspended or restricted accounts receive no financial data.
* **Idempotent writes.** The transaction key is a SHA-256 of
  `sessionId + cumulative text`, so a retry resolves to the existing entry.
* **Output and logging.** Responses are plain text, clamped to 182 characters.
  Phone numbers and verification codes are not logged. The route sets
  `no-store`, `nosniff` and `no-referrer`.

## Browser session cookies

`src/lib/security/cookies.ts` centralises the Supabase SSR cookie options:

- `HttpOnly` — JavaScript cannot read the session, so an XSS bug cannot exfiltrate it directly.
- `Secure` outside local HTTP.
- `SameSite=Lax` — top-level navigation still works; cross-site POSTs do not carry the session.
- `Path=/` and a capped `maxAge` (`SESSION_COOKIE_MAX_AGE_SECONDS`, seven days by default).

`@supabase/ssr` writes a 400-day `maxAge` by default. `limitAuthCookie()`
overrides positive lifetimes with the configured cap but preserves `maxAge: 0`
so sign-out still clears the cookie. Supabase refresh tokens can outlive the
browser cookie; server-side revocation is still required after a password reset
or a suspected compromise.

## CSRF and request origin

Every mutating API route and the local Supabase gateway call
`rejectCrossOrigin()` from `src/lib/security/csrf.ts`. It uses
`src/lib/security/request-origin.ts` and checks, in order:

1. `Sec-Fetch-Site` must not be `cross-site` or `same-site`.
2. If `Origin` is present, it must match the configured app origin or an entry
   in `TRUSTED_ORIGINS`. Client-supplied `X-Forwarded-Host` is not trusted; a
   preview proxy host must be listed explicitly.
3. Requests without `Origin` are allowed only when no browser cross-site
   signal is present; this keeps server-to-server webhooks and native clients
   working.

Server Actions have a second layer in `next.config.ts`: `serverActions
.allowedOrigins` includes the app host and every trusted origin, and the body
size is capped at 3 MB. Next.js's built-in action-id check remains the primary
control.

## Durable rate limiting

`src/lib/security/durable-rate-limit.ts` calls the
`public.consume_security_rate_limit(key, limit, window_seconds)` RPC. Buckets
live in `public.security_rate_limits`, which is service-role only, so a process
restart or a second edge instance cannot reset a limit.

The in-memory `src/lib/rate-limit.ts` helper is only a fallback for local
development and tests. Production paths for auth, onboarding, AI, payments,
uploads, sync, USSD, WhatsApp and platform admin use the durable limiter.
When the RPC is unavailable the limiter fails open to the in-process bucket and
logs a warning; this avoids taking the product down when Postgres is already
unhealthy.

## Upload pipeline

1. Reject cross-origin requests and enforce a per-user durable rate limit.
2. Read the multipart body with a hard byte cap before parsing.
3. Accept only JPEG, PNG, WebP and PDF where the surface allows them. SVG is
   rejected because it can carry script.
4. Check the magic bytes, not just the browser-supplied MIME type. A PDF named
   `logo.png` is rejected with `content_mismatch`.
5. Sanitise the filename and generate the storage path on the server. The
   client never chooses the bucket or the tenant folder.
6. Optionally POST the bytes to `MALWARE_SCAN_URL`. `MALWARE_SCAN_MODE` is
   `disabled`, `warn` or `enforce`; `enforce` fails closed if the scanner is
   unreachable.
7. Store in a private bucket and hand out short-lived signed URLs only.

## AI abuse and prompt injection

- Only the server calls OpenAI. The API key is never in a client bundle.
- `RATE_LIMIT_AI_PER_MINUTE` and the monthly plan quota are both enforced.
- Request bodies are capped at 64 KB and must be JSON.
- Output is capped by `AI_MAX_OUTPUT_TOKENS` and the per-mode ceiling.
- The system prompt marks user text, receipt text, contact names and imported
  files as untrusted data. The model must not follow instructions embedded in
  them or reveal the prompt.
- Interactive tools can only create drafts. Confirmation re-validates through
  audited RPCs, so a prompt injection cannot post a ledger entry by itself.
- AI command confirmation and undo are idempotent and permission-checked.

## Security events and privacy rights

`public.security_events` is an append-only trail for authentication, CSRF,
rate-limit, upload, webhook and privacy events. It stores identifiers and safe
metadata, never passwords, tokens or full message bodies. Tenant members cannot
read it; platform administrators can.

Self-service privacy controls live at `/{locale}/settings/security`:

- JSON export: `GET /api/privacy/export`, rate-limited and `no-store`.
- Marketing consent: separate opt-in/opt-out row in `privacy_consents`.
- Deletion: `request_account_deletion` opens a reviewable request;
  `cancel_account_deletion` closes it before completion.
- Legal mapping and open questions: `docs/security/compliance-cameroon.md`.

## HTTP headers

Set in `next.config.ts` for every response:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co <app> <supabase>; media-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'self' blob:; manifest-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-DNS-Prefetch-Control: off
X-Permitted-Cross-Domain-Policies: none
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Origin-Agent-Cluster: ?1
Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), fullscreen=(self)
```

`'unsafe-inline'` for scripts is required by Next.js's inline bootstrap. A
nonce-based CSP is the next step; it must be implemented in middleware and kept
in sync with the framework version. `'unsafe-eval'` is added only in development.

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

Platform administrator accounts are provisioned out of band. No seed script,
default password, operator email or credential is committed to the repository.
Provisioning steps live in `docs/architecture/platform-administration.md`.

## Mobile-money payments

* Checkout is owner/admin only (`billing:manage`). The amount and currency come
  from `subscription_plans`, never from the browser.
* The merchant reference and callback token are generated with
  `crypto.randomUUID` / `crypto.randomBytes` on the server. Only the SHA-256
  hash of the callback token is stored.
* A provider callback is treated as a hint. The route verifies the per-payment
  token (and an HMAC when the provider or aggregator supplies one), stores the
  event once, then fetches the authoritative provider status. A changed amount
  or currency in the callback is ignored, not used to fail the payment.
* `confirm_payment` re-checks the provider reference, amount, currency and plan
  price inside one transaction before activating the subscription. A late
  verified success can settle a payment previously marked failed/expired.
* `fail_payment` never downgrades `succeeded`, `refunded` or `reversed`.
* Refunds are platform-admin only and capped by the cumulative paid amount.
  Provider refunds are attempted first; a chargeback can be recorded as a
  `reversal`.
* `payment_transactions` is readable by workspace owners/admins but cannot be
  inserted, updated or deleted by authenticated clients. `payment_refunds` and
  `payment_webhooks` are service-role only.
* Provider credentials, callback tokens and raw payloads never reach the
  browser. Logs record identifiers and status codes, not secrets.

## Logging and privacy

`src/lib/logger.ts` emits structured JSON with a redaction list (tokens, keys,
passwords). Errors returned to users are generic public messages; details stay
in server logs. The audit trail records actor, actor type (user/channel/system),
action, entity and workspace — never full message bodies or credentials.

## Operational checklist

- Rotate `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`,
  `WHATSAPP_ACCESS_TOKEN`, `CRON_SECRET`, `USSD_CALLBACK_TOKEN`, and the
  MTN/Orange/aggregator credentials and webhook secrets on a schedule.
- Keep Supabase network restrictions / SSL enforcement on.
- Enable Cloudflare WAF and rate limiting in front of `/api/*`.
- Run `npm run typecheck`, `npm test` and `npm run test:db` in CI before deploy.
- Verify RLS after any migration that adds a table (`alter table ... enable row
  level security` must be present).
- Keep `MALWARE_SCAN_MODE=enforce` in production once a scanner is contracted.
- Review `security_events` and `audit_logs` for anomalies at least weekly.
- Rehearse the incident runbook in `docs/security/incident-response.md` twice a year.
