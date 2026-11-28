# Repository notes for agents

## Commands

```bash
npm ci
npm run dev                 # Next.js dev server
npm run typecheck           # tsc --noEmit (must be clean)
npm test                    # vitest unit tests
npm run test:db             # rebuilds kontaflow_test and runs DB integrity assertions
npm run test:e2e            # production build + Playwright desktop/mobile journeys
npm run lint
npm run build
npm run db:push             # applies pending supabase/migrations via SUPABASE_DB_URL
npm run db:push -- --seed   # migrations, then supabase/seed.sql
npm run deploy:cloudflare   # opennextjs-cloudflare build && deploy
npm run deploy:cron:cloudflare # deploy the separate Cron Trigger Worker
npm run verify:production   # read-only env + migrations + RLS checks
npm run preview:cloudflare  # build and run the Worker locally
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

## Scheduled reports (Phase 15)

* `report_preferences` is per member (`workspace_id`, `user_id`) and controls
  language, cadence (`daily|weekly|monthly|off`) and channels. `daily` includes
  weekly and monthly; `weekly` includes monthly. A trigger seeds active members.
* `report_deliveries` is the idempotency and audit table, unique on
  `(workspace_id, user_id, kind, report_date, channel)`. Only the service role
  writes it; members may read their own rows and workspace managers may read
  all rows. Never delete a delivery row to force a resend.
* The `/api/cron/daily-digest` worker sends at 21:00 workspace time: daily
  closes for the previous day, weekly on Sunday and monthly on the last day.
  Cloudflare/Pro run it hourly; the default Vercel Hobby config runs once at
  20:00 UTC (21:00 Africa/Douala). It retries failed channels for two days with
  at most four attempts and turns stale `sending` rows into `failed`.
* In-app notices are deduplicated by the partial unique index
  `notifications_report_delivery_key` on `(workspace_id, user_id,
  data->>'report_kind', data->>'report_date')` where the channel is `in_app`.
* Email uses a Resend idempotency key per recipient/report. WhatsApp uses the
  free-form message inside the 24-hour service window and
  `WHATSAPP_REPORT_TEMPLATE_NAME` outside it; the approved template needs five
  body parameters: workspace, period, income, expenses and net.
* Report copy is localized per recipient (`en`, `fr`, `pcm`), independent of
  the recipient's UI locale. Use `src/lib/reports/scheduled.ts` for the report
  model and `src/lib/reports/data.ts` for the summary/report RPC reads.

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

## Low-literacy Easy Mode (Phase 23)

* Routes: `/[locale]/easy` (money dashboard) and
  `/[locale]/easy/record?kind=income|expense` (three-step recording). Both live
  in the dashboard group, so authentication, billing and workspace checks still
  apply, but `AppShell` swaps the sidebar for a slim header when the path starts
  with `/[locale]/easy`.
* The recording screen passes `simple` to `TransactionForm`. Keep that path on
  the same submit handler as the full form so validation, idempotency, audit and
  the offline outbox cannot drift. The simple path hides description/date/
  receipt inputs and generates a description from kind + category.
* Speech helpers live in `src/lib/easy/speech.ts`. `parseSpokenAmount` is pure and
  covered by `tests/easy-speech.test.ts`; read-aloud and recognition are browser
  APIs inside `src/components/easy/`. Recognition is optional; the number pad
  must always remain the complete flow.
* Category pictures live in `src/components/easy/category-glyph.tsx`. Add new
  default category names there when the seed catalogue grows.
* Easy copy lives under `easy.*` and `nav.easy` in all three dictionaries. Keep
  all visible strings in the dictionaries; the easy flows intentionally avoid
  paragraphs and jargon.
* Do not put advanced charts, tables or multi-field forms on Easy Mode. Large
  tap targets, icon + text labels, and a single primary action per step are the
  acceptance criteria.
* QA evidence: `docs/testing/phase-23-low-literacy-easy-mode-report.md`.

## Low-literacy reading comfort and help (Phase 24)

* `profiles.easy_mode` (migration `20260101000048`) is the persisted screen
  preference. New accounts start on the Simple screen; existing accounts were
  migrated to `false` (full dashboard) until they choose. Only
  `update (easy_mode)` is granted to `authenticated`; RLS still limits the row.
* Onboarding writes the choice from `input[name="uiMode"]`. Keep the `uiMode`
  field in `onboardingSchema` and pass it from `FormData`; the Zod default is
  `easy`.
* `/[locale]/dashboard` redirects Easy Mode owners to `/[locale]/easy`.
  `setEasyModeAction` switches both ways, persists the preference and revalidates.
* First visit shows `EasyGuide` (three picture panels, spoken). Completion is a
  local-storage flag; `?guide=1` reopens it. The voice preference is local
  storage in `src/lib/easy/audio.ts`, surfaced by `EasySoundToggle` and
  `useEasyAudio`. Easy recording speaks step prompts, errors and saved messages.
* `EasyBottomNav` replaces the sidebar destinations on Easy routes. Keep its
  items at 64 px and leave bottom padding on the easy main area.
* `SupportLinks` (Call/WhatsApp from `src/lib/contact-details.ts`) must stay on
  auth, Easy and full-shell (sidebar/drawer) surfaces. Use `variant="dark"` on
  the forest sidebar.
* QA evidence: `docs/testing/phase-24-low-literacy-ux-report.md`.

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
* `createWorkspaceAction` has a recovery boundary: it logs
  `workspace.onboarding_unhandled`, rethrows Next control flow, and redirects to
  the dashboard when `complete_onboarding` committed before a later step failed.
  Keep that ordering when adding post-RPC work such as uploads or emails.
* Member-facing entitlement reads use the caller's Supabase session; the
  service-role key is for webhooks/cron and must not be required to open a
  dashboard. `getWorkspaceEntitlementsAsService` is the explicit service path.
* `img-src` includes the configured Supabase origin so workspace logos work on
  self-hosted/local Supabase over `http://` while production keeps `https:`.
