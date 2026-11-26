import type { Metadata } from "next";
import { LOCALES, LOCALE_META, type Locale } from "./i18n/config";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function marketingMetadata({
  locale,
  path,
  title,
  description,
  image = "/images/marketing/og-default.webp",
  type = "website",
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  image?: string;
  type?: "website" | "article";
}): Metadata {
  const canonical = `${BASE_URL}/${locale}${path}`;
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(
          LOCALES.map((code) => [LOCALE_META[code as Locale].htmlLang, `${BASE_URL}/${code}${path}`]),
        ),
        "x-default": `${BASE_URL}/en${path}`,
      },
    },
    openGraph: {
      type,
      title,
      description,
      url: canonical,
      siteName: "KontaFlow",
      locale: LOCALE_META[locale].ogLocale,
      images: [{ url: `${BASE_URL}${image}`, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${BASE_URL}${image}`],
    },
  };
}
