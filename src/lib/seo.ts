import type { Metadata } from "next";
import { LOCALES, LOCALE_META, type Locale } from "./i18n/config";

export const SITE_NAME = "KontaFlow";
export const SITE_TAGLINE = "Intelligence behind every business decision.";
export const DEFAULT_OG_IMAGE = "/images/marketing/og-default.webp";

/** Normalised public origin, without a trailing slash. */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalised === "/" ? "" : normalised}`;
}

export function localizedUrl(locale: Locale, path = ""): string {
  const normalised = !path || path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}/${locale}${normalised}`;
}

export function languageAlternates(path = ""): Record<string, string> {
  return {
    ...Object.fromEntries(LOCALES.map((code) => [LOCALE_META[code].htmlLang, localizedUrl(code, path)])),
    "x-default": localizedUrl("en", path),
  };
}

export function marketingMetadata({
  locale,
  path,
  title,
  description,
  image = DEFAULT_OG_IMAGE,
  type = "website",
  author,
  publishedTime,
  modifiedTime,
  category,
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  image?: string;
  type?: "website" | "article";
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  category?: string;
}): Metadata {
  const canonical = localizedUrl(locale, path);
  const imageUrl = absoluteUrl(image);
  const displayTitle = locale === "pcm" ? `${title} · Pidgin` : title;
  const alternateLocales = LOCALES.filter((code) => code !== locale).map(
    (code) => LOCALE_META[code].ogLocale,
  );

  return {
    title: { absolute: displayTitle },
    description,
    alternates: {
      canonical,
      languages: languageAlternates(path),
    },
    openGraph: {
      type,
      title: displayTitle,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: LOCALE_META[locale].ogLocale,
      alternateLocale: alternateLocales,
      images: [{ url: imageUrl, alt: displayTitle }],
      ...(type === "article"
        ? {
            publishedTime,
            modifiedTime: modifiedTime ?? publishedTime,
            authors: author ? [author] : undefined,
            section: category,
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: displayTitle,
      description,
      images: [imageUrl],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}
