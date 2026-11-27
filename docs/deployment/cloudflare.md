# Cloudflare Workers deployment

KontaFlow is compiled with `@opennextjs/cloudflare` and deployed as a Worker
with static assets. The adapter is the only Cloudflare-specific dependency;
application code uses standard Next.js, `node:crypto` through the
`nodejs_compat` flag, and Supabase over HTTPS.

## Files

| File | Purpose |
| --- | --- |
| `wrangler.jsonc` | Worker entry, assets, R2 cache binding, Images binding, compatibility flags |
| `open-next.config.ts` | OpenNext Cloudflare configuration with the R2 incremental cache |
| `public/_headers` | Long-lived cache headers for `/_next/static`, icons and fonts |
| `workers/cron-trigger/` | Small Worker with Cron Triggers that calls the app's cron routes |
| `.dev.vars.example` | Local Wrangler variables template |

## Required bindings

| Binding | Type | Purpose |
| --- | --- | --- |
| `ASSETS` | Static assets | `.open-next/assets`, served by the Worker |
| `WORKER_SELF_REFERENCE` | Service binding | Lets the Worker call itself for internal fetches |
| `NEXT_INC_CACHE_R2_BUCKET` | R2 bucket | Next.js incremental cache; create `kontaflow-next-cache` |
| `IMAGES` | Cloudflare Images | `next/image` optimization |

Create the R2 bucket once per account:

```bash
npx wrangler r2 bucket create kontaflow-next-cache
```

`compatibility_flags` must include `nodejs_compat`; the app uses
`node:crypto` for HMAC signatures, OTP hashing and constant-time comparison.
Do not add `export const runtime = "edge"` to routes; OpenNext does not support
it. The app uses the Node runtime and does not read or write the local
filesystem.

## Build and preview

```bash
npm ci
npx opennextjs-cloudflare build
npm run preview:cloudflare
```

`preview:cloudflare` builds and serves the Worker locally with Wrangler. Use it
to test the actual Workers runtime, not just `next dev`.

## Secrets and variables

Public values are embedded at build time and must be present when
`opennextjs-cloudflare build` runs. Server-only values should be Worker secrets:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put CRON_SECRET
npx wrangler secret put OTP_HMAC_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put USSD_CALLBACK_TOKEN
npx wrangler secret put WHATSAPP_ACCESS_TOKEN
npx wrangler secret put WHATSAPP_APP_SECRET
npx wrangler secret put WHATSAPP_VERIFY_TOKEN
npx wrangler secret put HEALTHCHECK_TOKEN
# Add the payment provider secrets you use.
```

Non-secret values can stay in `wrangler.jsonc` under `vars` (for example
`APP_ENV`, `DEPLOYMENT_TARGET`, `NEXT_PUBLIC_DEFAULT_LOCALE`) or be set with
`wrangler secret put` when they differ per environment. `NEXT_PUBLIC_*` values
must be available at build time; use a CI environment file or `wrangler.jsonc`
`vars` for non-secret public values.

Never commit `.dev.vars`, `.env.production` or real credentials.

## Custom domain and TLS

1. Add `app.kontaflow.com` as a Custom Domain on the Worker in the Cloudflare
   dashboard, or add a route in `wrangler.jsonc`.
2. Cloudflare issues the edge certificate. Set SSL/TLS mode to **Full (strict)**
   and enable Always Use HTTPS.
3. Enable WAF managed rules, bot fight mode and rate limiting for `/api/*`.
4. Add the final origin to Supabase Auth redirect URLs, exactly as for Vercel.

## Scheduled jobs

Cloudflare Cron Triggers invoke the `scheduled()` handler, not an HTTP route.
KontaFlow keeps the OpenNext Worker free of cron logic and deploys a separate
small Worker that calls the authenticated cron endpoints:

```bash
npx wrangler secret put CRON_SECRET --config workers/cron-trigger/wrangler.jsonc
npm run deploy:cron:cloudflare
```

Set `APP_URL` in `workers/cron-trigger/wrangler.jsonc` to the production origin
before deploying. The worker maps the three cron expressions to:

| Cron | Route |
| --- | --- |
| `0 * * * *` | `/api/cron/daily-digest` |
| `0 8 * * *` | `/api/cron/trial-reminders` |
| `*/5 * * * *` | `/api/cron/payment-reconciliation` |

The app still validates `Authorization: Bearer $CRON_SECRET`; the cron Worker
only supplies the schedule and the secret. This keeps the job portable and
avoids relying on an OpenNext internal scheduled export.

## Storage

- Application uploads go to Supabase Storage, never to the Worker filesystem.
- R2 is used only for the Next.js incremental cache. It is not a tenant data
  store and must not be exposed publicly.
- Do not make R2 buckets public. Tenant files are private Supabase buckets with
  RLS and short-lived signed URLs.

## Deploy

```bash
npm run verify:production
npm run deploy:cloudflare
```

Then verify:

```bash
curl -H "Authorization: Bearer $HEALTHCHECK_TOKEN" \
  https://app.kontaflow.com/api/health
```

Check Worker logs in the Cloudflare dashboard and confirm the cron Worker has
run at least once.

## Worker limits and portability

- Worker size limit: 3 MiB compressed on Free, 10 MiB on Paid. The current
  build is about 3.8 MiB gzipped, so deploy on the Workers Paid plan. Check the
  `wrangler` upload output after each release.
- Next.js 16 `proxy.ts` (Node middleware) is supported experimentally by
  `@opennextjs/cloudflare` 1.20.x. The build prints a warning; re-test auth,
  locale redirects and security headers after each adapter upgrade.
- `nodejs_compat` provides `node:crypto`, but not the whole Node standard
  library. Do not add filesystem, child-process or native-module code to
  request paths.
- `next/image` uses the `IMAGES` binding. Keep explicit dimensions and avoid
  unbounded remote images.
- Long jobs are avoided. The digest processes at most 200 workspaces per
  invocation; shard with an env-driven offset if the tenant count grows.
- HTML is tenant-specific and must stay `no-store`; only static assets are
  cached aggressively.
