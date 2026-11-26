# Repository notes for agents

## Commands

```bash
npm ci
npm run dev                 # Next.js dev server
npm run typecheck           # tsc --noEmit (must be clean)
npm test                    # vitest unit tests
npm run test:db             # rebuilds kontaflow_test and runs DB integrity assertions
npm run lint
npm run build
npm run db:push             # applies pending supabase/migrations via SUPABASE_DB_URL
npm run db:push -- --seed   # migrations, then supabase/seed.sql
npm run deploy:cloudflare   # opennextjs-cloudflare build && deploy
```

Local Supabase: Docker container `supabase_db_KontaFlow-web-app`, psql as
`postgres` on the container. The Supabase CLI is not vendored (`npx supabase`
may prompt to install); applying a migration directly with
`docker exec -i <container> psql -U postgres -d postgres < supabase/migrations/<file>.sql`
works, but `supabase migration up` / `npm run db:push` is preferred.

## Conventions

* Money is `bigint` minor units (`MinorUnits` in `src/lib/money.ts`). Never use
  floats for amounts. Parse with `parseMoneyToMinor`, format with `formatMoney`.
* Every tenant table needs `workspace_id` plus an RLS policy using `app.*`
  helpers. Verify new tables have `enable row level security`; `npm run
  test:db` asserts that every public table does, and that each table has a
  policy or is explicitly service-only.
* Financial writes go through `record_transaction` / `void_transaction` (or the
  service-role wrapper `record_channel_transaction`). Do not insert into
  `transactions`/`ledger_lines` directly.
* Server actions live next to their route as `actions.ts`, validate with Zod,
  call `requireWorkspaceContext()` + `can(role, permission)`, and return
  `FormState` (`src/lib/action-utils.ts`).
* i18n: dictionaries in `src/lib/i18n/dictionaries/{en,fr,pcm}.ts` share one
  shape. `pcm` is Cameroon Pidgin English; `wes` only survives as a legacy
  URL/translation-row alias that maps to `pcm`. Add the key to all three or
  typecheck fails; `tests/i18n.test.ts` asserts parity. Use
  `interpolate()` for placeholders and plural blocks, and `intlLocale()` for
  dates/numbers. Tolgee overrides bundled values at runtime when configured.
* Secrets are read only via `getPublicEnv()` / `getServerEnv()` from
  `src/lib/env.ts`; keep `.env.example` in sync.
* Platform code must stay portable: no `@vercel/*` imports, no filesystem
  writes, no long-lived in-memory state (only the rate limiter, documented).

## Gotchas encountered

* `file_editor create` fails if the target directory does not exist; `mkdir -p`
  via terminal first.
* `npx supabase` triggers an install prompt; `docker exec ... psql` is the
  reliable path locally.
* Types for new RPCs/tables must be added to `src/types/database.ts`
  (`Functions` / `Tables`) or `supabase-js` rejects the call at compile time.
* A `"use server"` file may only export async functions. Keep constants, Zod
  schemas and types in a sibling module; exporting an object from the actions
  file fails the build with "can only export async functions".
* `generateMetadata` in `src/app/[locale]/layout.tsx` is the only global
  metadata source. Page titles update correctly on client navigation; the
  browser tool's cached tab title can lag, so verify with `document.title`.
* `@supabase/ssr` clients cannot set cookies from Server Components; active
  workspace changes happen in Server Actions or Route Handlers.
* Reports return `{ start, end }` from `monthBounds` but services expect
  `{ from, to }`; map explicitly.

## Database conventions (Phase 3)

* Financial corrections: use `reverse_transaction` after a period is reported
  (mirrored entry, single reversal, audited). Use `void_transaction` only
  before close. Never update amounts, dates, accounts or categories on a posted
  transaction.
* Child tables of tenant-owned parents use composite foreign keys
  `(workspace_id, parent_id) → parent (workspace_id, id)`. A plain `parent_id`
  FK is not enough to prove same-tenant ownership.
* Money derived from other money (invoice totals, `debts.paid_minor`) is
  computed by SQL triggers in integer minor units. Do not recompute it in the
  client or with floats.
* Issued invoices are immutable; only drafts can be edited or deleted. Debt
  payments are voided, never deleted, and overpayment is rejected.
* The plan catalogue (`subscription_plans`, `subscription_features`,
  `plan_features`) is global, seeded from `supabase/seed.sql`, and readable by
  authenticated users. Tenant billing rows stay owner/admin-only.
* Service-only tables (`payment_webhooks`, `otp_verifications`,
  `idempotency_records`) have RLS enabled and no authenticated policy. Read and
  write them through a server-only client.
