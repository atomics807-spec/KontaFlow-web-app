export type InterpolateOptions = { locale?: string };

type PluralBody = { category: string; text: string };

const PLURAL = /\{(\w+),\s*plural,\s*((?:(?:zero|one|two|few|many|other)\s*\{[^{}]*\}\s*)+)\}/g;

/**
 * Fills `{name}` placeholders and simple ICU plural blocks, e.g.
 * `{count, plural, one {# transaction} other {# transactions}}`.
 */
export function interpolate(
  template: string,
  values: Record<string, string | number>,
  options: InterpolateOptions = {},
): string {
  const withPlurals = template.replace(PLURAL, (match, key: string, body: string) => {
    const value = values[key];
    if (value === undefined) return match;

    const count = Number(value);
    const entries: PluralBody[] = [];
    for (const entry of body.matchAll(/(zero|one|two|few|many|other)\s*\{([^{}]*)\}/g)) {
      entries.push({ category: entry[1], text: entry[2] });
    }
    const category = pluralCategory(count, options.locale);
    const selected =
      entries.find((entry) => entry.category === category) ??
      entries.find((entry) => entry.category === "other") ??
      entries[0];
    return (selected?.text ?? String(value)).replace(/#/g, String(value));
  });

  return withPlurals.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

function pluralCategory(count: number, locale = "en"): string {
  try {
    return new Intl.PluralRules(locale).select(count);
  } catch {
    return new Intl.PluralRules("en").select(count);
  }
}
