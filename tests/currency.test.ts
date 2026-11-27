import { describe, expect, it } from "vitest";
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCIES,
  getCurrency,
  isSupportedCurrency,
} from "@/lib/currency";

describe("currency catalogue", () => {
  it("exposes every supported currency exactly once", () => {
    expect(new Set(SUPPORTED_CURRENCIES).size).toBe(SUPPORTED_CURRENCIES.length);
    expect(CURRENCY_OPTIONS).toHaveLength(SUPPORTED_CURRENCIES.length);
    expect(CURRENCY_OPTIONS.map((item) => item.code)).toEqual([...SUPPORTED_CURRENCIES]);
  });

  it("uses the ISO minor-unit exponent", () => {
    expect(getCurrency("XAF").decimals).toBe(0);
    expect(getCurrency("XOF").decimals).toBe(0);
    expect(getCurrency("USD").decimals).toBe(2);
    expect(getCurrency("EUR").decimals).toBe(2);
    expect(getCurrency("NGN").decimals).toBe(2);
  });

  it("falls back to XAF for missing or unknown codes", () => {
    expect(getCurrency(null).code).toBe(DEFAULT_CURRENCY);
    expect(getCurrency("").code).toBe(DEFAULT_CURRENCY);
    expect(getCurrency("BTC").code).toBe(DEFAULT_CURRENCY);
    expect(getCurrency("xaf").code).toBe(DEFAULT_CURRENCY);
  });

  it("accepts only exact supported codes", () => {
    expect(isSupportedCurrency("XAF")).toBe(true);
    expect(isSupportedCurrency("KES")).toBe(true);
    expect(isSupportedCurrency("xaf")).toBe(false);
    expect(isSupportedCurrency("BTC")).toBe(false);
  });
});
