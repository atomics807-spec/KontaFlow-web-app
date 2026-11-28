# Onboarding completion error — fix report

## Reported symptom

After finishing the onboarding form and pressing **Create workspace**, the
browser showed Next.js's static server-error page:

> This page couldn't load
> A server error occurred. Reload to try again.

That text comes from the built-in global error page, so the failure was an
uncaught server-side exception, not a form-validation message.

## Investigation

The clean local path was exercised end to end against a real Supabase stack:

- PostgreSQL 17.12, GoTrue, PostgREST, Storage and Kong from `npx supabase start`
  on `127.0.0.1:54321`.
- Demo account `onboarding@demo.kontaflow.app`, verified but with no workspace.
- Both `next dev` and a production `next build` + `next start`.
- Submissions with and without a workspace logo.

The clean path completed successfully in every run and landed on
`/{locale}/dashboard?welcome=1`. The original browser/network environment was
not available, so the exact production error could not be replayed. Two
deterministic uncaught-exception paths were found and removed.

### 1. Dashboard entitlements required the service-role key

`DashboardLayout` calls `getWorkspaceEntitlements()`. That service always used
`createAdminClient()`, which throws when `SUPABASE_SERVICE_ROLE_KEY` is missing —
even though the key is optional in `src/lib/env.ts` and is only documented as
required for USSD, WhatsApp and cron.

Onboarding could therefore succeed, then the redirect to the dashboard returned
a 500. The same thing happened if the configured key was rejected by Supabase.
This is the most likely production trigger because the failure appears exactly
when the user tries to enter the app for the first time.

### 2. A post-RPC failure in the onboarding action had no recovery path

`createWorkspaceAction` called `complete_onboarding`, then uploaded the optional
logo, wrote cookies, revalidated and redirected. Any unexpected exception after
the RPC committed (for example a storage/network failure, cookie write, or
revalidation failure) escaped the action. Because the workspace already existed,
a retry showed "too many attempts" or a duplicate workspace instead of opening
the books.

## Changes

- `src/lib/entitlements/service.ts`
  - Member-facing entitlement reads now use the caller's Supabase session, so
    RLS applies and the service-role key is not needed to open a workspace.
  - Service-role access remains for webhooks and other contexts with no signed-in
    user (`getWorkspaceEntitlementsAsService`).
- `src/app/[locale]/onboarding/actions.ts`
  - Wraps the action in a recovery boundary. Next redirects and not-found
    control flow are re-thrown with `unstable_rethrow`.
  - Unexpected failures are logged as `workspace.onboarding_unhandled` with the
    redacted error.
  - If the workspace was committed before the failure, the owner is sent to the
    dashboard instead of being stranded on the error page.
  - Otherwise the form shows the normal translated error and remains usable.
- `src/app/[locale]/onboarding/error.tsx`
  - Adds a localized route error boundary with a reference digest and retry
    button, so a future render failure is readable rather than a bare 500.
- `src/components/forms/onboarding-form.tsx`
  - Removed the unnecessary `encType` attribute; React sets multipart encoding
    automatically for function actions and was warning about the override.
- `src/lib/security/headers.ts`
  - `img-src` now includes the configured Supabase origin. This keeps a
    self-hosted/local Supabase logo working over `http://` without loosening the
    production policy (`https:` remains allowed as before).
- `tests/security.test.ts`
  - Regression test for a self-hosted Supabase image origin in the CSP.

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test` | Pass — 239 tests / 32 files |
| `npm run build` | Pass |
| `npm run test:db` | Pass — 376 assertions |
| `npm run test:e2e` | Pass — 25 desktop/mobile journeys |
| `npm run verify:production -- --local` | Pass — 15 checks |
| Onboarding, production build, service key present | Pass — dashboard loaded |
| Onboarding, production build, logo upload, service key present | Pass — dashboard loaded, logo image allowed by CSP |
| Onboarding, production build, `SUPABASE_SERVICE_ROLE_KEY=` | Pass — workspace created, dashboard loaded |
| Onboarding DB flow (`complete_onboarding`) | Covered by existing Phase 4 DB assertions |

The browser checks were run with Playwright against the production server and a
real Supabase session, not a mocked client.

## Deployment note

The service-role key is still required for trusted background work (USSD,
WhatsApp, payment webhooks and cron). It is no longer required for a signed-in
member to load their own dashboard or entitlements.

If the same page still appears after this release, the new error reference and
the server log entry `workspace.onboarding_unhandled` will identify the failing
step. Collect the `ERROR <digest>` value from the page and the matching log line
before retrying.
