import { countryOption } from "@/lib/countries";

const E164 = /^\+[1-9][0-9]{6,15}$/;

/**
 * Normalises the phone formats people actually type in Cameroon and its
 * neighbours (spaces, dashes, a national trunk zero, or a bare dial code) into
 * E.164. Returns null when the number cannot be trusted.
 */
export function normalizePhone(raw: string, countryCode: string): string | null {
  const compact = raw.trim().replace(/[\s().-]+/g, "");
  if (compact === "") return null;

  if (compact.startsWith("+")) {
    return E164.test(compact) ? compact : null;
  }
  if (compact.startsWith("00")) {
    const international = `+${compact.slice(2)}`;
    return E164.test(international) ? international : null;
  }

  const country = countryOption(countryCode);
  if (!country) return null;

  let digits = compact.replace(/[^0-9]/g, "");
  if (digits === "") return null;

  if (digits.startsWith(country.dial) && digits.length > country.dial.length + 5) {
    return E164.test(`+${digits}`) ? `+${digits}` : null;
  }

  digits = digits.replace(/^0+/, "");
  if (country.nationalLength && digits.length !== country.nationalLength) {
    return null;
  }

  const candidate = `+${country.dial}${digits}`;
  return E164.test(candidate) ? candidate : null;
}

export function maskPhone(phone: string | null): string {
  if (!phone) return "";
  if (phone.length <= 6) return phone;
  return `${phone.slice(0, 3)}${"•".repeat(Math.max(3, phone.length - 6))}${phone.slice(-3)}`;
}
