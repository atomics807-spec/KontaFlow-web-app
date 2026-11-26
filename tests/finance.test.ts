import { describe, expect, it } from "vitest";
import {
  invoiceLineTotal,
  invoiceTaxMinor,
  invoiceTotals,
  progressPercent,
  quantityToMilli,
} from "@/lib/finance/calculations";

describe("invoice quantity arithmetic", () => {
  it("parses quantities to thousandths exactly", () => {
    expect(quantityToMilli("1")).toBe(1000n);
    expect(quantityToMilli("1.5")).toBe(1500n);
    expect(quantityToMilli("0.125")).toBe(125n);
  });

  it("rejects invalid or over-precise quantities", () => {
    expect(quantityToMilli("1.2345")).toBeNull();
    expect(quantityToMilli("-1")).toBeNull();
    expect(quantityToMilli("abc")).toBeNull();
  });

  it("multiplies and rounds like the SQL trigger", () => {
    expect(invoiceLineTotal("1.5", 10_000n)).toBe(15_000n);
    expect(invoiceLineTotal("3", 1_999n)).toBe(5_997n);
    expect(invoiceLineTotal("0.333", 1_000n)).toBe(333n);
    expect(invoiceLineTotal("0.3335", 1_000n)).toBe(0n);
  });

  it("calculates tax in basis points without floating point", () => {
    expect(invoiceTaxMinor(10_000n, 1925)).toBe(1_925n);
    expect(invoiceTaxMinor(333n, 500)).toBe(17n);
    expect(invoiceTaxMinor(10_000n, 0)).toBe(0n);
  });

  it("aggregates subtotal, tax and total", () => {
    const totals = invoiceTotals([
      { quantity: "2", unitPriceMinor: 5_000n, taxRateBp: 1925 },
      { quantity: "1.5", unitPriceMinor: 2_000n, taxRateBp: 500 },
    ]);
    expect(totals.subtotal).toBe(13_000n);
    expect(totals.tax).toBe(2_075n);
    expect(totals.total).toBe(15_075n);
  });
});

describe("progressPercent", () => {
  it("caps display progress at 100", () => {
    expect(progressPercent(500n, 1_000n)).toBe(50);
    expect(progressPercent(1_500n, 1_000n)).toBe(100);
    expect(progressPercent(5n, 0n)).toBe(0);
  });
});