* QA evidence: `docs/testing/onboarding-completion-fix-report.md`.

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
* `/en|fr|pcm/offline` and `/offline.html` are the navigation fallbacks. The
  offline page owns its own online/visibility/service-worker listeners so a
  queued entry syncs as soon as connectivity returns, without requiring the
  user to reopen the dashboard.
* `SUPABASE_INTERNAL_URL` is optional and server-only. Local preview containers
  use it with `NEXT_PUBLIC_SUPABASE_URL=<preview-origin>/api/supabase`, which
  `src/app/api/supabase/[...path]/route.ts` forwards to the local stack. Hosted
  deployments leave it empty and point `NEXT_PUBLIC_SUPABASE_URL` directly at
  Supabase.
* `DataSaverProvider` follows `saveData`/`prefers-reduced-data` and offers a
  manual toggle in the app shell. Keep low-data behavior in presentational
  components, not in financial calculations.
* See `docs/architecture/offline-first.md` for the full contract.

## USSD channel

* Callback: `POST /api/ussd`, form fields `sessionId`, `phoneNumber`,
  `serviceCode`, `text`. Return plain text `CON ...` or `END ...`; responses
  are clamped to 182 characters in `src/lib/ussd/menu.ts`.
* `USSD_CALLBACK_TOKEN` is required (`?token=` or `x-ussd-token`). Do not make
  it optional again.
* The provider sends the cumulative `text` path. `parseUssdText` and the route
  enforce path continuity; do not treat `text` as a single current input.
* `public.ussd_sessions` is service-role only. It stores a bounded JSON state,
  sliding `expires_at`, last cumulative input and a cached terminal response.
  Never expose it to browser clients or log phone numbers/codes.
* Linking uses `src/services/ussd.ts`: a pending row holds an HMAC of a
  six-digit code, expiry and attempt counter; only the handset callback can set
  `verified_at`. Browser clients must not self-verify `channel_identities`.
* Verified callbacks re-check `buildChannelAccess` (membership, restrictions,
  subscription) before any read or write. `past_due` is read-only.
* Writes use `record_channel_transaction` with `channel = 'ussd'` and
  `ussdClientId(sessionId, text)` so provider retries are idempotent.
* Menu categories come from `listUssdCategories`; `Stock purchases` is shown
  as `Inventory` and `Other expenses` as `Other` for short USSD menus.
* Full setup and provider checklist: `docs/integrations/ussd.md`.

## Plans, entitlements and trials

* Plans are database configuration (`subscription_plans`, `plan_features`), not
  TypeScript constants. Read access through `getWorkspaceEntitlements`; never
  gate a feature from `workspaces.plan` in the browser.
* Feature keys are listed in `src/types/entitlements.ts`. Server code calls
  `requireFeature`/`assertFeature`; API handlers return HTTP 402 through the
  `plan_required` error code. Pages use `PlanGate`.
* Writes are also enforced in Postgres: `app.assert_transaction_limit` on every
  transaction insert (including service-role channels), seat checks on
  invitations, and workspace limits in `create_workspace`.
