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
  pcm: async () => (await import("./dictionaries/pcm")).pcm,
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
export { interpolate } from "./interpolate";
