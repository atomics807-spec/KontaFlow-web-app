import { DEFAULT_LOCALE, type Locale } from "./config";
import { en, type Dictionary } from "./dictionaries/en";
import { getTolgeeOverrides, applyOverrides } from "./tolgee";

/**
 * Bundled dictionaries are the source of truth so the app never depends on a
 * third-party service being reachable. Tolgee can override them at runtime
 * when it is configured (see `tolgee.ts`).
 */
const loaders: Record<Locale, () => Promise<Dictionary>> = {
  en: async () => en,
  fr: async () => (await import("./dictionaries/fr")).fr,
  wes: async () => (await import("./dictionaries/wes")).wes,
};

const cache = new Map<Locale, Dictionary>();

export async function getDictionary(locale: Locale = DEFAULT_LOCALE): Promise<Dictionary> {
  const cached = cache.get(locale);
  if (cached) return cached;

  const loader = loaders[locale] ?? loaders[DEFAULT_LOCALE];
  const base = await loader();
  const overrides = await getTolgeeOverrides(locale);
  const dictionary = overrides ? applyOverrides(base, overrides) : base;

  cache.set(locale, dictionary);
  return dictionary;
}

/** Replaces `{name}` placeholders in a translated string. */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
