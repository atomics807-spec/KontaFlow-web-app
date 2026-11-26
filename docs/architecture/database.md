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
| `0011_phase3_finance_ops` | transaction provenance/reversal columns, `business_settings`, `invoices`, `invoice_items`, `debts`, `debt_payments`, `budgets`, `financial_goals`, `inventory_items`, `financial_reports`, composite FK targets |
| `0012_phase3_platform` | `subscription_plans`, `subscription_features`, `plan_features`, `payment_webhooks`, `ai_interactions`, `ai_suggestions`, `notification_preferences`, `privacy_consents`, `otp_verifications`, `integration_accounts`, `integration_messages`, `offline_sync_records`, `idempotency_records`, compatibility views |
| `0013_phase3_integrity` | invoice totals/locking triggers, invoice numbering, debt repayment triggers, audit triggers, `reverse_transaction` |
| `0014_phase3_rls` | RLS and privileges for every Phase 3 table |
| `0015_phase3_storage` | five workspace buckets + profile images, tenant-scoped policies |
| `0016_phase3_cascade_deletion` | cascade-safe tenant deletion: deferred tenant FKs, workspace-delete marker, guards that yield only during a cascade |
| `0017_contact_messages` | inbound public contact form: `contact_messages` (service-role only, no tenant, RLS enabled, topic/status/locale checks) |

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
| audit_logs | `audit_logs` (append-only) |
| privacy_consents | `privacy_consents` |
| otp_verifications | `otp_verifications` |
| integration_accounts, integration_messages | same names |
| offline_sync_records | `offline_sync_records` |
| idempotency_records | `idempotency_records` |
| inventory | `inventory_items` |

The compatibility views are read-only and use `security_invoker = true`, so the
caller's RLS applies. Writes always go to the canonical table.

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

`npm run test:db` currently runs 105 assertions. The Phase 3 block covers
business-settings provisioning, plan catalogue linkage, invoice numbering,
invoice totals and locking, debt repayment and overpayment, reversal mirroring
and double-reversal protection, cross-tenant reads and writes for invoices,
debts, budgets, inventory, AI suggestions, notification preferences and offline
records, service-only table access, RLS presence on every public table, and
`security_invoker` on the compatibility views. A lifecycle test deletes a whole
workspace that owns a sent invoice and a recorded payment, proving the
delete-protection triggers yield during a tenant cascade.
