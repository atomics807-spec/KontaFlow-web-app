# Mobile money payments

KontaFlow supports subscription payments through **MTN Mobile Money
(Collections)** and **Orange Money Web Payment**, with an optional generic
aggregator adapter. A payment is never treated as successful because a browser
said so. The server creates a pending row, starts the provider request, and
activates the subscription only after a verified callback **and** an
authoritative provider status check.

## Supported flow

1. An owner or admin chooses a paid plan on `/{locale}/billing`.
2. `POST /api/payments` validates the session, workspace role, plan and
   idempotency key. The browser never supplies an amount, currency or provider
   reference.
3. The server inserts a `pending` `payment_transactions` row with an expiry,
   a unique merchant reference, the exact plan price in minor units and a
   SHA-256 hash of a per-payment callback token.
4. The selected adapter starts the provider request:
   - MTN: `POST /collection/v1_0/requesttopay`, with `X-Reference-Id`,
     `X-Target-Environment` and `X-Callback-Url`.
   - Orange: `POST /orange-money-webpay/cm/v1/webpayment`, returning a hosted
     `payment_url` and `pay_token`.
   - Aggregator: the configured create endpoint.
5. The row becomes `processing`. The customer approves on the provider's
   approved channel (USSD prompt, Orange page, or aggregator page).
6. The provider calls `POST|PUT /api/webhooks/payments/{provider}`.
7. The callback is authenticated, deduplicated in `payment_webhooks`, and the
   server calls the provider's status endpoint. The callback body is not
   trusted as proof of payment.
8. The status endpoint must return `SUCCESSFUL`/`paid`, the exact expected
   amount in minor units, the exact currency, and a matching provider
   reference. Only then does `confirm_payment` activate the subscription and
   write the audit + notification records.
9. `/api/cron/payment-reconciliation` polls pending/processing rows as a
   fallback, oldest first, in bounded batches of five with up to 20 rows per
   run. MTN's standard callback is sent once with no retry, so polling is
   required for reliability.

## Provider notes

### MTN MoMo Collections

- Developer portal: <https://momodeveloper.mtn.com/>
- Callback guidance: <https://momodeveloper.mtn.com/api-documentation/callback>
- Collections API reference: <https://momodeveloper.mtn.com/API-collections>
- Sandbox host: `https://sandbox.momodeveloper.mtn.com`
- Production host: `https://proxy.momoapi.mtn.com`
- Authentication: subscription key plus an API user/API key created for the
  Collections product. The adapter obtains a short-lived bearer token from
  `/collection/token/` for each operation; it does not cache credentials.
- `X-Target-Environment` defaults to `mtncameroon`. Change it only after MTN
  confirms the production target for the merchant account.
- MTN documents that the callback is sent **once** and has no retry mechanism.
  KontaFlow therefore requires the reconciliation job and an authoritative
  `GET /collection/v1_0/requesttopay/{referenceId}` before activation.
- MTN's standard callback has no signature. KontaFlow verifies the per-payment
  callback token in the URL and then fetches the transaction status. If the
  merchant or an aggregator signs callbacks, set `MTN_MOMO_WEBHOOK_SECRET` and
  the adapter will also require that HMAC.

### Orange Money Web Payment

- Developer portal: <https://developer.orange.com/apis/om-webpay>
- The adapter uses the OAuth client-credentials endpoint
  `/oauth/v3/token`, then the configurable web payment and transaction status
  paths. Defaults are the Cameroon Web Payment paths:
  `/orange-money-webpay/cm/v1/webpayment` and
  `/orange-money-webpay/cm/v1/transactionstatus`.
- The merchant key, OAuth client and product availability must be approved by
  Orange for the merchant account. The exact path or contract can differ by
  country/product; keep `ORANGE_MONEY_WEBPAY_PATH` and
  `ORANGE_MONEY_STATUS_PATH` configurable and confirm them with Orange during
  onboarding.
- The adapter stores only a hash of the Orange `notif_token`. It also verifies
  the per-payment callback token and re-fetches status before activation.

