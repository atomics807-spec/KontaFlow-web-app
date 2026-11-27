# Database architecture

PostgreSQL (Supabase) is the system of record. Migrations live in
`supabase/migrations` and are applied in filename order. `scripts/test-db.ts`
rebuilds a throwaway database from those files on every run, so the schema and
its tests cannot drift apart.

## Migration map

| File | Contents |
| --- | --- |
| `0001_extensions_and_types` | enums (`workspace_role`, `transaction_kind`, `entry_channel`, ...), helper schema `app` |
| `0002_tenants_and_access` | `profiles`, `workspaces`, `workspace_members`, `workspace_invitations`, `channel_identities`, role helpers, new-user trigger |
| `0003_bookkeeping` | `accounts`, `categories`, `contacts`, `transactions`, `ledger_lines`, `attachments`, balance guard, immutability trigger |
| `0004_ai_audit_channels_billing` | `ai_conversations`, `ai_messages`, `audit_logs`, `notifications`, `ussd_sessions`, `whatsapp_messages`, `webhook_events`, `sync_devices`, `subscriptions`, `payment_transactions`, `usage_events`, quota RPC |
| `0005_workspace_and_transaction_rpc` | `create_workspace`, `record_transaction`, `void_transaction`, `accept_invitation` |
| `0006_reporting` | `get_report`, `get_dashboard_summary`, reporting views |
| `0007_rls_and_grants` | RLS enablement, per-table policies, privilege hardening |
| `0008_storage` | first private documents bucket and object policies |
| `0009_member_directory` | `get_workspace_members` |
| `0010_channel_ingestion` | service-role entry points for USSD/WhatsApp/cron |
| `0037_phase13_entitlements` | configurable plans, feature grants, trial lifecycle, read-only enforcement |
| `0038_phase14_payment_status` | `processing`, `expired` and `reversed` payment states |
| `0039_phase14_payments` | payment references, plan snapshot, expiry, idempotency, webhook token hash, refunds, service-role lifecycle RPCs, RLS/grants |
| `0040_phase15_plan_reporting` | Starter 14-day trial, `daily_reports` and `weekly_reports` grants, service-role entitlement checks, `report_deliveries` delivery audit |
| `0041_phase15_report_preferences` | Per-member `report_preferences`, `monthly_reports` entitlement, monthly/recipient/channel delivery audit, notification idempotency |
| `0011_phase3_finance_ops` | transaction provenance/reversal columns, `business_settings`, `invoices`, `invoice_items`, `debts`, `debt_payments`, `budgets`, `financial_goals`, `inventory_items`, `financial_reports`, composite FK targets |
| `0012_phase3_platform` | `subscription_plans`, `subscription_features`, `plan_features`, `payment_webhooks`, `ai_interactions`, `ai_suggestions`, `notification_preferences`, `privacy_consents`, `otp_verifications`, `integration_accounts`, `integration_messages`, `offline_sync_records`, `idempotency_records`, compatibility views |
| `0013_phase3_integrity` | invoice totals/locking triggers, invoice numbering, debt repayment triggers, audit triggers, `reverse_transaction` |
| `0014_phase3_rls` | RLS and privileges for every Phase 3 table |
| `0015_phase3_storage` | five workspace buckets + profile images, tenant-scoped policies |
| `0016_phase3_cascade_deletion` | cascade-safe tenant deletion: deferred tenant FKs, workspace-delete marker, guards that yield only during a cascade |
| `0017_contact_messages` | inbound public contact form: `contact_messages` (service-role only, no tenant, RLS enabled, topic/status/locale checks) |
| `0018_phase4_identity_verification` | named profiles, verification timestamps, onboarding fields, consent metadata, hashed phone-OTP RPCs, `complete_onboarding` |
| `0019_phase4_workspace_verification_gate` | trigger that blocks workspace creation by an unverified owner, even through the lower-level RPC |
| `0020_phase4_column_privileges` | column grants so browser clients cannot write verification flags, onboarding state, ownership or plan |
| `0021_phase4_phone_change_reverification` | changing a phone number clears its verification and re-arms the onboarding gate |
| `0022_phase4_bind_otp_to_destination` | a code is refused if the profile phone changed after it was sent |
| `0030_phase8_ai_bookkeeping` | `ai_commands`, AI auto-post settings, creator-only confirm/dismiss/undo/reply RPCs |
| `0031_phase9_ai_preferences` | owner-controlled AI insights, analysis window and retention settings |
| `0032_phase9_business_intelligence` | tenant-scoped `get_business_intelligence` analytics |
| `0033_phase9_ai_history_retention` | AI retention cutoff and honest history purge |
| `0034_phase10_platform_admin` | `platform_admins`, account restrictions, platform console policies |
| `0035_phase11_whatsapp` | WhatsApp link challenges, delivery state, webhook claim lease, service reporting wrappers, channel-link write revocation |
| `0036_phase12_ussd` | USSD session state, channel-link verification, bounded session RPCs |
| `0042_phase16_admin_operations` | Platform support access, announcements and operations audit |
| `0043_phase18_security_hardening` | `security_events`, `security_rate_limits`, `account_deletion_requests`, consent metadata, deletion RPCs, durable rate-limit RPC |

