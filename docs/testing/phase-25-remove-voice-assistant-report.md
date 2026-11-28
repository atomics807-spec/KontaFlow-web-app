# Phase 25 — Remove the voice assistant report

## Goal

Remove every voice and speech feature from KontaFlow. Easy Mode stays
picture-first and number-pad-first, but it no longer reads text aloud, listens
for spoken amounts or exposes a voice preference.

## What changed

### Removed from Easy Mode

- The **Listen** buttons on the Easy dashboard, recording screen, guide, login,
  signup and onboarding.
- The **Hear my money** summary button.
- The **Speak the amount** microphone control and spoken-amount parser.
- The **Voice on/off** switch in the Easy header.
- Automatic speech for step prompts, errors and saved confirmations.
- Browser `speechSynthesis` and `SpeechRecognition`/`webkitSpeechRecognition`
  usage.

### Removed code

- `src/components/easy/speak-button.tsx`
- `src/components/easy/voice-amount-button.tsx`
- `src/components/easy/easy-sound-toggle.tsx`
- `src/components/easy/use-easy-audio.ts`
- `src/lib/easy/audio.ts`
- `src/lib/easy/speech.ts`
- `tests/easy-speech.test.ts`

### Kept

- The three-step number pad, quick amounts, picture categories and review.
- The picture-first guide, help links and Call/WhatsApp support.
- Haptics, large tap targets and all visual accessibility cues.
- The AI assistant, which remains a text-based bookkeeping assistant.
- `microphone=()` in the Permissions-Policy. No page now requests microphone
  access.

No database migration is required. Existing local-storage values for the old
voice preference are ignored and harmless.

## Copy changes

- The onboarding Easy Mode hint no longer promises spoken amounts.
- The recording hint now says: **Tap the numbers.**
- The help panel points to Call/WhatsApp instead of Listen.
- The guide's help panel points to Call/WhatsApp instead of Listen.
- All EN/FR/PCM dictionaries were updated together; unused voice keys were
  deleted.

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test` | Pass — 233 tests / 31 files |
| `npm run build` | Pass |
| `npm run test:db` | Pass — 379 assertions |
| `npm run test:e2e` | Pass — 26 journeys |
| `npm run verify:production -- --local` | Pass — 15 checks |

The existing Easy Mode E2E journey still covers the picture-first guide, a
number-pad sale, the saved state and the switch back to the full dashboard. It no
longer relies on any speech control.

## Product note

The AI assistant is unchanged and still accepts typed natural-language
commands. Only the voice interface was removed.
