# Security architecture

## Threat model

| Adversary | Capability | Primary control |
| --- | --- | --- |
| Authenticated user of another tenant | Knows table names, can call PostgREST directly with their JWT | RLS on every tenant table; workspace id taken from membership, not the request |
| Malicious browser extension / XSS | Reads tokens from storage | Sessions live in cookies managed by `@supabase/ssr`; strict CSP; the app never writes tokens to `localStorage` |
| Webhook spoofer | Posts to `/api/ussd`, `/api/whatsapp` | Shared USSD token, Meta HMAC signature, fail-closed when secrets are absent |
| Stolen service-role key | Full database access | Server-only env, never bundled; blast radius limited by audited RPCs and an out-of-band rotation runbook |
| Abusive user | Costs via AI or floods | Per-plan monthly quota in Postgres, per-minute limiter, 900-token output cap |
| Prompt injection through receipts | Trick the assistant into writing bad data | AI tools only call `record_transaction`, which re-validates amounts, currency and category server-side |

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

## Authorisation layers

1. **Database (authoritative)** — RLS plus `SECURITY DEFINER` RPCs that
   re-derive `auth.uid()`; direct ledger DML is revoked.
2. **Server actions** — `requireWorkspaceContext()` + `can(role, permission)`
   before calling a service; actions that mutate return typed `FormState`
   errors, never raw Postgres messages.
3. **UI** — hides actions the role cannot perform. Convenience only; the two
   layers above are the controls.

Role matrix lives in `src/lib/permissions.ts` and is unit-tested.

## Financial integrity as a security property

* Amounts are positive `bigint` minor units; direction is explicit.
* Two balanced ledger lines per transaction, enforced by a deferred trigger.
* Posted rows are immutable; `void_transaction` keeps history and writes an
  audit event.
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