`supabase/seed.sql` seeds the plan catalogue. It is idempotent.

## Domain map

The product vocabulary and the physical tables line up as follows. A few
canonical tables carry more than one domain concept; read-only views expose the
domain names without duplicating data.

| Domain entity | Physical object |
| --- | --- |
| profiles, workspaces, workspace_members, workspace_invitations | same names |
| business_settings | `business_settings` (1:1 with `workspaces`, created by trigger) |
| business_categories, transaction_categories | `categories` (canonical), exposed as `business_categories` and `transaction_categories` views |
| financial_accounts | `accounts` (canonical), exposed as `financial_accounts` view |
| customers, suppliers | `contacts` with `kind`, exposed as `customers` / `suppliers` views |
| transactions, transaction lines | `transactions`, `ledger_lines` |
| invoices, invoice_items | same names; totals derived by trigger |
| debts, debt_payments | same names; `paid_minor` maintained by trigger |
| budgets, financial_goals, inventory_items, financial_reports | same names |
| subscription_plans, subscription_features, plan_features | same names; plan catalogue is global |
| subscriptions, payment_transactions, payment_webhooks | same names |
| ai_interactions, ai_suggestions | same names (per-turn content stays in `ai_messages`) |
| notifications, notification_preferences | same names |
| report_preferences | `report_preferences` (per-member cadence, language and channels) |
| report_deliveries | `report_deliveries` (per-recipient and per-channel scheduled report audit, service-written) |
| audit_logs | `audit_logs` (append-only) |
| privacy_consents | `privacy_consents` |
| security_events | `security_events` (append-only, platform-readable) |
| security_rate_limits | `security_rate_limits` (service-role only) |
| account_deletion_requests | `account_deletion_requests` (owner-readable, staff-reviewed) |
| otp_verifications | `otp_verifications` |
| integration_accounts, integration_messages | same names |
| offline_sync_records | `offline_sync_records` |
| idempotency_records | `idempotency_records` |
| inventory | `inventory_items` |

The compatibility views are read-only and use `security_invoker = true`, so the
caller's RLS applies. Writes always go to the canonical table.

## Identity and verification

A person registers with a first name, last name, email, phone and country.
`public.profiles` stores those identity fields plus `email_verified_at`,
`phone_verified_at`, `verification_required` and `onboarding_completed_at`.
`privacy_consents` records the exact policy version, locale, IP, user agent and
marketing choice at signup.

Phone codes are six digits generated with `crypto.randomInt`. Only an HMAC
(`OTP_HMAC_SECRET`, bound to user + purpose) reaches `otp_verifications`; the
plaintext never touches the database. `request_phone_verification` enforces a
60-second resend cooldown, five codes per rolling hour and one active challenge;
`verify_phone_verification` allows at most five attempts, expires codes after
ten minutes, refuses a code whose destination no longer matches the profile
phone and marks the profile verified in the same transaction.

`complete_onboarding` refuses to run while either contact channel is
unverified, then calls `create_workspace`, stores the business profile and marks
the profile complete atomically. `app.enforce_verified_workspace_creation` is a
second line of defence at the `workspaces` table. Verification timestamps are
not writable by `authenticated`; the same grants protect `workspaces.owner_id`
and `workspaces.plan`.

## Transactions and corrections

`transactions` is the immutable financial event:

* `kind` (`income`, `expense`, `transfer`), `amount_minor > 0`, `currency`,
  `occurred_on` (business date), `recorded_at`, `recorded_timezone`,
  `sync_received_at`.
* `channel` explains how the event arrived (`web`, `ussd`, `whatsapp`, `ai`,
  `sync`, `api`, `system`); `source` explains its provenance (`manual`, `ai`,
  `ussd`, `whatsapp`, `import`, `api`, `sync`, `system`) and is derived by
  trigger when not explicit. `sync_status` tracks offline reconciliation.
* `client_generated_id` is unique per workspace for idempotent retries.
* `attachment_path` plus `attachments` rows point at private storage objects.
* `voided_at`, `voided_by`, `void_reason` close a transaction before period
  close; every other financial field is frozen by `app.protect_posted_transaction`.

Corrections after a period is reported use
`public.reverse_transaction(id, reason)`. It inserts a new transaction that
mirrors every ledger line with debit and credit swapped, records
`reverses_transaction_id` and `reversal_reason`, writes an audit event, and
leaves the original posted. A transaction can be reversed once; a reversal
entry cannot itself be reversed. The unique partial index on
`reverses_transaction_id` enforces this in the database.

