# Phase 22 — Workspace branding and dashboard subscriptions report

Date: 2026-11-27
Environment: local Supabase (Postgres, Auth, private Storage), production Next.js
build on Node 24, Playwright Chromium desktop and mobile viewports, preview
served through the public work host.

## Scope

Phase 22 closes two product gaps reported after Phase 21:

* the workspace photo uploaded during onboarding is now visible in the
  dashboard instead of being ignored by the initials-only avatar;
* owners and admins can complete a plan purchase from `/{locale}/billing`
  without leaving the dashboard.

The preview deployment uses the explicit sandbox demo provider so reviewers can
exercise the real checkout, payment ledger, subscription activation and
entitlements without merchant credentials. Real MTN, Orange and aggregator
adapters are unchanged.

## Changes

### Workspace logo

* `src/lib/workspaces/logo.ts` resolves each workspace logo once per dashboard
  layout. Private Storage objects become one-hour signed URLs; external
  `logo_url` values are accepted only with `http` or `https`.
* Storage paths must start with the workspace id, so a malformed row cannot
  request another tenant's object.
* `Avatar` now renders a supplied image and falls back to initials when the
  image is missing or the workspace has no logo.
* The dashboard shell shows the logo in the desktop sidebar, desktop header and
  mobile header. The sidebar switcher keeps the workspace name, plan and
  currency next to the image.

### Dashboard subscription purchase

* `PAYMENT_PROVIDER=demo` plus `PAYMENT_MODE=sandbox` enables an explicit
  sandbox adapter. It returns an immediate approval, and the existing service
  confirms the payment through `confirm_payment`, so the plan, payment history
  and entitlement updates follow the normal path.
* `demoPaymentEnabled()` is a pure gate on mode and provider. Production and
  disabled deployments never select the sandbox adapter.
* The billing page shows a sandbox notice when demo checkout is active, and the
  provider appears as “Demo mobile money (sandbox)”.
* `PaymentCheckout` refreshes the server page after an immediate success, so the
  current-plan badge updates without a manual reload.
* `.env.example` and `docs/integrations/payments.md` document the demo gate and
  its production restriction.

## Gates

| Gate | Command | Result |
| --- | --- | --- |
| TypeScript strict | `npm run typecheck` | Pass |
| Unit tests | `npm test` | 30 files, 228 tests passed |
| Lint | `npm run lint` | Pass |
| Production build | `npm run build` | Pass |
| Desktop logo | Playwright against preview | Pass |
| Mobile logo | Playwright 390 × 844 | Pass |
| Sandbox notice and provider | Playwright against `/en/billing` | Pass |
| Trial to Growth purchase | Playwright against `/en/billing` | Pass |

The browser checks asserted:

1. the desktop dashboard header renders an `<img>` whose source is a signed
   `kontaflow-workspace-logos` URL;
2. the mobile dashboard header renders the same workspace logo;
3. `/en/billing` shows the sandbox notice and the demo provider;
4. the trial demo account clicked “Pay Growth”, received
   “Payment confirmed. Your plan is active.” and saw the Growth plan after the
   server refresh;
5. the database reported `workspaces.plan=growth`, `subscriptions.plan=growth`,
   `subscriptions.status=active` and one succeeded payment transaction.

The trial demo account was restored to Starter/trialing and the sandbox payment
row was removed after verification. The owner workspace keeps the uploaded demo
logo.

## Security review

* The logo bucket remains private. URLs are signed for one hour and are issued
  by the user-scoped Supabase client, so Storage RLS still authorizes the
  member.
* Logo paths are validated against the workspace id and external URLs are
  limited to `http`/`https`; the component renders them as images, never as
  HTML.
* Demo checkout requires both `PAYMENT_MODE=sandbox` and
  `PAYMENT_PROVIDER=demo`. It cannot be reached with production or disabled
  mode, and it has no webhook surface.
* The demo adapter uses the existing payment intent, ledger and
  `confirm_payment` RPC. Amount, currency and plan price checks are not
  bypassed.
* No secret, service-role key or provider credential is exposed to the browser.

## Defects found and fixed

* The dashboard only rendered initials, so the uploaded logo was invisible.
  The layout now resolves signed URLs and the shell renders the image.
* The first mobile check targeted a hidden sidebar image. The shell also needed
  a mobile header image; adding it gives the workspace branding on phones and
  removes the hidden-only state.
* A Playwright assertion read the billing page at `domcontentloaded`, before the
  page had settled. The verification now waits for `networkidle`; this was a
  harness timing issue, not an application defect.

## Residual risks

* Real MTN, Orange and aggregator checkout still needs merchant credentials and
  provider sandbox certification; only the explicit demo provider was exercised
  here.
* Signed logo URLs expire after one hour. The dashboard re-signs them on the
  next server render; a tab left open longer than that will show a broken image
  until it is refreshed.
* Logo replacement and removal are not exposed in settings yet; onboarding is
  the current upload entry point.
* Demo checkout moves no money and must never be enabled in production. The
  environment gate enforces that, but deployment configuration should still be
  reviewed before launch.
