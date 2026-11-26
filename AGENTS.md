# Repository notes for agents

## Commands

```bash
npm ci
npm run dev                 # Next.js dev server
npm run typecheck           # tsc --noEmit (must be clean)
npm test                    # vitest unit tests
npm run test:db             # rebuilds kontaflow_test and runs 105 DB assertions
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
* i18n: dictionaries in `src/lib/i18n/dictionaries/{en,fr,wes}.ts` share one
  shape. Add the key to all three or typecheck fails; `tests/i18n.test.ts`
  asserts parity. Use `interpolate()` for placeholders.
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
