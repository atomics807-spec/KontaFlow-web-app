import type { Locale } from "@/lib/i18n/config";

const SMALL_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  a: 1,
  an: 1,
  un: 1,
  une: 1,
  two: 2,
  deux: 2,
  three: 3,
  trois: 3,
  four: 4,
  quatre: 4,
  five: 5,
  cinq: 5,
  six: 6,
  seven: 7,
  sept: 7,
  eight: 8,
  huit: 8,
  nine: 9,
  neuf: 9,
  ten: 10,
  dix: 10,
  eleven: 11,
  onze: 11,
  twelve: 12,
  douze: 12,
  thirteen: 13,
  treize: 13,
  fourteen: 14,
  quatorze: 14,
  fifteen: 15,
  quinze: 15,
  sixteen: 16,
  seize: 16,
  seventeen: 17,
  dixsept: 17,
  eighteen: 18,
  dixhuit: 18,
  nineteen: 19,
  dixneuf: 19,
  twenty: 20,
  vingt: 20,
  thirty: 30,
  trente: 30,
  forty: 40,
  quarante: 40,
  fifty: 50,
  cinquante: 50,
  sixty: 60,
  soixante: 60,
  seventy: 70,
  soixantedix: 70,
  eighty: 80,
  quatrevingt: 80,
  ninety: 90,
  quatrevingtdix: 90,
};

const SCALE_NUMBERS: Record<string, number> = {
  hundred: 100,
  hundreds: 100,
  cent: 100,
  cents: 100,
  thousand: 1_000,
  thousands: 1_000,
  mille: 1_000,
  milles: 1_000,
  million: 1_000_000,
  millions: 1_000_000,
};

const IGNORED_WORDS = new Set([
  "and",
  "et",
  "de",
  "des",
  "du",
  "franc",
  "francs",
  "fcfa",
  "xaf",
  "cfa",
  "money",
  "moni",
  "naira",
  "dollar",
  "dollars",
]);

const FRENCH_COMPOUNDS: [RegExp, string][] = [
  [/\bquatre\s+vingt\s+dix\b/g, "quatrevingtdix"],
  [/\bquatre\s+vingt\b/g, "quatrevingt"],
  [/\bsoixante\s+dix\b/g, "soixantedix"],
  [/\bdix\s+sept\b/g, "dixsept"],
  [/\bdix\s+huit\b/g, "dixhuit"],
  [/\bdix\s+neuf\b/g, "dixneuf"],
];

export function speechLanguage(locale: Locale): string {
  if (locale === "fr") return "fr-CM";
  return "en-CM";
}

function normalizeSpokenText(value: string): string {
  let text = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9.,\s-]/g, " ")
    .replace(/-/g, " ");

  for (const [pattern, replacement] of FRENCH_COMPOUNDS) {
    text = text.replace(pattern, replacement);
  }

  return text;
}

function parseDigits(text: string): string | null {
  const matches = text.match(/\d+(?:[ \u00a0]\d{3})*(?:[.,]\d+)?/g);
  if (!matches) return null;

  const values = matches
    .map((match) => match.replace(/[ \u00a0]/g, "").replace(/(\d),(\d{3})(?!\d)/g, "$1$2").replace(",", "."))
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (values.length === 0) return null;
  return String(Math.max(...values));
}

function parseWords(text: string): number | null {
  const tokens = text
    .split(/\s+/)
    .map((token) => token.replace(/^[.,]+|[.,]+$/g, ""))
    .filter((token) => token && !IGNORED_WORDS.has(token));

  if (tokens.length === 0) return null;

  const allSingleDigits = tokens.every((token) => {
    const value = SMALL_NUMBERS[token];
    return value !== undefined && value >= 0 && value <= 9;
  });
  if (allSingleDigits && tokens.length > 1) {
    return Number(tokens.map((token) => String(SMALL_NUMBERS[token])).join(""));
  }

  let total = 0;
  let current = 0;
  let sawNumber = false;

  for (const token of tokens) {
    const small = SMALL_NUMBERS[token];
    if (small !== undefined) {
      current += small;
      sawNumber = true;
      continue;
    }

    const scale = SCALE_NUMBERS[token];
    if (scale !== undefined) {
      sawNumber = true;
      if (scale === 100) {
        current = (current || 1) * 100;
      } else {
        total += (current || 1) * scale;
        current = 0;
      }
      continue;
    }

    if (/^\d+$/.test(token)) {
      current += Number(token);
      sawNumber = true;
    }
  }

  return sawNumber ? total + current : null;
}

/**
 * Converts a spoken amount such as "two thousand five hundred" or
 * "deux mille cinq cents" into a plain amount string. Returns null when no
 * positive amount can be found.
 */
export function parseSpokenAmount(value: string): string | null {
  if (!value.trim()) return null;
  const normalized = normalizeSpokenText(value);
  const digits = parseDigits(normalized);
  if (digits) return digits;

  const parsed = parseWords(normalized);
  return parsed !== null && parsed > 0 ? String(parsed) : null;
}