## Derived money

All derivations happen in SQL, never in application floats:

* Invoice line totals: `round(quantity * unit_price_minor)::bigint`; tax per
  line uses basis points (`tax_rate_bp / 10000` in numeric). Invoice totals are
  recomputed after any item change.
* `debts.paid_minor` and `debts.status` are recomputed after every payment
  insert, void or update. Overpayment is rejected by trigger.
* Deleting a debt payment is rejected; payments are voided.

Issued invoices lock their financial fields and their line items. Only drafts
can be edited or deleted; later changes go through `void` and a fresh invoice.
Status transitions are validated (draft → sent → partially_paid/paid/overdue →
void).

## Tenant isolation

Every tenant-owned table has `workspace_id` and RLS enabled. Policies resolve
access from `auth.uid()` through the `app.*` helpers:

```sql
create policy invoices_select_member on public.invoices
  for select to authenticated
  using (app.is_workspace_member(workspace_id));
```

## Mobile-money payments

`payment_transactions` keeps the server-generated merchant reference, provider
reference, plan snapshot, exact amount in minor units, currency, payer MSISDN,
checkout URL, expiry, idempotency key and a SHA-256 hash of the per-payment
callback token. The raw callback token is never stored.

Lifecycle:

```
pending -> processing -> succeeded -> refunded (full) | reversed (full)
                      -> failed       -> succeeded (late verified callback)
                      -> expired
succeeded + partial refund -> succeeded with refunded_amount_minor
```

`payment_refunds` is append-only from the service role and records the provider
reference, reason, actor, amount and kind (`refund` or `reversal`). The
cumulative refunded amount cannot exceed the paid amount.

`payment_webhooks` is the service-role callback inbox. It deduplicates on
`(provider, external_event_id)`, stores only a sanitised payload plus a hash of
the raw body, and has no authenticated policy. `confirm_payment`,
`create_payment_intent`, `mark_payment_initiated`, `fail_payment`,
`refund_payment` and `touch_payment` are service-role-only `SECURITY DEFINER`
functions that repeat the amount, currency, reference and state checks.

Rules:

* A `workspace_id` from the browser is only used to look up membership; it never
  grants access by itself.
* Tenant-owned children use composite foreign keys
  `(workspace_id, parent_id) → parent (workspace_id, id)`, so a valid UUID from
  another tenant cannot be referenced even if RLS were bypassed.
* Ledger writes have no policies at all; only the `SECURITY DEFINER` financial
  RPCs can write `transactions` and `ledger_lines`.
* The plan catalogue is global and readable by any authenticated user; only the
  service role writes it.
* `payment_webhooks`, `otp_verifications` and `idempotency_records` have RLS
  enabled and no authenticated policy. They are service-role only.

## Storage

All buckets are private (`public = false`); the app serves short-lived signed
URLs. Object paths start with the tenant boundary:

| Bucket | Path | Read | Write |
| --- | --- | --- | --- |
| `kontaflow-business-documents` | `<workspace_id>/...` | any member | finance writers |
| `kontaflow-receipts` | `<workspace_id>/...` | any member | finance writers |
| `kontaflow-invoices` | `<workspace_id>/...` | any member | finance writers |
| `kontaflow-report-exports` | `<workspace_id>/...` | any member | finance writers |
| `kontaflow-workspace-logos` | `<workspace_id>/...` | any member | owner/admin |
| `kontaflow-profile-images` | `<user_id>/...` | owner only | owner only |

Delete is restricted to the uploader or a workspace manager. Malformed folders
fail closed through `app.uuid_or_null()` instead of raising during policy
evaluation. The legacy `kontaflow-documents` bucket remains for receipts created
before Phase 3.

## Service-role boundary

Webhooks and cron have no user session. `0010` wrappers accept an explicit
actor, verify an active membership, then set `request.jwt.claims` locally before
delegating to the user-facing RPC. They are granted to `service_role` only.

### USSD sessions (migration 0036)

`public.ussd_sessions` stores one short-lived row per provider `sessionId`:
phone, workspace/user, bounded JSON state, service code and `expires_at`.
Authenticated clients have no read or write policy; only `service_role` can
access it. The state holds the menu stage, selected kind/category, account and
currency, the last cumulative input, and a cached terminal response for
provider retries. The table is indexed by `expires_at` and
`(workspace_id, created_at desc)`.

USSD links use the same `channel_identities` verification columns as WhatsApp:
an HMAC of the six-digit code, a ten-minute expiry, an attempt counter and
`verification_method = 'ussd_link'`. `verified_at` is only set by the
service-role verification path, never by a browser update.

## Privacy and security tables (migration 0043)

