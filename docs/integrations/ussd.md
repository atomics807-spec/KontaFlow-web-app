# USSD integration

KontaFlow exposes a small, low-bandwidth USSD menu through Africa's Talking.
The menu is intentionally shorter than the web app: record a sale or expense,
read today/week totals, check receivables, and change the response language.

This document describes the provider contract and the manual setup. A sandbox
or test service code is not a live production channel. Do not describe USSD as
live until the provider callback, a real handset, the database migration and
the end-to-end checks below have all succeeded.

## Provider contract

Africa's Talking sends an HTTP `POST` with
`application/x-www-form-urlencoded` fields:

| Field | Meaning |
| --- | --- |
| `sessionId` | Provider session id. Required and used for replay protection. |
| `phoneNumber` | Caller number in international format. |
| `serviceCode` | The short code provisioned for the USSD application. |
| `text` | Cumulative input path, e.g. `1*500*2*1`. Empty on the first screen. |

The route returns plain text:

* `CON <body>` keeps the session open and waits for the next input.
* `END <body>` closes the session.

The callback is `POST /api/ussd`. It accepts the shared secret as
`?token=<USSD_CALLBACK_TOKEN>` or the `x-ussd-token` header. The token is
required; requests without it are rejected. Provider dashboards usually make
the query-string form easiest to configure.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `USSD_CALLBACK_TOKEN` | Yes | Shared secret in the callback URL. Generate a random value. |
| `USSD_SERVICE_CODE` | Recommended | Rejects callbacks for a different short code. |
| `USSD_SESSION_TTL_SECONDS` | No | Sliding session lifetime, default `180`, bounded 30–600. |
| `AFRICASTALKING_USERNAME` | Sandbox/testing | `sandbox` for the provider sandbox. |
| `AFRICASTALKING_API_KEY` | SMS only | Used by the outbound SMS adapter, not by the USSD callback. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | The callback resolves the linked tenant with the service role. |
| `OTP_HMAC_SECRET` | Recommended | Keys the six-digit phone-link code. Falls back to the service-role key, but a separate value is better. |
| `RATE_LIMIT_USSD_PER_MINUTE` | No | Per-phone process-local first gate, default `30`. |

Never commit sandbox keys, production keys or real customer phone numbers.
Use `.env.local` (ignored) or the deployment secret store.

## Link and verify a phone

A phone number is not trusted just because it was typed into a browser. The
link is created in **Settings → Connected channels**, then verified from the
handset:

1. An owner, administrator or another member with `integrations:manage` enters
   the number. `linkUssdChannel()` normalises it to E.164, stores an HMAC of a
   six-digit code, a ten-minute expiry, a zero attempt counter and
   `verification_method = 'ussd_link'`. The plaintext code is shown once in the
   settings screen and is never stored.
2. The user dials `USSD_SERVICE_CODE`. The callback finds the pending row and
   asks for the six-digit code.
3. A correct code sets `verified_at`, clears the hash/expiry, resets attempts
   and records consent. A wrong code increments attempts. After five failures
   the challenge is locked; the user must request a new code in Settings.
4. The success screen asks the user to dial again. The next session opens the
   main menu.
5. Unlinking deletes the channel identity. The unique `(channel, address)`
   constraint prevents one phone number from being linked to two workspaces.

If the number is not linked, the caller only receives an instruction to add it
in Settings. There is no self-registration path.

## Menu and workflows

```
KontaFlow
1 Sale
2 Expense
3 Today
4 Week
5 Debts
6 Language
0 Exit
Reply with a number.
```

### Sale or expense

```
1                      → CON amount prompt
1*500                  → CON category list (up to four categories + Cancel)
1*500*1                → CON "Record sale of 500 FCFA? 1 Confirm 2 Cancel"
1*500*1*1              → END recorded amount + cash on hand
1*500*1*2              → END cancelled
```

The same path works for option `2` (expense). Categories are read from the
workspace chart of accounts, prefer `Sales`/`Other income` for income and
`Transport`/`Food`/`Inventory`/`Other expenses` for expenses, then fill the
remaining slots alphabetically. `Stock purchases` is shown as `Inventory` and
`Other expenses` as `Other` so the four-line menu fits on a basic handset. A workspace with no categories gets a clear
message instead of a broken menu.

### Totals and debts

