import { describe, expect, it } from "vitest";
import {
  absMinor,
  formatMoney,
  formatMoneyCompact,
  majorToMinor,
  parseMoneyToMinor,
  sumMinor,
  toMinorUnits,
  toSafeNumberOrNull,
} from "@/lib/money";

describe("parseMoneyToMinor", () => {
  it("parses grouped franc amounts without decimals", () => {
    expect(parseMoneyToMinor("12 500", "XAF")).toBe(12_500n);
    expect(parseMoneyToMinor("1 254 500", "XAF")).toBe(1_254_500n);
    expect(parseMoneyToMinor("1,254,500", "XAF")).toBe(1_254_500n);
  });

  it("parses decimal currencies with comma or dot", () => {
    expect(parseMoneyToMinor("1 234,50", "EUR")).toBe(123_450n);
    expect(parseMoneyToMinor("1234.50", "EUR")).toBe(123_450n);
    expect(parseMoneyToMinor("0,05", "USD")).toBe(5n);
  });

  it("rejects fractions a zero-decimal currency cannot represent", () => {
    expect(() => parseMoneyToMinor("12500.5", "XAF")).toThrow();
  });

  it("accepts zero fractions for zero-decimal currencies", () => {
    expect(parseMoneyToMinor("12500.00", "XAF")).toBe(12_500n);
  });

  it("rejects malformed input instead of rounding", () => {
    expect(() => parseMoneyToMinor("", "XAF")).toThrow();
    expect(() => parseMoneyToMinor("12 500 FCFA", "XAF")).toThrow();
    expect(() => parseMoneyToMinor("abc", "XAF")).toThrow();
  });

  it("preserves the sign for credit notes", () => {
    expect(parseMoneyToMinor("-2 000", "XAF")).toBe(-2_000n);
  });
});

describe("formatMoney", () => {
  it("groups francs and shows the currency", () => {
    const formatted = formatMoney(1_254_500n, "XAF", "en-GB");
    expect(formatted).toContain("1,254,500");
    expect(formatted).toContain("FCFA");
  });

  it("uses French grouping for the Cameroonian locale", () => {
    expect(formatMoney(1_254_500n, "XAF", "fr-CM")).toContain("1");
    expect(formatMoney(1_254_500n, "XAF", "fr-CM").replace(/\s/g, "")).toContain("1254500");
  });

  it("keeps two decimals for decimal currencies and signs positives on request", () => {
    expect(formatMoney(123_456n, "EUR", "fr-FR")).toMatch(/1[\s\u00a0\u202f]234,56/);
    expect(formatMoney(5_000n, "XAF", "en-GB", { signed: true }).startsWith("+")).toBe(true);
    expect(formatMoney(-5_000n, "XAF", "en-GB").startsWith("-")).toBe(true);
  });

  it("can omit the currency symbol", () => {
    expect(formatMoney(5_000n, "XAF", "en-GB", { withSymbol: false })).toBe("5,000");
  });
});

describe("minor unit helpers", () => {
  it("converts major units without binary drift", () => {
    expect(majorToMinor(0.1 + 0.2, "USD")).toBe(30n);
    expect(majorToMinor("12.34", "EUR")).toBe(1_234n);
  });

  it("sums and absolutises bigint amounts", () => {
    expect(sumMinor([1_000n, -250n, 5n])).toBe(755n);
    expect(absMinor(-4n)).toBe(4n);
  });

  it("guards unsafe numeric conversion", () => {
    expect(toSafeNumberOrNull(1_000n)).toBe(1000);
    expect(toSafeNumberOrNull(2n ** 60n)).toBeNull();
  });

  it("coerces database strings", () => {
    expect(toMinorUnits("12500")).toBe(12_500n);
    expect(toMinorUnits(null)).toBe(0n);
  });

  it("compacts large amounts for KPI cards", () => {
    expect(formatMoneyCompact(12_500_000n, "XAF", "en")).toMatch(/12\.5M/);
  });
});
