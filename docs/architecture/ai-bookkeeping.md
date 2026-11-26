# AI bookkeeping

KontaFlow accepts plain-language bookkeeping instructions and turns them into a
reviewable draft. The model never receives direct SQL access and never posts a
ledger entry from a web request without an explicit confirmation (or an
explicitly enabled auto-post rule).

## Flow

```text
user message
  → /api/ai/chat
  → runAssistant (session, workspace-scoped)
  → OpenAI tool call
  → propose_transactions | propose_debt | propose_debt_payment
  → command-builder (deterministic validation + money coercion)
  → ai_commands row (status=pending)
  → CommandPreview
  → confirm / dismiss / undo route
  → SECURITY DEFINER RPC
  → record_transaction / debt insert / record_debt_payment
```

Read tools (`get_overview`, `list_transactions`, `list_contacts`) run inside the
caller's RLS context. Interactive tools do not include `record_transaction`, so
the model can only draft. WhatsApp/USSD use `mode="direct"` and the service-role
client; their write path goes through `record_channel_transaction`.

## Backend modules

| File | Responsibility |
| --- | --- |
| `src/lib/ai/schemas.ts` | Zod schemas for model proposals and persisted previews |
| `src/lib/ai/command-builder.ts` | Matches categories, accounts and contacts; parses money to minor units; builds transaction, debt and repayment actions |
| `src/lib/ai/prompt.ts` | System prompts with the workspace reference data and today's date |
| `src/lib/ai/tools.ts` | Read tools, interactive proposal tools, direct-channel write tool |
| `src/lib/ai/assistant.ts` | OpenAI tool loop, persistence, quota and auto-post |
| `src/services/ai-commands.ts` | RLS-backed command reads and RPC calls |
| `src/components/assistant/*` | Chat and draft review UI |

## Data model

`ai_commands` is immutable to browser clients. It stores the parsed preview,
the assistant reply, the request id, status (`pending`, `confirmed`, `dismissed`,
`reversed`, `failed`), the confirmation result and the undo window. RLS lets a
user read only their own drafts in a workspace they belong to; there is no
`UPDATE` grant.

The command lifecycle is enforced in SQL:

* `confirm_ai_command` checks finance permission, draft ownership, expiry and
  status, then calls the existing audited RPCs. Repeated confirmation returns
  `already_confirmed` without duplicating entries.
* `dismiss_ai_command` is creator-only and idempotent.
* `undo_ai_command` is creator-only, limited to transaction drafts and the
  24-hour window. It calls `reverse_transaction` for every posted entry.
* `set_ai_command_reply` lets the server record the final reply after auto-post.

## Money and dates

Amounts are stored and compared as integer minor units. The model returns a
string such as `"1000"`; `parseMoneyToMinor`/`toSafeNumber` run at the boundary.
The builder rejects zero, negative, non-numeric and over-limit amounts. Dates
come from `todayInZone(workspace.timezone)` so `Africa/Douala` remains the
default but a workspace can override it.

## Auto-post

Auto-post is off by default. It requires all of the following:

1. `business_settings.ai_auto_post` is enabled by an owner/admin.
2. The draft is eligible: one transaction, no transfer, a named asset account,
   a matched category (not the "Other" fallback), no contact, and today's date.
3. The total is at or below `ai_auto_post_max_minor`.

The setting is a posting preference, not a security boundary. Even auto-posted
entries go through the same validated RPC and are recorded with
`channel='ai'`; undo remains available for 24 hours.

## Limits and failure behavior

* A message can create at most 10 entries; each amount is capped at 1 trillion
  minor units (10 billion XAF).
* If the model omits an amount, category, account, contact or debt, the builder
  returns a localized clarification instead of guessing.
* If OpenAI is unavailable, the route returns a safe 503 message and no draft.
* If the database write fails, the route returns an error and the user can
  retry with the same request id; duplicate confirmation is idempotent.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run test:db
npm run build
```

`tests/ai-command-builder.test.ts` covers multi-expense parsing, category/account
matching, clarifications, transfers, debts and repayments. `scripts/test-db.ts`
covers Phase 8 RLS, creator-only confirmation/dismissal, idempotency, balanced
AI entries, auto-post flags, debt posting and reversal.