* A new workspace claims at most one trial per person/email/phone
  (`trial_grants`). Trials use `trial_plan_id`; expiry is `past_due` and
  read-only. `/api/cron/trial-reminders` sends the configured reminder days.
* Platform admins configure plans and trial settings at `/{locale}/admin/plans`.
  The RPCs require `super_admin` or `admin`; keep the explicit null-role guard.
* Apply `20260101000037_phase13_entitlements.sql` before deploying this code.

## Mobile-money payments

* Apply `20260101000038_phase14_payment_status.sql` and
  `20260101000039_phase14_payments.sql` before deploying.
* `payment_transactions` is owner/admin readable but authenticated clients have
  no insert/update/delete grant. `payment_refunds` and `payment_webhooks` are
  service-role only. Never add a browser policy for them.
* Checkout starts at `POST /api/payments` (`billing:manage`). The plan price,
  currency and merchant reference are resolved on the server; never accept an
  amount from the browser.
* A provider callback is only a hint. Verify the per-payment token/HMAC, store
  the event in `payment_webhooks`, then call the provider status endpoint.
  Only `confirm_payment` may activate a plan.
* The callback token is stored as a SHA-256 hash. Do not log raw tokens,
  provider credentials or full callback bodies.
* `PAYMENT_MODE=disabled` hides checkout. `PAYMENT_PROVIDER=none` offers every
  fully configured provider; set it to one id to narrow checkout.
* `PAYMENT_MODE=sandbox` with `PAYMENT_PROVIDER=demo` enables the explicit
  preview checkout in `src/lib/payments/providers/sandbox.ts`. It approves
  immediately, uses the normal `confirm_payment` path and moves no money. The
  gate never enables it for production or disabled mode; never ship it as a
  real provider.
* `/api/cron/payment-reconciliation` is the fallback for missed callbacks and
  runs in bounded batches. Keep the `CRON_SECRET` bearer check.
* Refunds are platform-admin only (`/api/admin/payments/[id]/refund`); the
  database caps cumulative refunds at the paid amount. MTN/Orange adapters
  report refunds as unsupported until the merchant contract confirms them.
* Full setup, provider contracts and the state machine:
  `docs/integrations/payments.md`.

## Trials and scheduled reports

* Apply `20260101000040_phase15_plan_reporting.sql` before deploying.
* Starter is a 14-day trial, not a free plan. It keeps the Starter
  allowances and features during the trial. When the trial ends the workspace
  is read-only until a paid plan is active.
* `/api/cron/daily-digest` sends each active workspace its report at 21:00
  local time, plus the weekly report on Sundays. Cloudflare/Pro run it hourly;
  the default Vercel Hobby config runs once at 20:00 UTC (21:00 Africa/Douala).
  Starter, Growth and Scale all have the `daily_reports`/`weekly_reports`
  features; expired trials stop receiving reports because the workspace is
  read-only.
* `report_deliveries` is the idempotency and audit table. It is service-role
  only (RLS enabled, no authenticated policy). A failed delivery is retried on
  the next run; a stale `sending` reservation is cleared after two hours.
* The cron calls `has_workspace_feature` as `service_role`; that function
  allows the service role but keeps the membership check for tenant users.

## Admin operations and transaction corrections

* Apply `20260101000042_phase16_admin_operations.sql` before deploying.
* Platform operations pages live under `/[locale]/admin/{support,usage,ai,email,ussd,whatsapp,security}`. Every page and server action calls `requirePlatformAdmin`/`guard`; the database repeats the `app.is_platform_admin()` check inside each RPC.
* `system_announcements` is readable by authenticated users only while active, and the RLS policy limits `audience = 'workspace_admins'` rows to active owners/admins. `email_deliveries` and `support_access_grants` are service-role only.
* Support access is time-boxed (1–72 hours), requires a written justification, cannot be self-approved, and is audited. The snapshot RPC increments `access_count` and refuses expired or revoked grants.
* `amend_transaction(p_transaction_id, p_payload, p_reason)` is the only correction path. It validates the workspace, records the replacement and voids the original inside one database transaction, linking them through `metadata.amends_transaction_id`. Never edit posted ledger rows in place.
* The dashboard quick-entry form reuses `record_transaction` with a per-submission `client_generated_id`; the AI command box calls `/api/ai/chat` with `requireConfirmation: true`, so it never posts without review.

## SEO, AEO and GEO

