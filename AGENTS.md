# Repository notes for agents

## Commands

```bash
npm ci
npm run dev                 # Next.js dev server
npm run typecheck           # tsc --noEmit (must be clean)
npm test                    # vitest unit tests
npm run test:db             # rebuilds kontaflow_test and runs 56 DB assertions
npm run lint
npm run build
npm run db:push             # applies supabase/migrations via SUPABASE_DB_URL
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
  helpers. Verify new tables have `enable row level security`.
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
