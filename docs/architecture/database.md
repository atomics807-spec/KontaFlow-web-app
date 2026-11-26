# Database architecture

PostgreSQL (Supabase) is the system of record. Migrations live in
`supabase/migrations` and are applied in filename order; `scripts/test-db.ts`
rebuilds a throwaway database from the same files on every run.

## Migration map

| File | Contents |
| --- | --- |
| `0001_extensions_and_types` | extensions, enums (`workspace_role`, `transaction_kind`, `entry_channel`, ...), helper schema `app` |
| `0002_tenants_and_access` | `profiles`, `workspaces`, `workspace_members`, `workspace_invitations`, roles, owner protection, new-user trigger |
| `0003_bookkeeping` | `accounts`, `categories`, `contacts`, `transactions`, `ledger_lines`, balance view, integrity triggers |
| `0004_ai_audit_channels_billing` | `ai_conversations`, `ai_messages`, `audit_logs`, `channel_identities`, `ussd_sessions`, `whatsapp_messages`, `subscriptions`, `payment_transactions`, `usage_events`, `notifications`, quota RPC |
| `0005_workspace_and_transaction_rpc` | `create_workspace`, `record_transaction`, `void_transaction`, `accept_invitation` (all re-check `auth.uid()`) |
| `0006_reporting` | `get_report`, `get_dashboard_summary` |
| `0007_rls_and_grants` | RLS enablement, per-table policies, privilege hardening |
| `0008_storage` | private receipts bucket + object policies |
| `0009_member_directory` | `get_workspace_members` |
| `0010_channel_ingestion` | service-role entry points for USSD/WhatsApp/cron: `record_channel_transaction`, `consume_channel_quota`, `get_workspace_summary_as_service` |

## Core tables

* `workspaces` — tenant root: name, legal name, slug, currency, timezone,
  locale, country, plan.
* `workspace_members` — `(workspace_id, user_id, role, status)`; one owner per
  workspace, enforced by trigger.
* `workspace_invitations` — email + role + single-use token, 7-day expiry.
* `accounts` — cash, mobile money, bank and system accounts (revenue,
  operating expense) created with each workspace.
* `transactions` — header row: kind, `occurred_on`, description, amount in minor
  units, currency, payment method, channel, `client_generated_id`,
  `sync_received_at`.
* `ledger_lines` — exactly two balanced lines per transaction; deferred
  constraint trigger rejects unbalanced postings.
* `audit_logs` — append-only actor/action/entity trail.
* `channel_identities` — maps a phone number to a user + workspace for USSD and
  WhatsApp.
* `subscriptions`, `payment_transactions`, `usage_events` — plan, billing history
  and metered AI usage.

## Money invariants

1. `amount_minor` is `bigint > 0`; direction comes from `kind`.
2. Both ledger lines sum to zero per transaction, checked at commit.
3. Posted transactions are immutable: corrections happen through
   `void_transaction`, which keeps the original row and writes an audit event.
4. Currency must match the workspace currency; the RPC rejects mismatches.

## Tenant isolation

RLS is enabled on every tenant table. Policies are intentionally simple and
reuse the `app.*` helpers, for example:

```sql
create policy transactions_select_member on public.transactions
  for select to authenticated
  using (app.is_workspace_member(workspace_id));
```

Writes to the ledger are not exposed as policies at all: the service role and
the two `SECURITY DEFINER` financial RPCs are the only writers, and both
re-derive the caller's membership from `auth.uid()`.

## Service-role boundary

Webhooks and cron have no user session. `0010` adds wrappers that accept an
explicit actor, verify an active membership, then set
`request.jwt.claims` locally before delegating to the user-facing RPC. This
means the same validation and audit path runs, and the wrappers are granted to
`service_role` only (`revoke ... from public, anon, authenticated`).

`tests` cover the interesting failures: an authenticated user cannot execute
the wrapper, and a service-role call with a non-member actor still fails with
`42501`.

## Running migrations

```bash
# Local Supabase CLI
supabase migration up --local

# Node runner (used by tests, works against Supabase via SUPABASE_DB_URL)
npm run db:push
npm run test:db        # rebuilds kontaflow_test from scratch
```
