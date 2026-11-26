export const SUPPORTED_CURRENCIES = ["XAF", "XOF", "USD", "EUR", "GBP", "NGN", "KES", "GHS"] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

type CurrencyMeta = {
  code: CurrencyCode;
  /** ISO 4217 minor-unit exponent. XAF/XOF have no minor unit. */
  decimals: number;
  symbol: string;
  name: string;
};

const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  XAF: { code: "XAF", decimals: 0, symbol: "FCFA", name: "Central African CFA franc" },
  XOF: { code: "XOF", decimals: 0, symbol: "CFA", name: "West African CFA franc" },
  USD: { code: "USD", decimals: 2, symbol: "$", name: "US dollar" },
  EUR: { code: "EUR", decimals: 2, symbol: "€", name: "Euro" },
  GBP: { code: "GBP", decimals: 2, symbol: "£", name: "Pound sterling" },
  NGN: { code: "NGN", decimals: 2, symbol: "₦", name: "Nigerian naira" },
  KES: { code: "KES", decimals: 2, symbol: "KSh", name: "Kenyan shilling" },
  GHS: { code: "GHS", decimals: 2, symbol: "GH₵", name: "Ghanaian cedi" },
};

export const DEFAULT_CURRENCY: CurrencyCode = "XAF";

export function getCurrency(code: string | null | undefined): CurrencyMeta {
  if (code && code in CURRENCIES) return CURRENCIES[code as CurrencyCode];
  return CURRENCIES[DEFAULT_CURRENCY];
}

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return code in CURRENCIES;
}

export const CURRENCY_OPTIONS: CurrencyMeta[] = SUPPORTED_CURRENCIES.map((code) => CURRENCIES[code]);
