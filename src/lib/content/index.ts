import type { Locale } from "@/lib/i18n/config";
import type { Article, LegalDoc, SiteContent } from "./types";

const loaders: Record<Locale, () => Promise<SiteContent>> = {
  en: async () => (await import("./en")).en,
  fr: async () => (await import("./fr")).fr,
  wes: async () => (await import("./wes")).wes,
};

export async function getSiteContent(locale: Locale): Promise<SiteContent> {
  return (loaders[locale] ?? loaders.en)();
}

export function findLegalDoc(content: SiteContent, slug: string): LegalDoc | undefined {
  return content.legal.find((doc) => doc.slug === slug);
}

export function findArticle(content: SiteContent, slug: string): Article | undefined {
  return content.blog.articles.find((article) => article.slug === slug);
}

export type { Article, LegalDoc, SiteContent };