* `3` — today's sales, expenses, net and cash in the workspace timezone.
* `4` — rolling seven-day sales, expenses and net.
* `5` — open customer receivables, count and overdue total.

### Language

`6` opens English / Français / Pidgin. The choice is stored on the user's
profile, so it also applies to the web app and future channel messages.

## Session, validation and correctness

* `sessionId` is required. The callback loads `public.ussd_sessions` and
  rejects a missing, expired, wrong-phone or wrong-workspace session.
* The session deadline is sliding and defaults to 180 seconds. The provider may
  end a session earlier; the callback never accepts input after its own
  deadline.
* The cumulative `text` path must extend the previous path. A path that jumps
  or is replayed with a different prefix is rejected.
* A completed session caches its terminal response. Provider retries with the
  same path receive the cached `END` instead of a second write.
* Amounts are whole currency units, validated against the account currency.
  Zero, negative, fractional, separator-containing and non-numeric amounts are
  rejected. Authoritative amounts stay in integer minor units.
* Confirmation writes through `public.record_channel_transaction` with
  `channel = 'ussd'` and a stable idempotency key derived from
  `sessionId + text`. A retry returns the existing transaction.
* Responses are clamped to 182 characters including the `CON`/`END` prefix.
* Rate limiting runs before any database read. It is process-local; put a
  Cloudflare/WAF rule in front for a distributed deployment.
* The route does not log phone numbers or codes.

## Role and subscription enforcement

Every verified callback re-resolves:

* the active `workspace_members` row and role;
* account restrictions and platform-admin restrictions;
* the workspace subscription status and trial expiry.

Reads require `transactions:read` and a readable subscription. Writes require
`transactions:create` and a writable subscription. A `past_due` workspace is
read-only: totals are available, new entries are refused. Suspended members,
restricted accounts and inactive subscriptions receive a short explanation
rather than financial data.

## Manual provider setup

1. Apply the database migrations, including
   `20260101000036_phase12_ussd.sql`, and set `SUPABASE_SERVICE_ROLE_KEY`.
2. Create a USSD application/service in the Africa's Talking dashboard. In the
   sandbox, use the sandbox app and simulator; in production, use the approved
   short code and production credentials.
3. Set the callback URL to:

   ```
   https://<your-domain>/api/ussd?token=<USSD_CALLBACK_TOKEN>
   ```

4. Set the HTTP method to `POST` and the body type to
   `application/x-www-form-urlencoded`.
5. Set `USSD_SERVICE_CODE` to the exact short code the provider sends. If it is
   set, a mismatch is rejected.
6. Link and verify a test handset in **Settings → Connected channels**.
7. Test in the sandbox, then repeat with a production service code and a real
   handset. Keep the provider console open while testing so you can see
   callback errors and response bodies.

### Local callback check

With a verified test identity in the local database and the dev server running:

```bash
curl -sS -X POST "http://localhost:3000/api/ussd?token=$USSD_CALLBACK_TOKEN" \
  -H 'content-type: application/x-www-form-urlencoded' \
  --data-urlencode 'sessionId=local-test-1' \
  --data-urlencode 'phoneNumber=+237600000001' \
  --data-urlencode 'serviceCode=*384*1234#' \
  --data-urlencode 'text='
```

Expected: `CON KontaFlow ...`. Then send the next cumulative step with the same
`sessionId`, for example `text=2`, then `text=2*500`, then `text=2*500*1`, then
`text=2*500*1*1`. A successful confirmation ends with the recorded amount and
cash balance.

For a pending link, the first empty request returns the verification prompt;
send `text=<six-digit-code>` from the same number. A successful verification
returns `END Number verified. Dial again to use KontaFlow.`

## Production checklist

- [ ] `USSD_CALLBACK_TOKEN` is random, stored only in the deployment secret
      store, and present in the callback URL.
- [ ] `USSD_SERVICE_CODE` matches the provisioned short code.
- [ ] `OTP_HMAC_SECRET` is distinct and set.
- [ ] The migration is applied and `ussd_sessions` is service-role only.
- [ ] A real handset can link, verify, record a sale, record an expense and
      read all three summaries.
- [ ] Duplicate provider retries produce one transaction.
- [ ] A suspended member and a `past_due` workspace are refused correctly.
- [ ] Provider sandbox and production callbacks both return `CON`/`END`, not
      HTML error pages.
- [ ] Logs and monitoring are in place before announcing the channel as live.
