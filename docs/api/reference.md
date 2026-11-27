# API reference

All HTML routes are localised: `/{en|fr|pcm}/...`. Machine endpoints live under
`/api` and never trust a workspace id supplied by the caller.

## Route handlers

| Route | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/ai/chat` | POST | Supabase session | Assistant turn; body `{ message, conversationId?, requestId, locale, async? }`; returns `{ reply, conversationId, toolsUsed, command, clarification }` or `202 { jobId }` when `async` is true |
| `/api/ai/jobs/[id]` | GET | Supabase session | Polls an async assistant job owned by the caller; returns status and result |
| `/api/ai/commands/[id]/confirm` | POST | Supabase session | Posts a pending draft; always records a manual confirmation |
| `/api/ai/commands/[id]/dismiss` | POST | Supabase session | Discards a pending draft; creator only |
| `/api/ai/commands/[id]/undo` | POST | Supabase session | Reverses a confirmed transaction draft within 24 hours |
| `/api/sync` | POST | Supabase session | Flush up to 100 offline entries (idempotent per `clientGeneratedId`, duplicates in the batch are resolved once) |
| `/api/transactions` | GET | Supabase session + `transactions:read` | Keyset-paginated ledger (`limit` ≤ 100, `cursor`, `kind`, `status`, `categoryId`, `search`, `from`, `to`); returns `{ rows, nextCursor }` |
| `/api/health` | GET | `HEALTHCHECK_TOKEN` | Readiness, deployment metadata and (when authorized) queue/outbox/cache depth |
| `/api/metrics` | GET | `HEALTHCHECK_TOKEN` or `CRON_SECRET` | In-process counters/histograms and operational queue/outbox/cache stats; `no-store` |
| `/api/reports/export` | GET | Supabase session | Localized CSV export for a period (`from`, `to`, `locale`) |
| `/api/reports/export/pdf` | GET | Supabase session | Localized PDF report for a period (`from`, `to`, `locale`) |
| `/api/ussd` | POST | Required `USSD_CALLBACK_TOKEN` | Africa's Talking USSD menu; returns plain-text `CON`/`END` |
| `/api/whatsapp` | GET/POST | Verify token / HMAC | Meta webhook handshake and inbound messages |
| `/api/cron/daily-digest` | GET/POST | `Authorization: Bearer $CRON_SECRET` | Sends each member their due daily, weekly (Sunday) and monthly (last day) reports at 21:00 workspace time by email, in-app or WhatsApp; retries failed channels |
| `/api/cron/trial-reminders` | GET/POST | `Authorization: Bearer $CRON_SECRET` | Expires trials and sends configured reminder emails |
| `/api/cron/payment-reconciliation` | GET/POST | `Authorization: Bearer $CRON_SECRET` | Polls pending mobile-money payments and settles them |
| `/api/cron/queue-worker` | GET/POST | `Authorization: Bearer $CRON_SECRET` | Reaps stale leases, drains up to 10 jobs and 50 outbox events (10 job handlers run concurrently), returns claimed/completed/failed/dead-lettered counts |
| `/api/payments` | POST | Supabase session + `billing:manage` | Starts an MTN MoMo, Orange Money or aggregator payment for a paid plan; body `{ planCode, provider, payerMsisdn?, idempotencyKey? }` |
| `/api/payments/[id]` | GET | Supabase session + `billing:manage` | Polls and reconciles one payment; returns a public status, never provider secrets |
| `/api/webhooks/payments/[provider]` | POST/PUT | Provider callback token/HMAC | Deduplicates and reconciles a mobile-money callback; the callback body is not trusted as proof |
| `/api/admin/payments/[id]/refund` | POST | Platform admin/super-admin | Records a provider refund or a chargeback reversal |

### Error shape

Route handlers return JSON `{ error: string }` with a safe message and an
appropriate status (400 validation, 401/403 auth, 429 rate limit, 500
unexpected). Server actions instead return `FormState`:

```ts
type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};
```

## Server actions

| Area | Action | Permission |
| --- | --- | --- |
| Auth | `signInAction`, `signUpAction`, `forgotPasswordAction`, `resetPasswordAction` | anonymous |
| Onboarding | `createWorkspaceAction`, `switchWorkspaceFormAction` | authenticated |
| Transactions | `recordTransactionAction`, `voidTransactionAction` | `transactions:create` / `transactions:void` |
| Contacts | `createContactAction` | `contacts:manage` |
| Team | `inviteMemberAction`, `changeRoleAction`, `removeMemberAction`, `revokeInvitationAction` | `members:*` |
| Settings | `updateWorkspaceAction`, `linkChannelAction`, `unlinkChannelAction` | `workspace:update` / `integrations:manage` |
| Invitations | `acceptInvitationAction` (invite page) | authenticated user whose email matches the invitation |

## Database RPCs

Called through the Supabase client; all are `SECURITY DEFINER` with
`search_path` pinned.

| Function | Caller | Notes |
| --- | --- | --- |
| `create_workspace(name, currency, country, timezone, legal_name, locale)` | authenticated | Seeds accounts, categories, subscription |
| `record_transaction(payload jsonb)` | authenticated | Validates amount/currency/account, writes balanced lines + audit |
| `void_transaction(id, reason)` | authenticated | Keeps history, restores balances, audits |
| `get_dashboard_summary(workspace, from, to)` | authenticated | KPIs, cash, series; period totals and monthly series read `workspace_daily_financials` |
| `get_report(workspace, from, to)` | authenticated | P&L, categories, daily series |
| `get_workspace_members(workspace)` | authenticated | Member directory (email + name) |
| `consume_quota(workspace, kind, limit)` | authenticated | Meters AI usage |
| `accept_invitation(token)` | authenticated | Email must match the invite |
| `record_channel_transaction(workspace, actor, channel, payload)` | `service_role` only | Webhook/cron writes; re-verifies actor membership |
| `consume_channel_quota(workspace, actor, kind, limit)` | `service_role` only | Channel AI usage |
| `confirm_ai_command(id, auto_posted)` | authenticated | Validates draft ownership and posts through existing RPCs; idempotent |
| `dismiss_ai_command(id)` | authenticated | Creator-only discard; idempotent |
| `undo_ai_command(id, reason)` | authenticated | Creator-only reversal of a confirmed transaction draft; 24-hour window |
| `set_ai_command_reply(id, reply)` | authenticated | Creator-only final reply update used after auto-post |
| `get_workspace_summary_as_service(workspace, from, to)` | `service_role` only | Digest job |
| `get_plan_catalogue()` | public | Active plans and feature grants for pricing and billing |
| `get_operational_stats()` | `service_role` only | Queue/outbox/cache counts and oldest queued age for health and metrics |
| `enqueue_job(type, payload, workspace, actor, priority, run_at, max_attempts, idempotency_key)` | `service_role` only | Durable queue insert; idempotency key returns the existing job |
| `claim_jobs(worker, limit, types, lease)` / `complete_job(id, worker, result)` / `fail_job(id, worker, error, retry_at, dead)` / `reap_stale_jobs()` | `service_role` only | `SKIP LOCKED` lease-based queue lifecycle |
| `claim_outbox_events(worker, limit, lease)` / `complete_outbox_event(...)` / `fail_outbox_event(...)` | `service_role` only | Transactional outbox delivery |
| `cache_get(key)` / `cache_set(key, value, ttl, workspace)` / `cache_delete_workspace(workspace)` / `acquire_cache_lock(key, owner, ttl)` | `service_role` only | Shared L2 cache and stampede lock |
| `consume_security_rate_limit_v2(bucket, limit, window)` | `service_role` only | Atomic rate-limit decision with count, remaining and reset time |
| `platform_admin_plan_catalogue()` / `platform_admin_billing_settings()` | platform admin | Plan console reads |
| `platform_admin_save_plan(code, payload, ip)` / `platform_admin_save_billing_settings(days, plan, reminders, ip)` | platform admin | Audited plan and trial configuration |
| `expire_trials()` | `service_role` only | Moves ended trials to `past_due` (read-only) |
| `create_payment_intent(...)` | `service_role` only | Validates plan/price/provider, enforces idempotency and stores a pending payment |
| `mark_payment_initiated(...)` | `service_role` only | Stores the provider reference and moves the payment to `processing` |
| `confirm_payment(...)` | `service_role` only | Re-checks provider reference, amount, currency and plan price, then activates the subscription |
| `fail_payment(...)` | `service_role` only | Moves a pending payment to `failed`/`expired`; never downgrades a successful payment |
| `refund_payment(...)` | `service_role` only | Records a refund/reversal, enforces the cumulative cap and updates the subscription |
| `touch_payment(...)` | `service_role` only | Records a provider status check without changing the lifecycle state |
| `activate_paid_subscription(...)` | `service_role` only | Legacy verified-payment activation path retained for existing operations |

## Offline payload

`POST /api/sync` accepts:

```json
{
  "items": [
    {
      "clientGeneratedId": "uuid-or-device-id",
      "workspaceId": "uuid",
      "kind": "expense",
      "amount": "3500",
      "currency": "XAF",
      "description": "Fuel for delivery bike",
      "occurredOn": "2026-02-14",
      "categoryId": "uuid",
      "accountId": "uuid",
      "paymentMethod": "cash"
    }
  ]
}
```

The body is capped at 256 KiB and 100 items. Response:
`{ "results": [{ "clientGeneratedId", "status": "synced|duplicate|failed|conflict", "code?", "error?", "transactionId?" }] }`.
