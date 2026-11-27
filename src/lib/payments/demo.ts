/** Demo checkout is intentionally limited to explicit sandbox configuration. */
export function isDemoPaymentEnabled(mode: string, provider: string): boolean {
  return mode === "sandbox" && provider === "demo";
}
