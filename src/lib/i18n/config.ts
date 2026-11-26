/**
 * Application locales.
 *
 * `wes` is the ISO 639-3 code for Cameroon Pidgin English (Kamtok / Wes Cos).
 * We use it instead of `pcm` (Nigerian Pidgin) so translation memory, analytics
 * and SEO signals refer to the correct language variety. `en-CM` / `fr-CM` are
 * used for Intl formatting because Intl does not ship a `wes` locale.
 */
export const LOCALES = ["en", "fr", "wes"] as const;

export type Locale = (typeof LOCALES)[number];

export type LocaleMeta = {
  code: Locale;
  label: string;
  englishLabel: string;
  htmlLang: string;
  intlLocale: string;
  dir: "ltr" | "rtl";
  ogLocale: string;
};

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: {
    code: "en",
    label: "English",
    englishLabel: "English",
    htmlLang: "en",
    intlLocale: "en-CM",
    dir: "ltr",
    ogLocale: "en_CM",
  },
  fr: {
    code: "fr",
    label: "Français",
    englishLabel: "French",
    htmlLang: "fr",
    intlLocale: "fr-CM",
    dir: "ltr",
    ogLocale: "fr_CM",
  },
  wes: {
    code: "wes",
    label: "Pidgin",
    englishLabel: "Cameroonian Pidgin",
    htmlLang: "wes",
    intlLocale: "en-CM",
    dir: "ltr",
    ogLocale: "en_CM",
  },
};

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "kontaflow_locale";

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: string | null | undefined): Locale {
  if (isLocale(value)) return value;
  const base = value?.trim().toLowerCase().split(/[-_]/)[0];
  if (isLocale(base)) return base;
  // `pcm` is the widely used tag for Pidgin; keep it working as an alias.
  if (base === "pcm") return "wes";
  return DEFAULT_LOCALE;
}

export function localizedPath(locale: Locale, path = "/"): string {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalised === "/" ? "" : normalised}`;
}

export function intlLocale(locale: Locale): string {
  return LOCALE_META[locale].intlLocale;
}

/** Picks the best supported locale from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const entries = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag?.toLowerCase() ?? "", quality: q ? Number.parseFloat(q) : 1 };
    })
    .filter((entry) => entry.tag)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of entries) {
    if (tag.startsWith("fr")) return "fr";
    if (tag === "wes" || tag.startsWith("wes-") || tag.includes("pidgin")) return "wes";
    if (tag.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}
