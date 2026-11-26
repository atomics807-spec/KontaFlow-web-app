# API reference

All HTML routes are localised: `/{en|fr|wes}/...`. Machine endpoints live under
`/api` and never trust a workspace id supplied by the caller.

## Route handlers

| Route | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/ai/chat` | POST | Supabase session | Assistant turn; body `{ message, conversationId? }`; returns `{ reply, conversationId }` |
| `/api/sync` | POST | Supabase session | Flush offline outbox entries (idempotent per `clientGeneratedId`) |
| `/api/reports/export` | GET | Supabase session | CSV export for a period (`from`, `to`) |
| `/api/ussd` | POST | Optional shared token | Africa's Talking USSD menu |
| `/api/whatsapp` | GET/POST | Verify token / HMAC | Meta webhook handshake and inbound messages |
| `/api/cron/daily-digest` | GET/POST | `Authorization: Bearer $CRON_SECRET` | Emails the previous day's close to workspace owners |

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
| `get_dashboard_summary(workspace, from, to)` | authenticated | KPIs, cash, series |
| `get_report(workspace, from, to)` | authenticated | P&L, categories, daily series |
| `get_workspace_members(workspace)` | authenticated | Member directory (email + name) |
| `consume_quota(workspace, kind, limit)` | authenticated | Meters AI usage |
| `accept_invitation(token)` | authenticated | Email must match the invite |
| `record_channel_transaction(workspace, actor, channel, payload)` | `service_role` only | Webhook/cron writes; re-verifies actor membership |
| `consume_channel_quota(workspace, actor, kind, limit)` | `service_role` only | Channel AI usage |
| `get_workspace_summary_as_service(workspace, from, to)` | `service_role` only | Digest job |

## Offline payload

`POST /api/sync` accepts:

```json
{
  "entries": [
    {
      "clientGeneratedId": "uuid-or-device-id",
      "kind": "expense",
      "amountMinor": "3500",
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

Response: `{ "accepted": number, "duplicates": number, "errors": string[] }`.