## Environment

Set `PAYMENT_MODE` to `sandbox` or `production` and provide the matching
provider credentials. With `PAYMENT_MODE=disabled`, or with incomplete
credentials, the provider is hidden from checkout and the API returns a
configuration error. `PAYMENT_PROVIDER` is an optional allow-list: `none`
offers every fully configured provider, while `mtn-momo`, `orange-money` or
`aggregator` narrows checkout to one. `stripe` is reserved and currently
disables mobile-money checkout. There is no mock-success path in production
code.

See `.env.example` for the full list. Never commit real keys, merchant keys,
OAuth secrets or callback tokens.

## Database and state machine

`payment_transactions.status` can be:

```
pending -> processing -> succeeded
                      -> failed
                      -> expired
succeeded -> refunded (full refund) | reversed (full reversal/chargeback)
succeeded -> succeeded with refunded_amount_minor (partial refund)
```

Important columns:

- `merchant_reference` — server-generated, unique, sent to the provider.
- `provider_ref` — provider-issued reference; unique per provider.
- `amount_minor` / `currency` — authoritative plan price snapshot.
- `webhook_token_hash` — SHA-256 of the per-payment callback token.
- `idempotency_key` — unique per workspace for retry-safe initiation.
- `refunded_amount_minor` — cumulative refunds; never exceeds the paid amount.
- `expires_at`, `last_checked_at`, `reconciled_at` — reconciliation state.

`payment_webhooks` is a service-role-only inbox keyed by
`(provider, external_event_id)`. `payment_refunds` records every provider refund
or manual reversal. Both tables have RLS enabled and no authenticated policy.

The service-role RPCs repeat all critical checks:

- `create_payment_intent` validates the plan, price, currency and provider.
- `confirm_payment` locks the payment, checks provider reference, amount,
  currency and plan price, then activates the subscription.
- `fail_payment` cannot downgrade a successful payment.
- `refund_payment` enforces the cumulative refund cap and applies the
  subscription consequence.

## API surface

| Route | Purpose |
| --- | --- |
| `POST /api/payments` | Create a pending payment and start the provider request. Requires `billing:manage`. |
| `GET /api/payments/{id}` | Poll and reconcile one payment. Returns no provider secrets. |
| `POST|PUT /api/webhooks/payments/{provider}` | Provider callback inbox. Validates token/HMAC, deduplicates and reconciles. |
| `GET|POST /api/cron/payment-reconciliation` | Bearer `CRON_SECRET`; polls pending payments. |
| `POST /api/admin/payments/{id}/refund` | Platform admin refund or reversal. Requires admin/super-admin. |

The webhook route limits body size, rate-limits by provider/IP, stores only a
sanitised event payload, and returns `500` only when a retry could help.

## Refunds and reversals

Automatic refunds are provider-account dependent. The MTN Collections and
Orange Web Payment adapters report `supported: false` unless the merchant
account has a confirmed refund API; they do not fabricate a refund. Platform
admins can still record a verified provider refund through the admin route, or
record a chargeback reversal. A full voluntary refund marks the subscription to
cancel at period end; a full reversal marks it `past_due`.

## Tests

Unit tests cover amount/phone helpers, HMAC/token verification, provider
allow-listing and checkout validation (including rejection of client-supplied
amounts). Database tests cover RLS, service-only tables, idempotency,
amount/currency/reference validation and activation. No test uses a
mock-success adapter in place of the real code path.

## Operational checklist

1. Apply migrations `20260101000038` and `20260101000039`.
2. Complete MTN Collections and Orange Money merchant onboarding.
3. Set sandbox credentials and `PAYMENT_MODE=sandbox`.
4. Confirm the callback URL is public HTTPS and reachable by the provider.
5. Run one real sandbox payment end to end, including callback and status poll.
6. Set production credentials and `PAYMENT_MODE=production`.
7. Schedule `/api/cron/payment-reconciliation` every five minutes.
8. Monitor `payment_webhooks` failures and `payment_transactions` rows stuck in
   `processing`.
