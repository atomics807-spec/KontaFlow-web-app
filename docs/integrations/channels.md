# Integrations

Each provider is isolated behind an adapter under `src/lib/integrations` or a
route handler, so a provider can be replaced without touching bookkeeping code.
Secrets are read through `getServerEnv()` and never reach the client bundle.

## Africa's Talking — USSD

Endpoint: `POST /api/ussd` (`application/x-www-form-urlencoded`).

Fields read: `sessionId`, `phoneNumber`, `text`, `serviceCode`.

Flow (menu state is encoded in `text`, so no session store is required):

```
""            → CON main menu (1 sale, 2 expense, 3 cash, 4 recent)
"1"           → CON ask amount
"1*12500"     → END recorded + new cash balance
"2*3000"      → END expense recorded
"3"           → END cash on hand
"4"           → END last three entries
```

Security and correctness:

* Optional `USSD_CALLBACK_TOKEN` must match `?token=` or `x-ussd-token`
  (constant-time compare). Set it in production.
* The phone number must exist in `channel_identities` (Settings → Connected
  channels). Unknown numbers get an instruction message instead of data.
* Entries are written through `public.record_channel_transaction`, which
  re-checks membership; `client_generated_id` makes gateway retries idempotent.
* Response bodies are plain text with `CON ` (continue) or `END ` prefixes, as
  the gateway expects.

Configure the callback URL in Africa's Talking as
`https://<app>/api/ussd?token=<USSD_CALLBACK_TOKEN>` and point the short code at
it. `AFRICASTALKING_API_KEY` is reserved for outbound SMS notifications.

## WhatsApp Business Platform (Meta Cloud API)

Endpoints:

* `GET /api/whatsapp` — verification handshake (`hub.mode=subscribe`,
  `hub.verify_token` must equal `WHATSAPP_VERIFY_TOKEN`, constant-time compare).
* `POST /api/whatsapp` — webhook. Requires a valid
  `X-Hub-Signature-256` HMAC over the raw body using `WHATSAPP_APP_SECRET`.
  Missing secret ⇒ 403 (fail closed). Bodies over 1 MB are rejected.

### Linking a number

A number is only trusted after the person proves control of it from WhatsApp.
Browser possession of a code is not proof.

1. An owner/admin opens **Settings → Connected channels**, selects WhatsApp and
   enters the number. `requestWhatsappLink()` normalises it to E.164 and stores
   an HMAC of a six-digit code (`verification_code_hash`), a 10-minute expiry
   and a 0/5 attempt counter. The plaintext code is returned to the browser
   once and never stored.
2. If `WHATSAPP_VERIFICATION_TEMPLATE_NAME` is configured, an approved
   authentication template is sent through the Cloud API. The template is
   optional; the code is always shown in the app.
3. The user sends `VERIFY 123456` from that WhatsApp number. The webhook
   verifies the HMAC, resolves the pending row, checks expiry/attempts, and
   marks it verified with `consent_at` and `consent_version`.
4. If the number is already verified or belongs to another workspace, the
   request is rejected. Unlink removes the row; the unique `(channel, address)`
   constraint prevents duplicates.

Authenticated clients no longer insert `channel_identities` directly: the
migration revokes insert/update/delete and the link workflow runs on the
service role after an active-membership and restriction check.

### Message pipeline

1. Verify the Meta HMAC over the raw body.
2. Claim each `message:<wamid>` once with `claim_webhook_event`; duplicates and
   concurrent deliveries are skipped. A two-minute lease allows crash
   recovery. Failures stay reclaimable; processed rows are terminal.
3. Resolve the sender through `channel_identities`. Pending rows may only
   complete the `VERIFY` challenge; commands require a verified row. In both
   cases re-check that the linked member is active, unrestricted, and still has
   the required role.
4. Open/refresh the 24-hour customer-service window from the inbound timestamp.
5. Route the text deterministically, or fall back to the assistant with the
   same audited tools as the web app (`serviceRole: true`).
6. Log inbound/outbound messages, update delivery statuses, and return 200 so
   Meta stops retrying. Genuine processing failures return 500.

### Commands

