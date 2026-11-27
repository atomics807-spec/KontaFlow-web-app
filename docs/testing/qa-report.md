# Phase 19 — Quality assurance report

Date: 2026-11-27
Environment: local Supabase (Postgres, Auth, Mailpit), production Next.js build,
fake OpenAI server, Playwright Chromium desktop and Pixel 7 emulation.

## Results

| Gate | Command | Result |
| --- | --- | --- |
| TypeScript strict | `npm run typecheck` | Pass |
| Unit tests | `npm test` | 25 files, 214 tests passed |
| Database and RLS integration | `npm run test:db` | 362 assertions passed |
| End-to-end | `npm run test:e2e` | 17 tests passed (15 desktop, 2 mobile) |
| Lint | `npm run lint` | Pass |
| Production build | `npm run build` | Pass |

## Covered journeys

* Registration, email confirmation, phone OTP, onboarding, sign-in, password recovery.
* Income/expense entry, dashboard KPIs, reports and CSV/PDF exports.
* AI assistant draft, review, confirmation, posting and undo.
* Offline capture, local queue, reconnect sync and conflict handling.
* Tenant isolation for pages, REST reads, offline sync and AI commands.
* CSRF rejection on protected writes and forged USSD/WhatsApp callbacks.
* USSD and WhatsApp verification/token handling.
* Mobile navigation, manifest, service worker and offline capture.
* Dashboard and reports with 300 transactions under CPU throttling.

## Defects found and fixed during this phase

* AI proposal drafts were lost because the interactive tool context was copied
  before `setProposal` mutated it. The assistant now receives the original
  context, so drafts persist and the confirmation card appears.
* The offline capture form read cached accounts before the background bootstrap
  finished and never refreshed its state. It now rehydrates after bootstrap.
* The offline page had no identity when opened directly instead of through the
  dashboard, so it showed “Open KontaFlow while online once” even for a signed-in
  user. It now bootstraps the session and cached options itself while online,
  and retries automatically when the connection returns.
* The service worker was not exercised because E2E ran the development server;
  the suite now builds and tests the production server.
* React effect-driven cooldown state triggered a lint failure; the cooldown is
  now set in the send action.
* ESLint scanned Supabase's root-owned `.temp` directory; it is now ignored.

## Residual risks

* Browser coverage is Chromium only. Add WebKit and Firefox before claiming
  Safari or Firefox support.
* USSD, WhatsApp and payment providers are exercised through contract-level
  fakes; run provider sandbox certification before production onboarding.
* The performance test covers 300 transactions, not large multi-year ledgers.
* AI behaviour is tested with a deterministic fake model; prompt and model
  changes need a staging evaluation with the real provider.
