import type { Metadata } from "next";
import { LOCALES, LOCALE_META, type Locale } from "./i18n/config";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function marketingMetadata({
  locale,
  path,
  title,
  description,
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
}): Metadata {
  const canonical = `${BASE_URL}/${locale}${path}`;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: Object.fromEntries(
        LOCALES.map((code) => [LOCALE_META[code as Locale].htmlLang, `${BASE_URL}/${code}${path}`]),
      ),
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      locale: LOCALE_META[locale].ogLocale,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
