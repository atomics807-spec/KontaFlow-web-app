# Offline-first bookkeeping

KontaFlow treats the network as unreliable, not as a prerequisite. A sale
recorded in a market with no signal is stored on the device, shown to the user,
and sent to the server exactly once when a connection returns.

## What is stored where

| Data | Location | Cleared |
| --- | --- | --- |
| Pending transactions and attachments metadata | IndexedDB `outbox` | After sync + 7 days, or on sign-out |
| Account, category and contact options | IndexedDB caches | On sign-out, or for another user on this browser |
| Recent transactions for offline context | IndexedDB `recentTransactions` | On sign-out |
| Queued natural-language requests | IndexedDB `aiCommands` | After the user confirms/dismisses, or on sign-out |
| App shell, offline pages, icons | Cache Storage | Versioned cache on service-worker update |

IndexedDB rows always carry `userId` and `workspaceId`. A shared browser is
purged of every other account's rows when a user signs in, and all rows are
removed before sign-out. The service worker never caches authenticated API
responses or tenant documents.

## Write path

1. `TransactionForm` or `/offline` creates a client UUID and writes the entry to
   the outbox with status `pending`.
2. `syncOutbox` is single-flight per user/workspace. It sends batches to
   `POST /api/sync` with the UUID as an idempotency key.
3. The route re-checks active workspace membership and `transactions:create`,
   validates with the same Zod schema as the web form, then calls
   `record_transaction` so RLS and ledger invariants still apply.
4. `synced` and `duplicate` are terminal successes. `conflict`, validation and
   permission failures move to `attention` and are shown to the user. Network,
   timeout, rate-limit and 5xx failures stay retryable.
5. Retries use exponential backoff with bounded jitter. Stale `syncing` rows are
   recovered after two minutes so a closed tab cannot strand a payment.

A UUID is an idempotency key, not permission to overwrite money. If the server
already holds that UUID with a different amount, kind, description or date, the
sync route returns `conflict` instead of reporting a false duplicate. The local
copy stays visible in "Saved on this device"; the user can retry or discard the
local copy after checking the server record. Discarding never deletes the
server transaction.

## Natural-language queue

When the assistant is unavailable, the message is stored locally with the same
locale and conversation id. `processAiQueue` retries it when the browser comes
online and asks the API for a draft with `requireConfirmation: true`. The queue
never confirms a transaction by itself; the user still reviews the command
preview.

## Service worker boundaries

`public/sw.js` uses:

* network-first navigation with `/en|fr|pcm/offline` and `/offline.html` as
  fallbacks, including gateway 5xx responses;
* stale-while-revalidate for static assets;
* cache-first for images and fonts;
* no runtime caching of `/api/*`, `/auth/*`, or authenticated documents.

Updates are versioned. A new worker waits; the app shows a refresh prompt and
only activates the new worker when the user accepts it, so a deploy cannot swap
code underneath an in-flight form.

## Low-data mode

`DataSaverProvider` follows the browser's `saveData` and
`prefers-reduced-data` signals and also offers a manual toggle in the app shell.
In low-data mode decorative images request lower quality, stop being
high-priority and load lazily; decorative motion and long transitions are
disabled. The preference is stored locally and is not a tenant record.

## Deployment notes

The service worker is a static asset. Both Vercel and Cloudflare serve it with
`no-cache` and `Service-Worker-Allowed: /` (see `next.config.ts`). Cloudflare
caching rules must not cache `/api/*`; authenticated responses already send
`no-store`.