* Compatibility views (`financial_accounts`, `customers`, `suppliers`,
  `transaction_categories`, `business_categories`) are read-only projections
  with `security_invoker`. Write to `accounts`, `contacts` or `categories`.
* Storage: private buckets only, path starts with `<workspace_id>/` (or
  `<user_id>/` for profile images). Never make a bucket public; serve signed
  URLs.
* Delete-protection triggers must call `app.is_workspace_cascade(workspace_id)`
  and yield. Otherwise an owner can never delete their workspace. Tenant FKs
  are `deferrable initially deferred` so cascade order is irrelevant.
* Migrations are forward-only. Add a new file; never edit an applied one. Use
  `npm run db:push` and record progress in
  `supabase_migrations.schema_migrations`.

## AI bookkeeping (Phase 8)

* Natural-language input flows through `/api/ai/chat` → `runAssistant` →
  OpenAI tools → `command-builder` → `ai_commands` (pending) → preview →
  confirm/dismiss/undo RPCs. Interactive tools never expose
  `record_transaction`; only the direct WhatsApp/USSD mode writes immediately
  through `record_channel_transaction`.
* `ai_commands` is creator-only and read-only for browsers. `UPDATE` is denied;
  lifecycle changes go through `confirm_ai_command`, `dismiss_ai_command`,
  `undo_ai_command` and `set_ai_command_reply`. Keep the creator check in any
  new RPC.
* Interactive drafts support multiple transactions, one debt or one debt
  payment per message. Builder failures must produce a localized clarification,
  never a guessed category, account or amount.
* Auto-post is opt-in per workspace and limited to one simple, matched,
  today-dated transaction under `ai_auto_post_max_minor`. It is not a security
  boundary; entries still use `channel='ai'` and remain reversible for 24 hours.
* Food and Water are starter categories; `create_workspace` seeds both so
  ordinary meal/water instructions match instead of falling back to "Other".
* `docs/architecture/ai-bookkeeping.md` documents the flow and limits.

## Design system (Phase 2)

* Tokens live in `src/app/globals.css`: raw brand palette in `@theme`, semantic
  colours in `@theme inline` backed by `:root` / `.dark` variables. Use
  `page`, `panel`, `panel-muted`, `line`, `heading`, `muted`, `accent*`,
  `danger*`, `warn*` — do not reintroduce `bg-white`, `bg-sand`, `text-forest`
  or raw jade/mango text on adaptive surfaces.
* Never redeclare `--color-ink`, `--color-line` or `--color-muted` in the plain
  `@theme` block; the literal overrides the runtime variable and dark mode
  loses its contrast (this happened and was fixed).
* Theme: cookie `kontaflow_theme` (`light|dark|system`), pre-paint script in
  `src/app/[locale]/layout.tsx`, `ThemeProvider` + `useTheme`,
  `ThemeToggle` (three-state, tooltips). `colorScheme: "light dark"` in viewport.
* Motion: `MotionProvider` wraps the app with `reducedMotion="user"`. Use
  `PageTransition`, `Reveal`, `SuccessCheck`; charts must gate Recharts
  animation with `useReducedMotion()`.
* UI kit in `src/components/ui`: dialog/confirm-dialog (native `<dialog>`),
  drawer, dropdown, toast, tooltip, skeleton, table, empty-state. Reuse these
  before writing bespoke markup.
* Marketing art is original SVG under `public/illustrations/`; load with
  `next/image` plus `unoptimized` (hand-authored SVGs, served statically).
* Design documentation: `docs/design/design-system.md`.

## Public marketing pages (Phase 2.1)

* Authenticated app routes and public pages share `src/app/[locale]/`. Public
  pages live in the `(marketing)` route group, whose layout renders
  `MarketingHeader`/`MarketingFooter` and `<main id="main">`.
* Routes: `/{locale}` (home), `overview`, `channels`, `product`, `security`,
  `pricing`, `contact`. Header/footer use real paths, never anchors. Add new
  public routes to `src/app/sitemap.ts` and give them `marketingMetadata`
  (`src/lib/seo.ts`) for canonical + hreflang.
* Shared page hero: `src/components/marketing/page-hero.tsx`; reusable sections
  stay in `src/components/marketing/sections.tsx`.
* Contact flow: `contact/page.tsx` + `contact/actions.ts` (server action)
  validate with `src/lib/validation/contact.ts`, rate-limit per IP, insert
  through the service-role client into `contact_messages`, and send a Resend
  notification to `CONTACT_INBOX_EMAIL` with the sender as `replyTo`. The form
  stores first, so a missing Resend key still captures the lead. A hidden
  `website` honeypot is checked before validation.