* Public marketing pages live under `src/app/[locale]/(marketing)` and must stay server-rendered. Never place tenant data or authenticated views in these routes.
* All public metadata goes through `marketingMetadata` in `src/lib/seo.ts`. It owns the canonical URL, `en`/`fr`/`pcm` hreflang links, `x-default`, Open Graph and Twitter fields. Do not add a global canonical in the root layout: it would override every child page.
* Pidgin pages append ` · Pidgin` to the display title because the `pcm` copy currently reuses English headlines. Keep titles unique across the 66 sitemap URLs.
* Private route groups export `robots: { index: false, follow: false, nocache: true }`. `src/app/robots.ts` also disallows app, auth and API paths. Login and signup are intentionally `noindex` and absent from the sitemap.
* `src/app/sitemap.ts` is the source of truth for indexable URLs. It includes only public marketing pages, legal documents and articles returned by `listPublishedArticles`. Drafts, future-dated articles, redirect aliases (`/product`, `/channels`, `/overview`) and private routes must not be added.
* Articles require `author`, `publishedAt`, `updatedAt`, `status`, `locale`, `canonicalPath` and `tags`. Use `articleCanonicalPath` for links and sitemap entries. Article pages return `notFound()` for drafts, future posts and unknown slugs.
* Structured data is rendered only through `JsonLd` from `src/components/seo/json-ld.tsx`, which escapes `<` before injecting JSON. Helpers live in `src/lib/structured-data.ts`: `Organization`, `WebSite`, `WebPage`, `BreadcrumbList`, `SoftwareApplication`, `Article` and `DefinedTermSet`.
* Do not emit `FAQPage` for ordinary marketing FAQs. Google restricts FAQ rich results to authoritative government and health sites. The public FAQ remains visible content; it is not marked up as `FAQPage`.
* AEO/GEO hubs are `/[locale]/compare` and `/[locale]/glossary`. Their copy lives in `src/lib/content/aeo.ts`; keep definitions short, factual and internally linked.
* Validation: `npx vitest run tests/seo.test.ts`, `npx structured-data-testing-tool --url <page>`, and Lighthouse. The local production baseline is SEO 100, best practices 100, accessibility 96 and performance 88 on mobile; LCP is dominated by the cold Next image optimizer, so measure on the deployed CDN before making ranking or speed claims.

## Phase 18 security hardening

* Apply `20260101000043_phase18_security_hardening.sql` before deploying. It adds
  `security_events`, `security_rate_limits`, `account_deletion_requests`, the
  durable limiter RPC and the deletion RPCs.
* `security_events` is append-only and service-written. Authenticated users have
  `select` but no matching RLS policy, so the table is empty for them;
  `security_rate_limits` is service-role only.
* Route Handlers that mutate cookie-authenticated state call
  `rejectCrossOrigin()` before parsing the body. It trusts `NEXT_PUBLIC_APP_URL`
  and `TRUSTED_ORIGINS`; do not add `X-Forwarded-Host` to the allow-list, because
  a client can spoof it when the app is directly reachable.
* `@supabase/ssr` hard-codes a 400-day cookie `maxAge` on write. Wrap its
  `setAll` options with `limitAuthCookie()` from
  `src/lib/security/cookies.ts`; preserve `maxAge: 0` so sign-out still clears.
* Uploads validate magic bytes, reject SVG, sanitise the filename and can call
  `MALWARE_SCAN_URL`. `MALWARE_SCAN_MODE=enforce` fails closed when the scanner
  is missing or unreachable.
* AI requests are rate-limited, body-capped and output-capped. User text,
  receipts, contacts and imports are untrusted data; interactive tools may only
  create drafts, and confirmation re-validates through audited RPCs.
* Privacy controls: `GET /api/privacy/export`, marketing consent, and the
  `request_account_deletion`/`cancel_account_deletion` RPCs. Financial records
  may outlive an account request for legal, tax, fraud or dispute reasons.
* Cameroon note: Law No. 2010/013 governs electronic communications, not personal
  data. The current personal-data act is Law No. 2024/017. See
  `docs/security/compliance-cameroon.md` before making compliance claims.
* Validation: `npm run typecheck`, `npm test` (240), `npm run test:db` (379),
  `npm run test:e2e` (26), `npm run lint`, `npm run build`,
  `npm run verify:production -- --local`.
* Deployment: `vercel.json` owns Vercel cron; `wrangler.jsonc` + OpenNext own
  Cloudflare; `workers/cron-trigger` calls the same cron routes. The Vercel Hobby
  config uses daily-only expressions; Cloudflare keeps per-minute queue and
  five-minute payment schedules. Platform env reads belong in
  `src/lib/platform/deployment.ts`. See
  `docs/deployment/production-checklist.md` before claiming production ready.
