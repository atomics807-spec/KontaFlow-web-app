export type CountryOption = {
  code: string;
  dial: string;
  /** Digits expected after the dial code, when known. */
  nationalLength?: number;
};

export const COUNTRIES: readonly CountryOption[] = [
  { code: "CM", dial: "237", nationalLength: 9 },
  { code: "CI", dial: "225", nationalLength: 10 },
  { code: "SN", dial: "221", nationalLength: 9 },
  { code: "GA", dial: "241", nationalLength: 8 },
  { code: "NG", dial: "234", nationalLength: 10 },
  { code: "GH", dial: "233", nationalLength: 9 },
  { code: "KE", dial: "254", nationalLength: 9 },
  { code: "ZA", dial: "27", nationalLength: 9 },
  { code: "BJ", dial: "229", nationalLength: 8 },
  { code: "BF", dial: "226", nationalLength: 8 },
  { code: "ML", dial: "223", nationalLength: 8 },
  { code: "TG", dial: "228", nationalLength: 8 },
  { code: "CD", dial: "243", nationalLength: 9 },
  { code: "FR", dial: "33", nationalLength: 9 },
  { code: "BE", dial: "32", nationalLength: 9 },
  { code: "CA", dial: "1", nationalLength: 10 },
  { code: "US", dial: "1", nationalLength: 10 },
  { code: "GB", dial: "44", nationalLength: 10 },
];

export const SUPPORTED_COUNTRY_CODES = COUNTRIES.map((country) => country.code);

export function countryOption(code: string | null | undefined): CountryOption | undefined {
  return COUNTRIES.find((country) => country.code === (code ?? "").toUpperCase());
}

export function countryName(code: string, locale: string): string {
  try {
    const display = new Intl.DisplayNames([locale], { type: "region" });
    return display.of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}
