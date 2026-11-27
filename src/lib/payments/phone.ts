/** Normalises a Cameroon mobile number for MTN/Orange collection requests. */
export function normalizeMsisdn(input: string | null | undefined, country = "CM"): string | null {
  const digits = (input ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (!digits) return null;

  if (country.toUpperCase() === "CM") {
    if (/^2376\d{8}$/.test(digits)) return digits;
    if (/^6\d{8}$/.test(digits)) return `237${digits}`;
    return null;
  }

  if (!/^[1-9]\d{5,14}$/.test(digits)) return null;
  return digits;
}

/** Masked form for UI and logs; never write the raw number to application logs. */
export function maskMsisdn(input: string | null | undefined): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  if (digits.length < 6) return null;
  return `${digits.slice(0, 3)}${"*".repeat(Math.max(3, digits.length - 5))}${digits.slice(-2)}`;
}