* Copy for the pages lives under `pages.*` in each locale dictionary. All three
  locales must keep identical keys (`satisfies Dictionary` enforces it at
  typecheck time).

## Identity and onboarding (Phase 4)

* Signup collects `first_name`, `last_name`, `phone`, `country_code`, locale and
  an explicit privacy consent. `privacy_consents` stores policy version,
  locale, IP and user agent. Add fields to the signup schema, action and all
  three dictionaries together.
* Phone OTPs live in `src/lib/otp.ts`: six digits from `crypto.randomInt`,
  HMAC-SHA256 with `OTP_HMAC_SECRET` bound to user + purpose, 10-minute TTL,
  60-second resend cooldown, five attempts. Only the hash reaches Postgres.
  `SMS_PROVIDER=console` prints codes and is development-only.
* `request_phone_verification` and `verify_phone_verification` are
  `SECURITY DEFINER` RPCs; `otp_verifications` stays service-role only. The
  verify RPC refuses a challenge whose destination no longer matches
  `profiles.phone`.
* Changing `profiles.phone` clears `phone_verified_at` and sets
  `verification_required = true` via trigger. Never write verification
  timestamps from the browser.
* `authenticated` has column-level update grants only on safe profile fields
  (`full_name`, `phone`, `locale`, `avatar_url`, `default_workspace_id`).
  `verification_required`, `*_verified_at` and `onboarding_completed_at` are
  not writable. Workspace grants exclude `owner_id`, `plan` and `slug`.
* `complete_onboarding` requires both channels verified, then creates the
  workspace, stores the business profile and marks onboarding complete in one
  transaction. The raw `create_workspace` RPC also blocks unverified owners via
  trigger.
* `requireVerifiedUser(locale, nextPath)` in `src/lib/supabase/auth.ts` drives
  the UI gate. Keep the default next path locale-prefixed.

## Finance operations (Phase 7)

* Routes: `/{locale}/accounts`, `/debts`, `/budgets`, `/invoices`,
  `/invoices/new`, `/invoices/[id]`. Server actions live in
  `src/app/[locale]/(dashboard)/finance/actions.ts`; reads and writes go
  through `src/services/finance.ts`.
* Invoice writes use the `create_invoice(jsonb)` / `issue_invoice(uuid)` /
  `void_invoice(uuid, text)` RPCs. Invoice totals are derived by triggers from
  integer quantities; never send totals from the client. Issued invoices are
  immutable and an invoice with payments cannot be voided.
* Repayments use `record_debt_payment(jsonb)`. When an account is selected the
  RPC also calls `record_transaction` so cash moves through the ledger; the
  existing triggers update `debts.paid_minor` and the linked invoice status.
  Overpayment is rejected in both the RPC and a constraint.
* Plan entitlement is checked with `has_workspace_feature(workspace_id, code)`.
  Invoicing is a `scale` feature. The catalogue is global; changing a tenant's
  plan means updating both `subscriptions.plan` and `plan_id`.
* Finance views (`v_account_balances`, `v_budget_progress`, `v_debts`,
  `v_invoices`) are `security_invoker`, so RLS applies to callers. Dashboard
  aggregates come from `get_dashboard_summary` and include receivables,
  payables, overdue balances and budget progress.
* Receipt files are private Storage objects addressed by
  `transactions.attachment_path`; upload/retrieve through
  `/api/receipts/upload` and `/api/receipts/[id]`. CSV export is
  `/api/transactions/export`.
* Shared invoice arithmetic lives in `src/lib/finance/calculations.ts` and
  mirrors the SQL triggers. Keep both sides in step; `tests/finance.test.ts`
  covers rounding.
* `get_workspace_members` must cast `auth.users.email` to `text`; the column is
  `varchar`, and a `RETURNS TABLE (... email text)` signature fails at runtime
  without the cast. Migration `20260101000029` fixes this.
* The invoices list `PAID` KPI sums `amount_paid_minor` across every non-void
  invoice, so partial payments appear immediately rather than only after an
  invoice reaches `paid`.

## Public contact, locale switching and exports

* Public contact details live in `src/lib/contact-details.ts`. Email is
  `info@kontaflow.com`; `673610903` is WhatsApp and calls, `672555075` is calls
  only. Office copy is Limbe, Cameroon. Change the module, not individual pages.
