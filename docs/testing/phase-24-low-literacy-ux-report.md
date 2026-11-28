# Phase 24 — Accessible, picture-first onboarding and Easy Mode report

## Goal

Make KontaFlow usable with as little reading and typing as possible for small
business owners, market traders and other low-literacy users, while keeping the
full bookkeeping application available to owners and accountants.

Phase 23 introduced a separate Easy Mode. Phase 24 makes that mode the default
starting point for new businesses, explains it with pictures and speech, keeps
the most important actions reachable with a thumb, and gives every user a human
support route.

## What shipped

### 1. Reading-comfort choice at sign-up and onboarding

- Onboarding now asks **How should KontaFlow look for you?** with two large
  cards:
  - **Simple screen** — pictures, large amounts and three-step recording.
  - **Full screen** — the complete dashboard, reports and tables.
- New workspaces default to the **Simple screen**; choosing the full screen is
  explicit.
- The choice is stored on `profiles.easy_mode` by migration
  `20260101000048_phase24_reading_comfort.sql`.
- Existing accounts are preserved on the full dashboard until they choose
  otherwise.
- If the mode write fails after the workspace is created, the recovery path
  defaults to the simple screen rather than stranding the owner.

### 2. Persistent routing

- `/[locale]/dashboard` redirects an Easy Mode owner to `/[locale]/easy`.
- The Simple screen has an explicit **Open the full screen** action in the slim
  header and in the help area. It persists the choice and opens the dashboard.
- The full dashboard keeps a prominent **Easy mode** card, so the choice works
  in both directions.
- E2E coverage proves the switch persists to the profile.

### 3. Picture-first guided tour

`src/components/easy/easy-guide.tsx` adds a three-panel modal on the first visit:

1. **This is your money** — money in, money out and cash.
2. **Three taps to record** — amount, picture, save.
3. **Help is always here** — call or WhatsApp a person.

- Each panel has a large illustration, a Listen button and one primary action.
- Progress dots and a Skip action are available.
- Completion is stored in local storage, so the tour does not return on every
  visit.
- The **How to use this screen** button reopens it at `?guide=1#help`.
- Focus moves to the primary button, Escape/X/Skip close the tour, and page
  scrolling is locked while it is open.

### 4. Voice preference and spoken feedback

- `src/lib/easy/audio.ts` stores the voice preference and broadcasts changes to
  every open component.
- The slim header has a labelled **Voice on/off** switch.
- With voice enabled, Easy Mode speaks:
  - the amount step prompt,
  - the category step prompt when the user reaches it,
  - the final amount/category review,
  - validation errors, once per message,
  - the success message, including the distinct offline-saved message.
- Toggling voice on confirms audibly; the existing Listen buttons still work
  when voice is off.
- All prompts are translated into English, French and Cameroonian Pidgin.

### 5. Thumb navigation and larger money display

- A fixed bottom navigation on Easy Mode provides **My money**, **I sold** and
  **I spent**, each with an icon and a minimum 64 px touch height.
- The navigation respects the device safe area and the main content reserves
  bottom space, so it never covers the last entry.
- Number pad, quick amounts, category cards, account cards and kind cards give
  short haptic feedback where the browser supports `navigator.vibrate`.
- The three month totals are larger on mobile (24–30 px) for quick reading.

### 6. Human help everywhere

- `SupportLinks` adds a **Need help? Call / WhatsApp** block with large labelled
  actions.
- It appears on login, sign-up and the rest of the auth card, at the bottom of
  Easy Mode, and in the full dashboard sidebar/mobile drawer.
- The contact details come from the central `src/lib/contact-details.ts`
  module; no numbers are hard-coded into customer data.
- Easy Mode also has a **How to use this screen** button that points to the
  guided tour.

## Security and data-model notes

- `profiles.easy_mode` is a presentation preference only; it grants no data
  access and is not used in any RLS policy.
- The migration grants `update (easy_mode)` to `authenticated`. Existing
  profile update grants and RLS still restrict the row to `auth.uid()`.
- The preference is read through the normal authenticated session. No
  service-role key is needed to render the simple screen.
- Support links are static `tel:` and `wa.me` links; no user or financial data is
  placed in the URL.
- The guided tour stores only a completion flag in local storage. It stores no
  amounts, names or workspace identifiers.

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test` | Pass — 240 tests / 32 files |
| `npm run build` | Pass — `/[locale]/easy` and `/[locale]/easy/record` generated |
| `npm run test:db` | Pass — 379 assertions, including new `easy_mode` defaults and persistence |
| `npm run test:e2e` | Pass — 26 journeys |
| `npm run verify:production -- --local` | Pass — 15 checks, all 48 migrations applied |

### New end-to-end journey

`e2e/easy-mode.spec.ts` seeds an Easy Mode owner and proves:

1. Login lands on `/en/easy`, not the full dashboard.
2. The three tour panels appear and the tour can be completed.
3. Bottom navigation and the **My money** destination render.
4. **I sold** opens the three-step recorder with no description or date field.
5. The amount and Sales picture are chosen and the record is saved.
6. The ledger contains an income transaction of XAF 5,000 for that workspace.
7. **Open the full screen** switches the profile and opens `/en/dashboard`.

The existing onboarding E2E still selects the full screen, so both branches of
the reading-comfort choice remain covered.

## Residual barriers and recommended next steps

This phase removes the main navigation and recording barriers. It does not yet
make every part of the product fully independent of reading:

- **Account creation still needs typed details** (name, business name, email,
  phone and OTP). A helper, agent or support person may need to complete it once.
  A future phase can add voice-assisted field entry and a phone + PIN sign-in
  path.
- **People and debts still use the full debts pages.** The next high-value step
  is a picture-first debt screen that shows a photo/avatar, the person's name and
  an amount, with **Received** and **Paid** buttons. Names still require typing
  or selecting an existing contact.
- **Advanced features remain in the full app** — invoices, transfers, imports,
  receipt OCR, team roles and reports. Easy Mode intentionally records income
  and expenses only.
- **Speech depends on the device.** Some browsers have no `en-CM` or `fr-CM`
  voice and some do not support speech recognition. The number pad, pictures and
  labels and the number pad remain the guaranteed path.
- **The tour is a first-run aid, not training.** A short assisted setup with a
  local agent or accountant is still the most reliable onboarding for a user who
  cannot read at all.

Recommended Phase 25 candidates, in order:

1. Phone + PIN or one-tap trusted-device sign-in.
2. Picture-first people/debts screen with receive/pay actions.
3. Voice prompts on onboarding fields and a spoken **Add my business** helper.
4. Receipt photo capture with AI extraction and a picture review.
5. A printable one-page picture guide for market traders and agents.