| Message | Action |
| --- | --- |
| `I spent 500 on transport.` | Assistant records an expense draft/entry with the same validation as the web app |
| `Show my sales today.` | Income, expenses, net and cash for today in the workspace timezone |
| `Generate my weekly report.` | Rolling seven-day report with top expense category |
| `How much do customers owe me?` | Open/part-paid receivable total and overdue amount |
| `Cash on hand` | Current cash balance |
| `HELP` / `AIDE` / `MENU` | Command list |
| `STOP` / `START` | Consent opt-out / opt-in |
| Anything else | Assistant fallback (reads and records through audited tools) |

French and Pidgin phrasing for the same intents is handled by the deterministic
router; unknown wording goes to the assistant. Replies are in the workspace or
profile locale.

### Windows, consent and provider limits

* Free-form replies are only sent inside the 24-hour window. Outside it the
  adapter refuses (`outside_window`); an approved template is required.
* `STOP` sets `opted_out_at`; all non-consent messages then receive the opt-out
  reply until `START`.
* Delivery statuses (`sent`, `delivered`, `read`, `failed`) are recorded without
  regressing to an earlier state. Provider error code/title are stored for
  support.
* Message ids and tool writes are idempotent. The assistant derives a stable
  per-message, per-tool-call key from `wa:<message-id>` and hashes it into
  `client_generated_id`, so a Meta retry cannot create a second transaction
  while two entries in one message stay distinct.

### Configuration

Create a Meta app, add the WhatsApp product, subscribe the webhook to
`messages`, and set:

* `WHATSAPP_VERIFY_TOKEN` — handshake token.
* `WHATSAPP_APP_SECRET` — signs every webhook; required.
* `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` — outbound sends.
* `WHATSAPP_BUSINESS_ACCOUNT_ID` — rejects events for other WABAs.
* `WHATSAPP_GRAPH_VERSION` — Graph API version (default `v27.0`).
* `WHATSAPP_DISPLAY_PHONE_NUMBER` — business number shown in instructions.
* `WHATSAPP_VERIFICATION_TEMPLATE_NAME` / `_LANG` — optional link template.
* `RATE_LIMIT_WHATSAPP_PER_MINUTE` — per-sender inbound limit.

## OpenAI — assistant

* Server-side only (`src/lib/ai/client.ts`); the browser talks to
  `/api/ai/chat` (session-authenticated, rate-limited per user).
* Tool calling is allow-listed:
  * `get_overview` — period totals, cash, top categories
  * `list_transactions` — recent entries filtered by kind/period
  * `record_transaction` — validates category/account/amount, then calls
    `record_transaction` with `channel = 'ai'`
  * `list_contacts` — customers and suppliers
* Multiple tool calls per turn are bounded; output is capped by
  `AI_MAX_OUTPUT_TOKENS`.
* Monthly quota comes from the workspace plan (`npm`-visible in the billing
  page); consumed through `consume_quota` (session) or
  `consume_channel_quota` (webhook).
* Without `OPENAI_API_KEY` the assistant UI shows a "not configured" state
  instead of failing.

## Resend — email

`sendEmail()` returns `{ sent: false, reason }` rather than throwing, so a
missing key never blocks a business action. Used for workspace invitations
(seven-day link) and the daily close digest.

## Payments

`PAYMENT_PROVIDER` selects the intended adapter (`none`, `mtn-momo`,
`orange-money`, `stripe`) and the schema already stores subscriptions, payment
transactions and usage. **No charge is executed today**; billing pages show the
plan catalogue, current plan, usage and payment history, and offer a contact
link when `EMAIL_REPLY_TO` is configured. Wiring a provider means implementing
`createCheckout`/`handleWebhook` behind the same interface and verifying its
signature exactly like the WhatsApp adapter.

## Offline sync

`src/lib/offline/outbox.ts` queues entries in IndexedDB when the browser is
offline and `POST /api/sync` flushes them. The server verifies the session,
scopes every row to the caller's workspace, and relies on
`client_generated_id` for idempotency. `sync_received_at` records when the
server accepted the batch, while `occurred_on` keeps the original business date.