| Table / function | Purpose |
| --- | --- |
| `security_events` | Append-only authentication, CSRF, rate-limit, upload, webhook and privacy events. Tenant members have no select policy; platform admins can read. |
| `security_rate_limits` | Durable rate-limit buckets keyed by hashed subject. Service-role only. |
| `account_deletion_requests` | User-initiated erasure workflow with `pending`, `in_review`, `approved`, `completed`, `rejected` and `cancelled` states. Owner can read and cancel their own request; staff update through service role. |
| `consume_security_rate_limit(text, int, int)` | Atomic fixed-window limiter used by auth, AI, payments, uploads, sync, USSD and WhatsApp paths. |
| `request_account_deletion(text, uuid)` | Opens one active request per user, writes a `privacy.deletion_requested` event. |
| `cancel_account_deletion(uuid)` | Cancels the caller's own pending request before completion. |

`privacy_consents` gains `locale`, `metadata` and `source` so the exact notice
and channel can be reconstructed. The active-consent unique index remains
scoped to `(user_id, consent_type, version) where revoked_at is null`.

## Platform administration tables (migration 0034)

| Table | Purpose |
| --- | --- |
| `platform_admins` | Operator identity, role (`super_admin`, `admin`, `support`) and active flag. Never a tenant membership. |
| `account_restrictions` | One active platform restriction per user, with severity, reason, expiry and lift metadata. |
| `platform_admin_audit_log` | Append-only audit of every platform command. |

`app.is_user_restricted(uuid, timestamptz)` is short-circuited into
`app.is_workspace_member` and `app.workspace_role`, and a restrictive
`account_not_restricted` RLS policy is installed on every existing public table
that already had RLS. Exemptions are `profiles`, `account_restrictions` and the
two platform-only tables. Read `docs/architecture/platform-administration.md`
before adding a table that should participate in tenant isolation.

## Scalability tables (migration 0044)

| Table / function | Purpose |
| --- | --- |
| `workspace_daily_financials` | Per-workspace, per-day income/expense/net rollup maintained by a delta trigger on `transactions`; `get_dashboard_summary` reads it for period totals and the monthly series. |
| `job_queue` | Durable background jobs with type, payload, workspace/actor, priority, attempts, lease, `available_at`, result and idempotency key. Service-role only. |
| `outbox_events` | Transactional outbox emitted by transaction, payment and subscription triggers; delivered at least once. Service-role only. |
| `app_cache` / `app_cache_locks` | Shared L2 JSON cache with TTL and stampede lock. Service-role only. |
| `enqueue_job`, `claim_jobs`, `complete_job`, `fail_job`, `reap_stale_jobs` | Queue lifecycle using `FOR UPDATE SKIP LOCKED`. |
| `claim_outbox`, `complete_outbox_event`, `fail_outbox_event` | Outbox delivery lifecycle. |
| `cache_get`, `cache_set`, `cache_delete_workspace`, `acquire_cache_lock` | Cache primitives used by `src/lib/cache/distributed.ts`. |
| `consume_security_rate_limit_v2` | Detailed rate-limit decision (`allowed`, `count`, `limit`, `remaining`, `reset_at`). |
| `get_operational_stats` | Queue/outbox/cache depth for `/api/health` and `/api/metrics`. |

Migration 0045 rewrites `get_dashboard_summary` to use the rollup; migration
0046 adds `get_operational_stats`; migration 0047 adds
`reap_stale_outbox_events` so a crashed outbox worker cannot strand deliveries
in `processing`. The rollup is derived data and is checked
against the posted ledger in the Phase 21 database tests.

## Running migrations

```bash
# Apply pending files (ledger: supabase_migrations.schema_migrations)
npm run db:push
npm run db:push -- --seed       # then supabase/seed.sql

# Rebuild a throwaway database and run every assertion
npm run test:db

# Local Supabase CLI equivalent
supabase migration up --local
```

The workflow is forward-only: once a migration has been applied anywhere, add a
new file. Never edit an applied file, and keep every statement idempotent where
PostgreSQL allows it (`if not exists`, `on conflict`, `drop ... if exists`).

## Test coverage

`npm run test:db` runs the full integration suite (376 assertions at the time of writing). The Phase 3 block covers
business-settings provisioning, plan catalogue linkage, invoice numbering,
invoice totals and locking, debt repayment and overpayment, reversal mirroring
and double-reversal protection, cross-tenant reads and writes for invoices,
debts, budgets, inventory, AI suggestions, notification preferences and offline
records, service-only table access, RLS presence on every public table, and
`security_invoker` on the compatibility views. Phase 10 covers platform totals,
operator RPCs, separation triggers, restriction enforcement, plan changes and
the last-super-admin guard. A lifecycle test deletes a whole
workspace that owns a sent invoice and a recorded payment, proving the
delete-protection triggers yield during a tenant cascade.
