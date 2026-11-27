import { CONTACT_DETAILS } from "./contact-details";
import { LOCALES, LOCALE_META, type Locale } from "./i18n/config";
import { SITE_NAME, SITE_TAGLINE, SITE_URL, absoluteUrl, localizedUrl } from "./seo";

export type BreadcrumbItem = { label: string; href?: string };
export type JsonLdObject = Record<string, unknown>;

export function organizationSchema(locale: Locale, description: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/icons/icon-512.png"),
      width: 512,
      height: 512,
    },
    description,
    slogan: SITE_TAGLINE,
    email: CONTACT_DETAILS.email,
    telephone: CONTACT_DETAILS.phoneCalls,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Limbe",
      addressCountry: "CM",
    },
    areaServed: [
      { "@type": "Country", name: "Cameroon" },
      { "@type": "Country", name: "Côte d'Ivoire" },
      { "@type": "Country", name: "Senegal" },
      { "@type": "Country", name: "Gabon" },
      { "@type": "Country", name: "Nigeria" },
    ],
    knowsLanguage: LOCALES.map((code) => LOCALE_META[code].htmlLang),
    inLanguage: LOCALE_META[locale].htmlLang,
  };
}

export function websiteSchema(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_TAGLINE,
    inLanguage: LOCALES.map((code) => LOCALE_META[code].htmlLang),
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function webPageSchema({
  locale,
  path,
  name,
  description,
  dateModified,
}: {
  locale: Locale;
  path: string;
  name: string;
  description: string;
  dateModified?: string;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${localizedUrl(locale, path)}#webpage`,
    url: localizedUrl(locale, path),
    name,
    description,
    inLanguage: LOCALE_META[locale].htmlLang,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: { "@id": `${SITE_URL}/#organization` },
    ...(dateModified ? { dateModified } : {}),
  };
}

export function breadcrumbListSchema(locale: Locale, items: BreadcrumbItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href.startsWith("/") ? item.href : `/${locale}/${item.href}`) } : {}),
    })),
  };
}

export function softwareApplicationSchema({
  locale,
  description,
  offers,
  featureList,
}: {
  locale: Locale;
  description: string;
  offers?: { name: string; price: string; priceCurrency: string; description?: string }[];
  featureList?: string[];
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: SITE_NAME,
    url: localizedUrl(locale),
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    description,
    inLanguage: LOCALES.map((code) => LOCALE_META[code].htmlLang),
    publisher: { "@id": `${SITE_URL}/#organization` },
    ...(featureList?.length ? { featureList } : {}),
    ...(offers?.length
      ? {
          offers: offers.map((offer) => ({
            "@type": "Offer",
            name: offer.name,
            price: offer.price,
            priceCurrency: offer.priceCurrency,
            description: offer.description,
            availability: "https://schema.org/OnlineOnly",
          })),
        }
      : {}),
  };
}

export function articleSchema({
  locale,
  path,
  title,
  description,
  image,
  author,
  publishedAt,
  updatedAt,
  category,
  tags,
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  image: string;
  author: string;
  publishedAt: string;
  updatedAt: string;
  category: string;
  tags: string[];
}): JsonLdObject {
  const url = localizedUrl(locale, path);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    headline: title,
    description,
    image: [absoluteUrl(image)],
    datePublished: publishedAt,
    dateModified: updatedAt,
    inLanguage: LOCALE_META[locale].htmlLang,
    articleSection: category,
    keywords: tags,
    author: { "@type": "Organization", name: author },
    publisher: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: absoluteUrl("/icons/icon-512.png") },
    },
  };
}

export function definedTermSetSchema({
  locale,
  path,
  name,
  description,
  terms,
}: {
  locale: Locale;
  path: string;
  name: string;
  description: string;
  terms: { term: string; definition: string }[];
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": `${localizedUrl(locale, path)}#terms`,
    name,
    description,
    inLanguage: LOCALE_META[locale].htmlLang,
    hasDefinedTerm: terms.map((item) => ({
      "@type": "DefinedTerm",
      name: item.term,
      description: item.definition,
      inDefinedTermSet: `${localizedUrl(locale, path)}#terms`,
    })),
  };
}
