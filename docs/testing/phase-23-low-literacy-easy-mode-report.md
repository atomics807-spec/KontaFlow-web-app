> **Update (Phase 25):** Every voice, read-aloud and speech-recognition
> control described below has been removed. The current Easy Mode is silent
> and uses the number pad, pictures and text only. See
> `docs/testing/phase-25-remove-voice-assistant-report.md`.

# Phase 23 — Low-literacy Easy Mode report

## Goal

Make KontaFlow usable by business owners and market traders who cannot read or
write comfortably. The existing bookkeeping screens remain available for owners,
accountants and managers. Easy Mode is a second, deliberately smaller surface
for recording money and hearing the month's totals.

## What shipped

### Easy Mode dashboard — `/[locale]/easy`

- Three very large money cards: money in, money out and cash left.
- Two full-width picture actions: **I sold something** and **I spent money**.
- A read-aloud button, using the browser's `speechSynthesis` API, that speaks the
  month's income, expenses and cash position.
- Large "who owes me" and "who I owe" cards that link to the existing debt pages.
- The four most recent entries with large amounts and in/out arrows.
- Text-free navigation cues: icons, color, short labels and large tap targets.
- When opened from `/[locale]/easy/record`, a successful save redirects back with
  a spoken-friendly "saved" confirmation.

### No-typing recording — `/[locale]/easy/record?kind=income|expense`

Three steps, each with a large heading, picture and audio help:

1. **Amount** — an oversized amount display, a 12-key number pad, quick-amount
   chips and optional speech recognition ("five thousand", "deux mille cinq
   cents"). The parser handles English, French and Cameroon Pidgin number words.
2. **Category** — a two-column picture grid. Default categories are mapped to
   recognizable emoji glyphs; custom categories fall back to a money/receipt
   glyph.
3. **Review** — a single large summary, an account picker (cash, mobile money or
   bank) and a large **Yes, save** button.

The user never has to type a description, date, reference or contact. The
description is generated from the chosen kind and category, the date defaults to
today in the workspace timezone, and the payment method follows the selected
account. The flow uses the existing `TransactionForm` submission path, including
money parsing, audit logging, server-action validation and the offline outbox.

### Speech and language support

- Read-aloud buttons are on login, signup, onboarding, the Easy dashboard and
  every Easy recording step.
- Speech synthesis uses `fr-CM` for French and `en-CM` for English and Pidgin.
- Speech recognition is offered only where the browser exposes
  `SpeechRecognition` or `webkitSpeechRecognition`; otherwise the number pad is
  still fully usable.
- Pidgin (`pcm`) is presented as a first-class UI locale in all new copy.

### Minimal shell

When the path is `/[locale]/easy` or `/[locale]/easy/record`, the normal sidebar
and advanced navigation are replaced with a slim header containing the
KontaFlow mark, language switcher, sign-out and a full-application link. This
prevents the advanced menu from overwhelming a first-time user.

### Discoverability

- The primary sidebar now has an **Easy mode** entry.
- The full dashboard has a high-contrast card at the top linking to Easy Mode.
- Onboarding has a Listen button before the form.

## Accessibility decisions

- Minimum 64 px tap targets for the number pad; primary actions are 56–64 px.
- Large type (24–60 px), strong color contrast, and color + icon pairings so the
  meaning does not depend on color alone.
- The amount input remains a real `<input>` with `inputMode="decimal"`, so people
  who can type, screen readers and password managers are not blocked.
- Every icon-only control has an accessible label.
- Completion messages distinguish "saved" from "saved on this phone" (offline
  outbox) instead of silently accepting the entry.

## Tests and verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm test` | Pass — 238 tests / 32 files |
| `npm run lint` | Pass |
| `npm run build` | Pass — `/[locale]/easy` and `/[locale]/easy/record` generated |
| Spoken amount parser | 7 new tests covering digits, grouping, English, French, Pidgin and failure cases |
| Category picture mapping | 3 new tests |
| Dictionary parity | Existing `tests/i18n.test.ts` passes with the new keys in EN/FR/PCM |

`npm run test:db` and `npm run test:e2e` were not run in this environment because
the local Supabase/Docker stack was not running. `npm run verify:production --
--local` passed all five environment checks and then failed only when connecting
to `127.0.0.1:54322`; that is the same missing local database, not an application
failure. Run these three checks in the normal phase gate before release.

## Known limitations and next steps

- Voice recognition support varies by browser and requires microphone
  permission; the number pad is the guaranteed path.
- Speech synthesis voices for `en-CM` and `fr-CM` depend on the device. The
  browser falls back to another voice for the language when necessary.
- Easy Mode currently records income and expenses only. Transfers, invoices and
  receipt uploads remain in the full application.
- A future step can add a "take a photo of the receipt" action and spoken
  confirmation of the last three entries, but those are not required for the
  core no-typing flow.
