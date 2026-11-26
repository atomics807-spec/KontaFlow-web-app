/**
 * Application locales.
 *
 * `pcm` is the product locale code for Cameroonian Pidgin English. The public
 * URL prefix is `/pcm/`. `wes` (West African Pidgin English, ISO 639-3) is
 * accepted as a legacy alias and redirected to `/pcm/`. `en-CM` / `fr-CM` are
 * used for Intl formatting because Intl does not ship a Cameroonian Pidgin
 * locale; Pidgin uses English (Cameroon) number and date conventions.
 */
export const LOCALES = ["en", "fr", "pcm"] as const;

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
  pcm: {
    code: "pcm",
    label: "Pidgin",
    englishLabel: "Cameroonian Pidgin",
    htmlLang: "pcm",
    intlLocale: "en-CM",
    dir: "ltr",
    ogLocale: "en_CM",
  },
};

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "kontaflow_locale";

/** Locale prefixes kept for existing bookmarks and already-sent emails. */
export const LEGACY_LOCALE_ALIASES: Readonly<Record<string, Locale>> = {
  wes: "pcm",
};

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: string | null | undefined): Locale {
  if (isLocale(value)) return value;
  const base = value?.trim().toLowerCase().split(/[-_]/)[0];
  if (isLocale(base)) return base;
  if (base && base in LEGACY_LOCALE_ALIASES) return LEGACY_LOCALE_ALIASES[base];
  if (base === "pidgin") return "pcm";
  return DEFAULT_LOCALE;
}

/** Resolves a first path segment, including legacy aliases. */
export function resolvePathLocale(segment: string | undefined): Locale | null {
  if (!segment) return null;
  if (isLocale(segment)) return segment;
  return LEGACY_LOCALE_ALIASES[segment] ?? null;
}

export function localizedPath(locale: Locale, path = "/"): string {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalised === "/" ? "" : normalised}`;
}

/** Replaces a leading locale segment while preserving the rest of a path. */
export function localizePath(path: string, locale: Locale): string {
  const segments = path.split("/");
  if (resolvePathLocale(segments[1])) {
    segments[1] = locale;
    return segments.join("/") || `/${locale}`;
  }
  return localizedPath(locale, path);
}

/** Reads a translation row, including the legacy `wes` key for `pcm`. */
export function pickTranslation(
  translations: Record<string, string> | null | undefined,
  locale: Locale,
): string | undefined {
  if (!translations) return undefined;
  if (translations[locale]) return translations[locale];
  if (locale === "pcm" && translations.wes) return translations.wes;
  return undefined;
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
    if (tag === "pcm" || tag.startsWith("pcm-") || tag === "wes" || tag.startsWith("wes-") || tag.includes("pidgin")) {
      return "pcm";
    }
    if (tag.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}
