import { getCurrency } from "@/lib/currency";
import { parseMoneyToMinor } from "@/lib/money";

/** Converts integer minor units to the decimal string expected by providers. */
export function providerAmountString(amountMinor: bigint, currency: string): string {
  if (amountMinor < 0n) throw new Error("Payment amounts cannot be negative.");
  const { decimals } = getCurrency(currency);
  const divisor = 10n ** BigInt(decimals);
  const whole = amountMinor / divisor;
  if (decimals === 0) return whole.toString();
  const fraction = (amountMinor % divisor).toString().padStart(decimals, "0");
  return `${whole}.${fraction}`;
}

/** Parses a provider amount without binary floating point. */
export function parseProviderAmount(value: unknown, currency: string): bigint | null {
  if (value === null || value === undefined) return null;
  try {
    if (typeof value === "number") {
      if (!Number.isFinite(value) || value < 0) return null;
      return parseMoneyToMinor(value.toFixed(getCurrency(currency).decimals), currency);
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed || !/^\d+(?:[.,]\d+)?$/.test(trimmed)) return null;
      return parseMoneyToMinor(trimmed, currency);
    }
  } catch {
    return null;
  }
  return null;
}
