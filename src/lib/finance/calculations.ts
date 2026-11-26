const QUANTITY = /^\d+(\.\d{1,3})?$/;

/** Parses an invoice quantity into thousandths without floating point. */
export function quantityToMilli(quantity: string): bigint | null {
  const trimmed = quantity.trim();
  if (!QUANTITY.test(trimmed)) return null;
  const [whole = "0", fraction = ""] = trimmed.split(".");
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0").slice(0, 3) || "0");
}

/** Mirrors app.calculate_invoice_item_total: round(quantity * unit_price). */
export function invoiceLineTotal(quantity: string, unitPriceMinor: bigint): bigint {
  const quantityMilli = quantityToMilli(quantity);
  if (quantityMilli === null || unitPriceMinor <= 0n) return 0n;
  return (quantityMilli * unitPriceMinor + 500n) / 1000n;
}

/** Mirrors the SQL round(line_total * tax_rate_bp / 10000), half away from zero. */
export function invoiceTaxMinor(lineTotalMinor: bigint, taxRateBp: number): bigint {
  if (lineTotalMinor <= 0n || taxRateBp <= 0) return 0n;
  return (lineTotalMinor * BigInt(taxRateBp) + 5000n) / 10000n;
}

export function invoiceTotals(
  items: { quantity: string; unitPriceMinor: bigint; taxRateBp: number }[],
): { subtotal: bigint; tax: bigint; total: bigint } {
  let subtotal = 0n;
  let tax = 0n;
  for (const item of items) {
    const line = invoiceLineTotal(item.quantity, item.unitPriceMinor);
    subtotal += line;
    tax += invoiceTaxMinor(line, item.taxRateBp);
  }
  return { subtotal, tax, total: subtotal + tax };
}

/** Whole-percent progress, capped at 100 for display bars. */
export function progressPercent(part: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Math.min(100, Number((part * 100n) / total));
}
