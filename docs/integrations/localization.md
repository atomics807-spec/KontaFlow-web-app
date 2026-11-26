# Localisation and Tolgee

KontaFlow ships in three locales. The bundled dictionaries are the source of
truth at runtime; Tolgee is an optional review and override layer.

| Code | Language | URL prefix | `Intl` locale |
| --- | --- | --- | --- |
| `en` | English | `/en` | `en-CM` |
| `fr` | French | `/fr` | `fr-CM` |
| `pcm` | Cameroon Pidgin English (ISO 639-3) | `/pcm` | `en-CM` |

Pidgin uses `pcm`, not `wes`. West African Pidgin English (`wes`) remains a
compatibility alias: `/wes/*` responds with a 308 redirect to `/pcm/*`,
`resolveLocale("wes-CM")` returns `pcm`, and old database translation rows with
a `wes` key are read as a fallback for `pcm`.

## Request flow

1. `src/proxy.ts` detects the locale prefix or the `Accept-Language` header and
   rewrites unknown public paths to the resolved locale.
2. The locale layout validates the segment with `isLocale()` and loads the
   dictionary through `getDictionary(locale)`.
3. `getDictionary` starts from the bundled dictionary, then applies Tolgee
   overrides server-side when the project is configured.
4. `I18nProvider` hydrates `@tolgee/react` with the same static data, so client
   components can call `t()` without a second network request.
5. The language switcher saves the choice in the `kontaflow_locale` cookie and,
   for signed-in users, in `profiles.locale`. Workspace settings also store the
   workspace default.

Never trust the URL segment alone for private data. Services still resolve the
workspace from the authenticated membership; the locale only changes copy and
formatting.

## Files

| Path | Purpose |
| --- | --- |
| `src/lib/i18n/config.ts` | Locale constants, negotiation, legacy aliases, path helpers, `intlLocale`, `pickTranslation` |
| `src/lib/i18n/dictionaries/en.ts` | Typed English dictionary and `Dictionary` shape |
| `src/lib/i18n/dictionaries/fr.ts` | French dictionary, typed against English |
| `src/lib/i18n/dictionaries/pcm.ts` | Cameroon Pidgin dictionary, typed against English |
| `src/lib/i18n/interpolate.ts` | Placeholder and ICU plural interpolation |
| `src/lib/i18n/server.ts` | Server dictionary loader with Tolgee overrides |
| `src/lib/i18n/tolgee.ts` | Tolgee REST adapter and safe override merge |
| `src/lib/i18n/tolgee-client.ts` | Browser Tolgee instance |
| `src/components/layout/i18n-provider.tsx` | Provider and `useI18n()` hook |
| `src/lib/content/*` | Long-form marketing and legal content per locale |

## Adding a string

1. Add the key to `en.ts`.
2. Add the same key to `fr.ts` and `pcm.ts`. TypeScript fails until the shapes
   match.
3. Use `dict.section.key` in server components, or `t("section.key")` in client
   components.
4. Run `npm test`. Parity, empty-string and interpolation tests must pass.

Do not add English fallbacks in JSX. If a value needs a runtime number, pass a
placeholder through `interpolate`:

```ts
interpolate(dict.reports.summary, { count, amount }, { locale: intlLocale(locale) })
```

Plural blocks use the ICU subset supported by the project:

```text
{count, plural, one {# entry} other {# entries}}
```

## Formatting rules

* Dates: `formatDate(value, intlLocale(locale), timezone)`.
* Money: `formatMoney(minor, currency, moneyLocale(locale, currency))`.
* Charts: pass `locale` into the chart component and use `moneyLocale`.
* CSV: headers come from `dict.reports.csv`; the export route accepts the
  selected `locale` query parameter and falls back to the workspace locale.
* PDF: `/api/reports/export/pdf` renders the report with `pdf-lib`, the same
  locale-aware money/date formatters, and localized headings, so French accents
  and Pidgin labels appear in the downloaded document.
* Emails: load the dictionary from the recipient profile or workspace before
  rendering the subject, HTML and text.
* AI: the system prompt tells the model which language to answer in, and the
  assistant errors come from the dictionary.

## Tolgee configuration

Set these server variables in `.env.local` and in the deployment platform:

```bash
NEXT_PUBLIC_TOLGEE_PROJECT_ID="your-project-id"
TOLGEE_API_URL="https://app.tolgee.io"
TOLGEE_API_KEY="server-side-personal-or-project-api-key"
```

`TOLGEE_API_KEY` must never be exposed to the browser. The browser receives
only the translated strings that the server already loaded. If the API is
unreachable or misconfigured, `getTolgeeOverrides` logs a warning and returns
`null`; the bundled dictionary is then used unchanged, so an outage cannot
blank the interface.

Run the coverage check before publishing translation changes:

```bash
npm run i18n:pull
```

The command compares each Tolgee locale with the English key set and exits
non-zero when a remote locale is missing keys. It does not write to the source
tree.

## Testing

`tests/i18n.test.ts` covers locale negotiation, legacy aliases, path rewriting,
money/date locale mapping, plural selection, dictionary parity, empty strings
and channel/email/CSV keys. Run the full gate with:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
