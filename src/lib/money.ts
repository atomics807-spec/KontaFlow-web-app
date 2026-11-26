import { getCurrency, type CurrencyCode } from "./currency";
import { AppError } from "./errors";

/**
 * Monetary amounts are integers in the currency's minor unit
 * (XAF/XOF: 1 unit == 1 franc; USD/EUR: 1 unit == 1 cent).
 * Floating point is never used for storage, transport or aggregation.
 */
export type MinorUnits = bigint;

const DIGIT_GROUPS = /[\s\u00a0\u202f'’]/g;

export function isValidMinor(value: unknown): value is MinorUnits {
  return typeof value === "bigint";
}

/** Converts a PostgREST `int8` payload (number or numeric string) to MinorUnits. */
export function toMinorUnits(value: number | string | bigint | null | undefined): MinorUnits {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new AppError("validation_failed", "Invalid monetary amount.");
    if (!Number.isSafeInteger(value)) {
      throw new AppError(
        "validation_failed",
        "Amount is outside the supported range. Enter a smaller value.",
      );
    }
    return BigInt(value);
  }
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new AppError("validation_failed", "Invalid monetary amount.");
  }
  return BigInt(trimmed);
}

/** Safe conversion for rendering/browser transport; throws beyond 2^53-1. */
export function toSafeNumber(value: MinorUnits): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new AppError("validation_failed", "Amount is too large to display safely.");
  }
  return Number(value);
}

export function toSafeNumberOrNull(value: MinorUnits): number | null {
  try {
    return toSafeNumber(value);
  } catch {
    return null;
  }
}

export function sumMinor(values: Iterable<MinorUnits>): MinorUnits {
  let total = 0n;
  for (const value of values) total += value;
  return total;
}

export function absMinor(value: MinorUnits): MinorUnits {
  return value < 0n ? -value : value;
}

/**
 * Parses user input such as "12 500", "12,500", "1 234,50" or "12500.75"
 * into minor units. Rejects fractional input for zero-decimal currencies
 * instead of silently rounding money.
 */
export function parseMoneyToMinor(input: string, currency: string | CurrencyCode): MinorUnits {
  const { decimals, code } = getCurrency(currency);
  const ungrouped = input.replace(DIGIT_GROUPS, "").trim();
  // "1,254,500" and "1,254,500.50" use commas purely as thousand separators.
  const cleaned = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(ungrouped)
    ? ungrouped.replace(/,/g, "")
    : ungrouped;
  if (!cleaned) throw new AppError("validation_failed", "Enter an amount.");

  const negative = cleaned.startsWith("-");
  const unsigned = negative ? cleaned.slice(1) : cleaned;
  if (!/^\d+(?:[.,]\d+)?$/.test(unsigned)) {
    throw new AppError("validation_failed", "Use digits only, for example 12500 or 12 500.");
  }

  const normalised = unsigned.replace(",", ".");
  const [wholePart = "0", fractionPart = ""] = normalised.split(".");

  if (fractionPart.length > decimals) {
    if (Number(fractionPart.slice(decimals)) !== 0) {
      throw new AppError(
        "validation_failed",
        `${code} does not use fractions smaller than ${decimals} decimal place${decimals === 1 ? "" : "s"}.`,
      );
    }
  }

  const paddedFraction = fractionPart.slice(0, decimals).padEnd(decimals, "0");
  const minor = BigInt(wholePart) * 10n ** BigInt(decimals) + BigInt(paddedFraction || "0");
  return negative ? -minor : minor;
}

/** Formats minor units for display, honouring locale grouping. */
export function formatMoney(
  amount: MinorUnits,
  currency: string,
  locale = "en",
  options?: { withSymbol?: boolean; signed?: boolean },
): string {
  const { decimals } = getCurrency(currency);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const divisor = 10n ** BigInt(decimals);
  const whole = absolute / divisor;
  const fraction = absolute % divisor;
  const numeric = Number(whole) + Number(fraction) / Number(divisor);

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    style: options?.withSymbol === false ? "decimal" : "currency",
    currency: getCurrency(currency).code,
    currencyDisplay: "narrowSymbol",
  });

  const formatted = formatter.format(numeric);
  if (negative) return `-${formatted}`;
  if (options?.signed && amount > 0n) return `+${formatted}`;
  return formatted;
}

/** Compact display for KPI cards: 1.2M, 45k, etc. */
export function formatMoneyCompact(amount: MinorUnits, currency: string, locale = "en"): string {
  const { decimals } = getCurrency(currency);
  const divisor = 10n ** BigInt(decimals);
  const numeric = Number(amount) / Number(divisor);
  const formatted = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numeric);
  return `${formatted} ${getCurrency(currency).symbol}`;
}

/** Converts a major-unit amount (e.g. from an API payload) into minor units. */
export function majorToMinor(amount: number | string, currency: string): MinorUnits {
  const { decimals } = getCurrency(currency);
  if (typeof amount === "number") {
    if (!Number.isFinite(amount)) throw new AppError("validation_failed", "Invalid amount.");
    // Avoid binary floating point drift: work on the decimal string form.
    return parseMoneyToMinor(amount.toFixed(decimals), currency);
  }
  return parseMoneyToMinor(amount, currency);
}

/** Locale used for money formatting: XAF/XOF read naturally with French grouping. */
export function moneyLocale(locale: string, currency: string): string {
  if (currency === "XAF" || currency === "XOF") return locale === "fr" ? "fr-FR" : "fr-CM";
  return locale === "fr" ? "fr-FR" : "en-GB";
}
