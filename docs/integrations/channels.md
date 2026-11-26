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
  `hub.verify_token` must equal `WHATSAPP_VERIFY_TOKEN`).
* `POST /api/whatsapp` — webhook. Requires a valid
  `X-Hub-Signature-256` HMAC over the raw body using `WHATSAPP_APP_SECRET`.
  Missing secret ⇒ 403 (fail closed).

Behaviour: the sender's number is resolved to a workspace through
`channel_identities`. Unlinked numbers get a polite instruction. Linked numbers
are answered by the assistant (`runAssistant` with `serviceRole: true`), which
can read totals and record transactions with the same validation as the web app.
Inbound and outbound messages are logged in `whatsapp_messages`.

Setup: create a Meta app, add the WhatsApp product, subscribe the webhook to
`messages`, set the verify token, and keep the app secret in
`WHATSAPP_APP_SECRET`. Reply messages use `WHATSAPP_PHONE_NUMBER_ID` and
`WHATSAPP_ACCESS_TOKEN`.

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