* `LocaleSwitcher` sets the locale cookie, persists the profile preference, then
  uses `router.replace` on the localized path while preserving query/hash. The
  locale layout keys `I18nProvider` by locale so client translations remount.
  Do not reintroduce `window.location.assign`; it caused a full reload and
  dropped page state.
* Users with `reports:export` can download CSV from
  `/api/transactions/export` and an itemized PDF from
  `/api/transactions/export/pdf`. Both honour workspace RLS, date/type/search
  filters, locale and the current currency/timezone. Settings and the
  transactions page both expose the links.
* Transaction PDF rendering lives in `src/services/transactions-pdf.ts`; keep
  Helvetica-safe text sanitization because pdf-lib standard fonts are WinAnsi.

## AI business advisor

* Phase 9 stores per-workspace advisor settings in `ai_workspace_preferences`
  (auto-provisioned, owner-write). `get_business_intelligence(uuid, date, date)`
  is the only analytics read path: `security definer`, enforces
  `app.is_workspace_member`, refuses when insights are disabled, and caps the
  window at 730 days.
* `src/services/business-intelligence.ts` parses the RPC JSON; do not do
  cross-workspace joins in TypeScript. `src/lib/ai/advisor.ts` derives facts and
  suggestions with integer minor units. Weekly category comparisons must require
  a positive previous amount before claiming an increase.
* `/insights` honours preferences and supports `?window=30|90|180|365|730`.
  Disabled intelligence renders the owner notice instead of calling the RPC.
* Migration 0033 enforces `history_retention_days`: `ai_conversations`,
  `ai_messages` and `ai_interactions` select policies hide rows older than the
  window, and old conversations cannot be updated back into view. The settings
  delete button calls `purge_ai_history(..., p_delete_all => true)` so it really
  removes every stored AI conversation while keeping `ai_commands` audit rows.
* Recharts series values are integer minor units. Do not pre-divide by currency
  decimals in pages; the chart formatters expect minor units and scale them
  themselves. `CashflowChart` formats `YYYY-MM` ticks with the active locale.

## Platform super administrators

* Platform operators live in `public.platform_admins` (`super_admin`, `admin`,
  `support`) and never in `workspace_members`; triggers reject both directions
  of tenant linkage. The console is `/{locale}/admin`, protected by the request proxy
  and `requirePlatformAdmin`, and uses its own `AdminShell`.
* `app.is_user_restricted` is wired into `app.is_workspace_member` and
  `app.workspace_role`, so every existing tenant policy and `SECURITY DEFINER`
  financial RPC closes for a restricted account. Migration 0034 also adds a
  restrictive `account_not_restricted` policy to every existing RLS table.
  Exemptions: `profiles`, `account_restrictions` and the platform-only tables.
* Restriction RPCs write `platform_admin_audit_log`. `limited` closes tenant
  data but allows sign-in; `suspended` also sets a GoTrue `ban_duration` from
  the server action. Keep the DB expiry and Auth ban in sync when changing the
  restriction flow.
* No platform administrator account, seed script or default credential is
  committed. Provision the first operator out of band with Supabase Auth and the
  SQL steps in `docs/architecture/platform-administration.md`, then manage
  further operators from the console. Never commit operator emails or passwords.
* The auth sign-in action special-cases platform admins before the tenant
  verification redirects, and tenant pages redirect platform admins to `/admin`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Offline-first / PWA

* IndexedDB (`src/lib/offline/db.ts`, Dexie) holds the outbox, cached options,
  AI queue and the last bootstrap. Every row carries `userId` and
  `workspaceId`; purge other users on sign-in and purge everything on sign-out.
* `syncOutbox` is single-flight per user/workspace and uses the client UUID as
  the idempotency key. The server (`/api/sync`) re-checks membership and
  `transactions:create`, validates with the shared Zod schema and calls
  `record_transaction`. Never trust a client-supplied workspace id alone.
* Treat a UUID mismatch as a conflict, not a duplicate: `hasIdempotencyConflict`
  protects against overwriting a different transaction.
* Backoff constants live in `src/lib/offline/policy.ts`; do not inline retry
  delays in components. Recover stale `syncing` rows before each batch.
* `public/sw.js` must keep `/api/*`, `/auth/*` and authenticated documents out
  of runtime caches. Bump `VERSION` on every behaviour change; the app prompts
  before activating a waiting worker.
* `/en|fr|pcm/offline` and `/offline.html` are the navigation fallbacks.
* `DataSaverProvider` follows `saveData`/`prefers-reduced-data` and offers a
  manual toggle in the app shell. Keep low-data behavior in presentational
  components, not in financial calculations.
* See `docs/architecture/offline-first.md` for the full contract.
